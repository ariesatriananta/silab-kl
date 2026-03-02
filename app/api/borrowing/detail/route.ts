import { NextResponse } from "next/server"
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import {
  borrowingApprovals,
  borrowingApprovalMatrices,
  borrowingHandovers,
  borrowingReturnItems,
  borrowingReturns,
  borrowingTransactionItems,
  borrowingTransactions,
  consumableItems,
  labs,
  toolAssets,
  toolModels,
  userLabAssignments,
  users,
} from "@/lib/db/schema"

type Role = "admin" | "mahasiswa" | "petugas_plp" | "dosen"

const querySchema = z.object({
  transactionId: z.string().uuid(),
})

function fmtDate(date: Date | null) {
  if (!date) return null
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date)
}

function fmtDateTime(date: Date | null) {
  if (!date) return null
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date)
}

function mapBorrowingDisplayStatus(input: {
  status: typeof borrowingTransactions.$inferSelect.status
  dueDate: Date | null
}) {
  const now = Date.now()
  const base = input.status
  if ((base === "active" || base === "partially_returned") && input.dueDate && input.dueDate.getTime() < now) {
    return "overdue" as const
  }
  if (base === "submitted" || base === "pending_approval") return "pending" as const
  return base
}

function getPendingApprovalInfo(input: {
  status: ReturnType<typeof mapBorrowingDisplayStatus>
  approvalsCount: number
  matrixId: string | null
  step1ApproverName: string | null
  step2ApproverName: string | null
}) {
  if (input.status !== "pending") return null
  if (!input.matrixId) return { label: "Matrix approval belum dipasang", approvers: [], triage: "blocked_matrix" as const }
  if (!input.step1ApproverName || !input.step2ApproverName) {
    return { label: "Matrix approval tidak valid", approvers: [], triage: "blocked_matrix" as const }
  }
  if (input.approvalsCount <= 0) {
    return { label: "Tahap 1: Dosen", approvers: [input.step1ApproverName], triage: "step1_ready" as const }
  }
  if (input.approvalsCount === 1) {
    return { label: "Tahap 2: Petugas PLP", approvers: [input.step2ApproverName], triage: "step2_ready" as const }
  }
  return { label: "Menunggu sinkronisasi status", approvers: [], triage: "unknown" as const }
}

function getMatrixRequiredApprover(input: {
  approvalsCount: number
  transactionStep1ApproverUserId: string | null
  matrix: { step1ApproverUserId: string | null; step2ApproverUserId: string | null } | null
}) {
  if (!input.matrix) return null
  if (input.approvalsCount <= 0) {
    return {
      stepOrder: 1 as const,
      approverUserId: input.transactionStep1ApproverUserId ?? input.matrix.step1ApproverUserId,
    }
  }
  if (input.approvalsCount === 1) {
    return { stepOrder: 2 as const, approverUserId: input.matrix.step2ApproverUserId }
  }
  return null
}

async function getAccessibleLabIds(role: Role, userId: string) {
  if (role === "admin" || role === "mahasiswa") return null
  const assignments = await db
    .select({ labId: userLabAssignments.labId })
    .from(userLabAssignments)
    .where(eq(userLabAssignments.userId, userId))
  return assignments.map((a) => a.labId)
}

export async function GET(request: Request) {
  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ message: "Sesi tidak valid." }, { status: 401 })
  }

  const url = new URL(request.url)
  const parsed = querySchema.safeParse({
    transactionId: url.searchParams.get("transactionId"),
  })
  if (!parsed.success) {
    return NextResponse.json({ message: "ID transaksi tidak valid." }, { status: 400 })
  }

  const role = session.user.role as Role
  const userId = session.user.id
  const accessibleLabIds = await getAccessibleLabIds(role, userId)

  const roleWhere =
    role === "admin"
      ? undefined
      : role === "mahasiswa"
        ? eq(borrowingTransactions.requesterUserId, userId)
        : accessibleLabIds && accessibleLabIds.length > 0
          ? inArray(borrowingTransactions.labId, accessibleLabIds)
          : sql`false`

  const txRow = await db
    .select({
      id: borrowingTransactions.id,
      code: borrowingTransactions.code,
      labId: borrowingTransactions.labId,
      requesterUserId: borrowingTransactions.requesterUserId,
      purpose: borrowingTransactions.purpose,
      courseName: borrowingTransactions.courseName,
      materialTopic: borrowingTransactions.materialTopic,
      semesterLabel: borrowingTransactions.semesterLabel,
      groupName: borrowingTransactions.groupName,
      advisorLecturerName: borrowingTransactions.advisorLecturerName,
      step1ApproverUserId: borrowingTransactions.step1ApproverUserId,
      approvalMatrixId: borrowingTransactions.approvalMatrixId,
      status: borrowingTransactions.status,
      requesterName: users.fullName,
      requesterNim: users.nim,
      requestedAt: borrowingTransactions.requestedAt,
      handedOverAt: borrowingTransactions.handedOverAt,
      dueDate: borrowingTransactions.dueDate,
      labName: labs.name,
    })
    .from(borrowingTransactions)
    .innerJoin(users, eq(users.id, borrowingTransactions.requesterUserId))
    .innerJoin(labs, eq(labs.id, borrowingTransactions.labId))
    .where(and(eq(borrowingTransactions.id, parsed.data.transactionId), roleWhere))
    .limit(1)

  const row = txRow[0]
  if (!row) {
    return NextResponse.json({ message: "Transaksi tidak ditemukan atau tidak dapat diakses." }, { status: 404 })
  }

  const [items, approvalCountRows, approvalHistoryRows, handoverRows, returnRows, returnItemRows, matrixRows] =
    await Promise.all([
      db
        .select({
          id: borrowingTransactionItems.id,
          itemType: borrowingTransactionItems.itemType,
          qty: borrowingTransactionItems.qtyRequested,
          toolAssetId: borrowingTransactionItems.toolAssetId,
          toolName: toolModels.name,
          assetCode: toolAssets.assetCode,
          consumableName: consumableItems.name,
          consumableUnit: consumableItems.unit,
        })
        .from(borrowingTransactionItems)
        .leftJoin(toolAssets, eq(toolAssets.id, borrowingTransactionItems.toolAssetId))
        .leftJoin(toolModels, eq(toolModels.id, toolAssets.toolModelId))
        .leftJoin(consumableItems, eq(consumableItems.id, borrowingTransactionItems.consumableItemId))
        .where(eq(borrowingTransactionItems.transactionId, row.id)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(borrowingApprovals)
        .where(and(eq(borrowingApprovals.transactionId, row.id), eq(borrowingApprovals.decision, "approved"))),
      db
        .select({
          decision: borrowingApprovals.decision,
          decidedAt: borrowingApprovals.decidedAt,
          note: borrowingApprovals.note,
          approverName: users.fullName,
          approverRole: users.role,
        })
        .from(borrowingApprovals)
        .innerJoin(users, eq(users.id, borrowingApprovals.approverUserId))
        .where(eq(borrowingApprovals.transactionId, row.id))
        .orderBy(asc(borrowingApprovals.decidedAt)),
      db
        .select({
          handedOverAt: borrowingHandovers.handedOverAt,
          dueDate: borrowingHandovers.dueDate,
          note: borrowingHandovers.note,
          handedOverByName: users.fullName,
        })
        .from(borrowingHandovers)
        .innerJoin(users, eq(users.id, borrowingHandovers.handedOverByUserId))
        .where(eq(borrowingHandovers.transactionId, row.id))
        .orderBy(desc(borrowingHandovers.handedOverAt)),
      db
        .select({
          returnId: borrowingReturns.id,
          returnedAt: borrowingReturns.returnedAt,
          note: borrowingReturns.note,
          receivedByName: users.fullName,
        })
        .from(borrowingReturns)
        .innerJoin(users, eq(users.id, borrowingReturns.receivedByUserId))
        .where(eq(borrowingReturns.transactionId, row.id))
        .orderBy(desc(borrowingReturns.returnedAt)),
      db
        .select({
          returnId: borrowingReturnItems.returnId,
          transactionItemId: borrowingReturnItems.transactionItemId,
          returnCondition: borrowingReturnItems.returnCondition,
          note: borrowingReturnItems.note,
          toolName: toolModels.name,
          assetCode: toolAssets.assetCode,
        })
        .from(borrowingReturnItems)
        .innerJoin(toolAssets, eq(toolAssets.id, borrowingReturnItems.toolAssetId))
        .innerJoin(toolModels, eq(toolModels.id, toolAssets.toolModelId))
        .innerJoin(borrowingReturns, eq(borrowingReturns.id, borrowingReturnItems.returnId))
        .where(eq(borrowingReturns.transactionId, row.id)),
      row.approvalMatrixId
        ? db
            .select({
              id: borrowingApprovalMatrices.id,
              step1ApproverUserId: borrowingApprovalMatrices.step1ApproverUserId,
              step2ApproverUserId: borrowingApprovalMatrices.step2ApproverUserId,
            })
            .from(borrowingApprovalMatrices)
            .where(eq(borrowingApprovalMatrices.id, row.approvalMatrixId))
        : Promise.resolve([]),
    ])

  const approverIds = Array.from(
    new Set(
      [row.step1ApproverUserId, matrixRows[0]?.step1ApproverUserId ?? null, matrixRows[0]?.step2ApproverUserId ?? null].filter(
        (value): value is string => Boolean(value),
      ),
    ),
  )
  const userRows =
    approverIds.length > 0
      ? await db
          .select({ id: users.id, fullName: users.fullName })
          .from(users)
          .where(and(inArray(users.id, approverIds), eq(users.isActive, true)))
      : []

  const returnedItemIdSet = new Set(returnItemRows.map((r) => r.transactionItemId))
  const mappedItems = items.map((item) => ({
    id: item.id,
    itemType: item.itemType,
    name: item.itemType === "tool_asset" ? (item.toolName ?? "Alat") : (item.consumableName ?? "Bahan"),
    qty: item.qty,
    toolAssetId: item.toolAssetId,
    assetCode: item.assetCode,
    unit: item.consumableUnit,
    returned: returnedItemIdSet.has(item.id),
  }))

  const approvalCount = Number(approvalCountRows[0]?.count ?? 0)
  const matrix = matrixRows[0] ?? null
  const userById = new Map(userRows.map((u) => [u.id, u.fullName]))
  const status = mapBorrowingDisplayStatus({ status: row.status, dueDate: row.dueDate })
  const requiredApprover = getMatrixRequiredApprover({
    approvalsCount: approvalCount,
    transactionStep1ApproverUserId: row.step1ApproverUserId,
    matrix,
  })
  const requiredApproverName =
    requiredApprover?.approverUserId ? userById.get(requiredApprover.approverUserId) ?? null : null
  const adminOverrideReasonRequired =
    role === "admin" &&
    status === "pending" &&
    !!requiredApprover?.approverUserId &&
    requiredApprover.approverUserId !== userId
  const pendingApproval = getPendingApprovalInfo({
    status,
    approvalsCount: approvalCount,
    matrixId: row.approvalMatrixId,
    step1ApproverName:
      (row.step1ApproverUserId ? userById.get(row.step1ApproverUserId) ?? null : null) ??
      (matrix?.step1ApproverUserId ? userById.get(matrix.step1ApproverUserId) ?? null : null),
    step2ApproverName: matrix?.step2ApproverUserId ? userById.get(matrix.step2ApproverUserId) ?? null : null,
  })

  const returnItemsByReturnId = new Map<string, Array<{
    transactionItemId: string
    toolName: string
    assetCode: string
    returnCondition: "baik" | "maintenance" | "damaged"
    note: string | null
  }>>()
  for (const ri of returnItemRows) {
    const list = returnItemsByReturnId.get(ri.returnId) ?? []
    list.push({
      transactionItemId: ri.transactionItemId,
      toolName: ri.toolName,
      assetCode: ri.assetCode,
      returnCondition: ri.returnCondition,
      note: ri.note,
    })
    returnItemsByReturnId.set(ri.returnId, list)
  }

  return NextResponse.json({
    detail: {
      id: row.id,
      code: row.code,
      borrower: row.requesterName,
      nim: row.requesterNim,
      status,
      purpose: row.purpose,
      courseName: row.courseName,
      materialTopic: row.materialTopic,
      semesterLabel: row.semesterLabel,
      groupName: row.groupName,
      advisorLecturerName: row.advisorLecturerName,
      requestedAt: fmtDate(row.requestedAt) ?? "-",
      borrowDate: fmtDate(row.handedOverAt),
      dueDate: fmtDate(row.dueDate),
      labName: row.labName,
      approvalsCount: approvalCount,
      pendingApprovalLabel: pendingApproval?.label ?? null,
      pendingApprovalApprovers: pendingApproval?.approvers ?? [],
      pendingApprovalTriage: pendingApproval?.triage ?? null,
      pendingRequiredApproverName: requiredApproverName,
      adminOverrideReasonRequired,
      items: mappedItems,
      approvalHistory: approvalHistoryRows.map((a) => ({
        approverName: a.approverName,
        approverRole: a.approverRole,
        decision: a.decision,
        decidedAt: fmtDateTime(a.decidedAt) ?? "-",
        note: a.note,
      })),
      handoverHistory: handoverRows.map((h) => ({
        handedOverAt: fmtDateTime(h.handedOverAt) ?? "-",
        dueDate: fmtDate(h.dueDate) ?? "-",
        handedOverByName: h.handedOverByName,
        note: h.note,
      })),
      returnEvents: returnRows.map((r) => ({
        returnedAt: fmtDateTime(r.returnedAt) ?? "-",
        receivedByName: r.receivedByName,
        note: r.note,
        items: returnItemsByReturnId.get(r.returnId) ?? [],
      })),
    },
  })
}
