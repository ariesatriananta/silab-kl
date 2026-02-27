import { redirect } from "next/navigation"
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm"

import {
  type BorrowingCreateApprovalRouteOption,
  BorrowingPageClient,
  type BorrowingCreateConsumableOption,
  type BorrowingCreateLabOption,
  type BorrowingCreateRequesterOption,
  type BorrowingCreateToolOption,
  type BorrowingDetail,
  type BorrowingListRow,
} from "@/components/borrowing/borrowing-page-client"
import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import {
  borrowingApprovals,
  borrowingApprovalMatrices,
  borrowingApprovalMatrixSteps,
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

export const dynamic = "force-dynamic"

type Role = "admin" | "mahasiswa" | "petugas_plp" | "dosen"
type BorrowingPageStatusFilter =
  | "all"
  | "pending"
  | "approved_waiting_handover"
  | "active"
  | "partially_returned"
  | "overdue"
  | "completed"
  | "rejected"
  | "cancelled"
type BorrowingPageScopeFilter = "all" | "mine" | "my_labs" | "waiting_me"
type PendingApprovalInfo = {
  label: string
  approvers: string[]
  triage: "step1_ready" | "step2_ready" | "blocked_matrix" | "unknown"
}

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
  if (
    (base === "active" || base === "partially_returned") &&
    input.dueDate &&
    input.dueDate.getTime() < now
  ) {
    return "overdue" as const
  }
  if (base === "submitted" || base === "pending_approval") return "pending" as const
  return base
}

function getPendingApprovalInfo(input: {
  status: ReturnType<typeof mapBorrowingDisplayStatus>
  approvalsCount: number
  matrixId: string | null
  matrixSteps: Array<{ stepOrder: number; approverRole: "dosen" | "petugas_plp" | "admin" | "mahasiswa" }>
  dosenApprovers: string[]
  plpApprovers: string[]
}): PendingApprovalInfo | null {
  if (input.status !== "pending") return null
  if (!input.matrixId) return { label: "Matrix approval belum dipasang", approvers: [], triage: "blocked_matrix" }

  const step1 = input.matrixSteps.find((item) => item.stepOrder === 1)?.approverRole
  const step2 = input.matrixSteps.find((item) => item.stepOrder === 2)?.approverRole
  if (step1 !== "dosen" || step2 !== "petugas_plp") {
    return { label: "Matrix approval tidak valid", approvers: [], triage: "blocked_matrix" }
  }

  if (input.approvalsCount <= 0) {
    return { label: "Tahap 1: Dosen", approvers: input.dosenApprovers, triage: "step1_ready" }
  }
  if (input.approvalsCount === 1) {
    return { label: "Tahap 2: Petugas PLP", approvers: input.plpApprovers, triage: "step2_ready" }
  }
  return { label: "Menunggu sinkronisasi status", approvers: [], triage: "unknown" }
}

async function getAccessibleLabIds(role: Role, userId: string) {
  if (role === "admin" || role === "mahasiswa") return null
  const assignments = await db
    .select({ labId: userLabAssignments.labId })
    .from(userLabAssignments)
    .where(eq(userLabAssignments.userId, userId))
  return assignments.map((a) => a.labId)
}

async function getBorrowingData(
  role: Role,
  userId: string,
  page: number,
  pageSize: number,
  filters: { status: BorrowingPageStatusFilter; scope: BorrowingPageScopeFilter },
) {
  const accessibleLabIds = await getAccessibleLabIds(role, userId)

  const roleBaseWhere =
    role === "admin"
      ? undefined
      : role === "mahasiswa"
        ? eq(borrowingTransactions.requesterUserId, userId)
        : accessibleLabIds && accessibleLabIds.length > 0
          ? inArray(borrowingTransactions.labId, accessibleLabIds)
          : sql`false`

  const scopeWhere =
    role === "mahasiswa"
      ? eq(borrowingTransactions.requesterUserId, userId)
      : filters.scope === "mine"
        ? or(eq(borrowingTransactions.requesterUserId, userId), eq(borrowingTransactions.createdByUserId, userId))
        : filters.scope === "waiting_me"
          ? role === "dosen" || role === "petugas_plp"
            ? and(
                inArray(borrowingTransactions.status, ["submitted", "pending_approval"]),
                sql`${borrowingTransactions.approvalMatrixId} is not null`,
                sql`not exists (
                  select 1
                  from borrowing_approvals ba_self
                  where ba_self.transaction_id = ${borrowingTransactions.id}
                    and ba_self.approver_user_id = ${userId}
                )`,
                role === "dosen"
                  ? sql`(
                      select count(*)
                      from borrowing_approvals ba_ok
                      where ba_ok.transaction_id = ${borrowingTransactions.id}
                        and ba_ok.decision = 'approved'
                    ) = 0`
                  : sql`(
                      select count(*)
                      from borrowing_approvals ba_ok
                      where ba_ok.transaction_id = ${borrowingTransactions.id}
                        and ba_ok.decision = 'approved'
                    ) = 1`,
                role === "dosen"
                  ? sql`exists (
                      select 1
                      from borrowing_approval_matrix_steps bams
                      where bams.matrix_id = ${borrowingTransactions.approvalMatrixId}
                        and bams.step_order = 1
                        and bams.approver_role = 'dosen'
                    )`
                  : sql`exists (
                      select 1
                      from borrowing_approval_matrix_steps bams
                      where bams.matrix_id = ${borrowingTransactions.approvalMatrixId}
                        and bams.step_order = 2
                        and bams.approver_role = 'petugas_plp'
                    )`,
              )
            : sql`false`
        : filters.scope === "my_labs"
          ? accessibleLabIds && accessibleLabIds.length > 0
            ? inArray(borrowingTransactions.labId, accessibleLabIds)
            : sql`false`
          : undefined

  const statusWhere =
    filters.status === "all"
      ? undefined
      : filters.status === "pending"
        ? inArray(borrowingTransactions.status, ["submitted", "pending_approval"])
        : filters.status === "overdue"
          ? and(
              inArray(borrowingTransactions.status, ["active", "partially_returned"]),
              sql`${borrowingTransactions.dueDate} is not null`,
              sql`${borrowingTransactions.dueDate} < now()`,
            )
          : eq(
              borrowingTransactions.status,
              filters.status as
                | "approved_waiting_handover"
                | "active"
                | "partially_returned"
                | "completed"
                | "rejected"
                | "cancelled",
            )

  const finalWhere = and(roleBaseWhere, scopeWhere, statusWhere)
  const shouldApplyPendingTriageSort = filters.status === "pending" || filters.scope === "waiting_me"
  const pendingTriageRank = sql<number>`
    case
      when ${borrowingTransactions.status} in ('submitted', 'pending_approval') then
        case
          when ${borrowingTransactions.approvalMatrixId} is null then 90
          when not exists (
            select 1
            from borrowing_approval_matrix_steps bams
            where bams.matrix_id = ${borrowingTransactions.approvalMatrixId}
              and bams.step_order = 1
              and bams.approver_role = 'dosen'
          ) then 90
          when not exists (
            select 1
            from borrowing_approval_matrix_steps bams
            where bams.matrix_id = ${borrowingTransactions.approvalMatrixId}
              and bams.step_order = 2
              and bams.approver_role = 'petugas_plp'
          ) then 90
          when (
            select count(*)
            from borrowing_approvals ba_ok
            where ba_ok.transaction_id = ${borrowingTransactions.id}
              and ba_ok.decision = 'approved'
          ) = 0 then 10
          when (
            select count(*)
            from borrowing_approvals ba_ok
            where ba_ok.transaction_id = ${borrowingTransactions.id}
              and ba_ok.decision = 'approved'
          ) = 1 then 20
          else 80
        end
      else 99
    end
  `
  const txOrderBy = shouldApplyPendingTriageSort
    ? [asc(pendingTriageRank), desc(borrowingTransactions.requestedAt)] as const
    : [desc(borrowingTransactions.requestedAt)] as const

  const offset = (page - 1) * pageSize

  const [txRows, totalCountRows] = await Promise.all([
    db
    .select({
      id: borrowingTransactions.id,
      code: borrowingTransactions.code,
      labId: borrowingTransactions.labId,
      requesterUserId: borrowingTransactions.requesterUserId,
      createdByUserId: borrowingTransactions.createdByUserId,
      purpose: borrowingTransactions.purpose,
      courseName: borrowingTransactions.courseName,
      materialTopic: borrowingTransactions.materialTopic,
      semesterLabel: borrowingTransactions.semesterLabel,
      groupName: borrowingTransactions.groupName,
      advisorLecturerName: borrowingTransactions.advisorLecturerName,
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
    .where(finalWhere)
    .orderBy(...txOrderBy)
    .limit(pageSize)
    .offset(offset),
    db
      .select({ total: sql<number>`count(*)` })
      .from(borrowingTransactions)
      .where(finalWhere),
  ])

  const totalItems = Number(totalCountRows[0]?.total ?? 0)
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  const txIds = txRows.map((row) => row.id)
  if (txIds.length === 0) {
    return {
      rows: [] as BorrowingListRow[],
      details: {} as Record<string, BorrowingDetail>,
      accessibleLabIds,
      activeFilters: filters,
      pagination: {
        page: Math.min(page, totalPages),
        pageSize,
        totalItems,
        totalPages,
      },
    }
  }

  const [
    itemRows,
    approvalRows,
    approvalHistoryRows,
    handoverHistoryRows,
    returnCountRows,
    returnedItemRows,
    returnRows,
    returnItemRows,
    matrixStepRows,
    approverAssignmentRows,
  ] =
    await Promise.all([
      db
        .select({
        transactionId: borrowingTransactionItems.transactionId,
        itemId: borrowingTransactionItems.id,
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
      .where(inArray(borrowingTransactionItems.transactionId, txIds)),
      db
      .select({
        transactionId: borrowingApprovals.transactionId,
        count: sql<number>`count(*)`,
      })
      .from(borrowingApprovals)
      .where(eq(borrowingApprovals.decision, "approved"))
      .groupBy(borrowingApprovals.transactionId),
      db
      .select({
        transactionId: borrowingApprovals.transactionId,
        decision: borrowingApprovals.decision,
        decidedAt: borrowingApprovals.decidedAt,
        note: borrowingApprovals.note,
        approverName: users.fullName,
        approverRole: users.role,
      })
      .from(borrowingApprovals)
      .innerJoin(users, eq(users.id, borrowingApprovals.approverUserId))
      .where(inArray(borrowingApprovals.transactionId, txIds))
      .orderBy(asc(borrowingApprovals.decidedAt)),
      db
        .select({
          transactionId: borrowingHandovers.transactionId,
          handedOverAt: borrowingHandovers.handedOverAt,
          dueDate: borrowingHandovers.dueDate,
          note: borrowingHandovers.note,
          handedOverByName: users.fullName,
        })
        .from(borrowingHandovers)
        .innerJoin(users, eq(users.id, borrowingHandovers.handedOverByUserId))
        .where(inArray(borrowingHandovers.transactionId, txIds))
        .orderBy(desc(borrowingHandovers.handedOverAt)),
      db
        .select({
        transactionId: borrowingReturns.transactionId,
        count: sql<number>`count(${borrowingReturnItems.id})`,
      })
      .from(borrowingReturns)
      .leftJoin(borrowingReturnItems, eq(borrowingReturnItems.returnId, borrowingReturns.id))
      .where(inArray(borrowingReturns.transactionId, txIds))
      .groupBy(borrowingReturns.transactionId),
      db
      .select({
        transactionItemId: borrowingReturnItems.transactionItemId,
      })
      .from(borrowingReturnItems)
      .innerJoin(borrowingReturns, eq(borrowingReturns.id, borrowingReturnItems.returnId))
      .where(inArray(borrowingReturns.transactionId, txIds)),
      db
      .select({
        returnId: borrowingReturns.id,
        transactionId: borrowingReturns.transactionId,
        returnedAt: borrowingReturns.returnedAt,
        note: borrowingReturns.note,
        receivedByName: users.fullName,
      })
      .from(borrowingReturns)
      .innerJoin(users, eq(users.id, borrowingReturns.receivedByUserId))
      .where(inArray(borrowingReturns.transactionId, txIds))
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
      .where(inArray(borrowingReturns.transactionId, txIds)),
      db
        .select({
          matrixId: borrowingApprovalMatrixSteps.matrixId,
          stepOrder: borrowingApprovalMatrixSteps.stepOrder,
          approverRole: borrowingApprovalMatrixSteps.approverRole,
        })
        .from(borrowingApprovalMatrixSteps)
        .where(
          (() => {
            const matrixIds = txRows
              .map((row) => row.approvalMatrixId)
              .filter((value): value is string => Boolean(value))
            return matrixIds.length > 0
              ? inArray(borrowingApprovalMatrixSteps.matrixId, matrixIds)
              : sql`false`
          })(),
        ),
      db
        .select({
          labId: userLabAssignments.labId,
          role: users.role,
          fullName: users.fullName,
        })
        .from(userLabAssignments)
        .innerJoin(users, eq(users.id, userLabAssignments.userId))
        .where(
          and(
            inArray(
              userLabAssignments.labId,
              [...new Set(txRows.map((row) => row.labId))],
            ),
            inArray(users.role, ["dosen", "petugas_plp"]),
            eq(users.isActive, true),
          ),
        )
        .orderBy(asc(users.fullName)),
    ])

  const txIdSet = new Set(txRows.map((row) => row.id))

  const returnedItemIdSet = new Set(returnedItemRows.map((r) => r.transactionItemId))
  const itemMap = new Map<string, BorrowingDetail["items"]>()
  for (const row of itemRows) {
    if (!txIdSet.has(row.transactionId)) continue
    const list = itemMap.get(row.transactionId) ?? []
    list.push({
      id: row.itemId,
      itemType: row.itemType,
      name: row.itemType === "tool_asset" ? (row.toolName ?? "Alat") : (row.consumableName ?? "Bahan"),
      qty: row.qty,
      toolAssetId: row.toolAssetId,
      assetCode: row.assetCode,
      unit: row.consumableUnit,
      returned: returnedItemIdSet.has(row.itemId),
    })
    itemMap.set(row.transactionId, list)
  }

  const approvalCountByTx = new Map(approvalRows.map((r) => [r.transactionId, Number(r.count)]))
  const matrixStepsById = new Map<
    string,
    Array<{ stepOrder: number; approverRole: "dosen" | "petugas_plp" | "admin" | "mahasiswa" }>
  >()
  for (const row of matrixStepRows) {
    const list = matrixStepsById.get(row.matrixId) ?? []
    list.push({ stepOrder: row.stepOrder, approverRole: row.approverRole })
    matrixStepsById.set(row.matrixId, list)
  }
  const approversByLab = new Map<string, { dosen: string[]; plp: string[] }>()
  for (const row of approverAssignmentRows) {
    const list = approversByLab.get(row.labId) ?? { dosen: [], plp: [] }
    if (row.role === "dosen") list.dosen.push(row.fullName)
    if (row.role === "petugas_plp") list.plp.push(row.fullName)
    approversByLab.set(row.labId, list)
  }
  const returnCountByTx = new Map(returnCountRows.map((r) => [r.transactionId, Number(r.count)]))
  const handoverHistoryByTx = new Map<string, BorrowingDetail["handoverHistory"]>()
  for (const row of handoverHistoryRows) {
    if (!txIdSet.has(row.transactionId)) continue
    const list = handoverHistoryByTx.get(row.transactionId) ?? []
    list.push({
      handedOverAt: fmtDateTime(row.handedOverAt) ?? "-",
      dueDate: fmtDate(row.dueDate) ?? "-",
      handedOverByName: row.handedOverByName,
      note: row.note,
    })
    handoverHistoryByTx.set(row.transactionId, list)
  }

  const approvalHistoryByTx = new Map<string, BorrowingDetail["approvalHistory"]>()
  for (const row of approvalHistoryRows) {
    if (!txIdSet.has(row.transactionId)) continue
    const list = approvalHistoryByTx.get(row.transactionId) ?? []
    list.push({
      approverName: row.approverName,
      approverRole: row.approverRole,
      decision: row.decision,
      decidedAt: fmtDateTime(row.decidedAt) ?? "-",
      note: row.note,
    })
    approvalHistoryByTx.set(row.transactionId, list)
  }

  const returnItemsByReturnId = new Map<string, NonNullable<BorrowingDetail["returnEvents"]>[number]["items"]>()
  for (const row of returnItemRows) {
    const list = returnItemsByReturnId.get(row.returnId) ?? []
    list.push({
      transactionItemId: row.transactionItemId,
      toolName: row.toolName,
      assetCode: row.assetCode,
      returnCondition: row.returnCondition,
      note: row.note,
    })
    returnItemsByReturnId.set(row.returnId, list)
  }

  const returnEventsByTx = new Map<string, BorrowingDetail["returnEvents"]>()
  for (const row of returnRows) {
    if (!txIdSet.has(row.transactionId)) continue
    const list = returnEventsByTx.get(row.transactionId) ?? []
    list.push({
      returnedAt: fmtDateTime(row.returnedAt) ?? "-",
      receivedByName: row.receivedByName,
      note: row.note,
      items: returnItemsByReturnId.get(row.returnId) ?? [],
    })
    returnEventsByTx.set(row.transactionId, list)
  }

  const rows: BorrowingListRow[] = txRows.map((row) => {
    const status = mapBorrowingDisplayStatus({ status: row.status, dueDate: row.dueDate })
    const items = itemMap.get(row.id) ?? []
    const pendingApproval = getPendingApprovalInfo({
      status,
      approvalsCount: approvalCountByTx.get(row.id) ?? 0,
      matrixId: row.approvalMatrixId,
      matrixSteps: row.approvalMatrixId ? matrixStepsById.get(row.approvalMatrixId) ?? [] : [],
      dosenApprovers: approversByLab.get(row.labId)?.dosen ?? [],
      plpApprovers: approversByLab.get(row.labId)?.plp ?? [],
    })
    return {
      id: row.id,
      code: row.code,
      labId: row.labId,
      requesterUserId: row.requesterUserId,
      createdByUserId: row.createdByUserId,
      borrower: row.requesterName,
      nim: row.requesterNim,
      borrowDate: fmtDate(row.handedOverAt),
      dueDate: fmtDate(row.dueDate),
      status,
      purpose: row.purpose,
      courseName: row.courseName,
      materialTopic: row.materialTopic,
      semesterLabel: row.semesterLabel,
      groupName: row.groupName,
      advisorLecturerName: row.advisorLecturerName,
      itemCount: items.length,
      pendingApprovalLabel: pendingApproval?.label ?? null,
      pendingApprovalApprovers: pendingApproval?.approvers ?? [],
      pendingApprovalTriage: pendingApproval?.triage ?? null,
    }
  })

  const details: Record<string, BorrowingDetail> = Object.fromEntries(
    txRows.map((row) => {
      const status = mapBorrowingDisplayStatus({ status: row.status, dueDate: row.dueDate })
      const pendingApproval = getPendingApprovalInfo({
        status,
        approvalsCount: approvalCountByTx.get(row.id) ?? 0,
        matrixId: row.approvalMatrixId,
        matrixSteps: row.approvalMatrixId ? matrixStepsById.get(row.approvalMatrixId) ?? [] : [],
        dosenApprovers: approversByLab.get(row.labId)?.dosen ?? [],
        plpApprovers: approversByLab.get(row.labId)?.plp ?? [],
      })
      return [
        row.id,
        {
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
          approvalsCount: approvalCountByTx.get(row.id) ?? 0,
          pendingApprovalLabel: pendingApproval?.label ?? null,
          pendingApprovalApprovers: pendingApproval?.approvers ?? [],
          pendingApprovalTriage: pendingApproval?.triage ?? null,
          items: itemMap.get(row.id) ?? [],
          approvalHistory: approvalHistoryByTx.get(row.id) ?? [],
          handoverHistory: handoverHistoryByTx.get(row.id) ?? [],
          returnEvents: returnEventsByTx.get(row.id) ?? [],
        } satisfies BorrowingDetail,
      ]
    }),
  )

  // For later usage (currently not shown, but useful if needed)
  void returnCountByTx

  return {
    rows,
    details,
    accessibleLabIds,
    activeFilters: filters,
    pagination: {
      page: Math.min(page, totalPages),
      pageSize,
      totalItems,
      totalPages,
    },
  }
}

async function getCreateOptions(role: Role, userId: string, accessibleLabIds: string[] | null) {
  const labScopeWhere =
    role !== "admin" && role !== "mahasiswa" && accessibleLabIds
      ? accessibleLabIds.length > 0
        ? inArray(labs.id, accessibleLabIds)
        : sql`false`
      : undefined

  const [labRows, requesterRows, toolRows, consumableRows, matrixRows, stepRows, approverRows] = await Promise.all([
    db
      .select({ id: labs.id, name: labs.name })
      .from(labs)
      .where(labScopeWhere)
      .orderBy(asc(labs.name)),
    role === "mahasiswa"
      ? db
          .select({ id: users.id, fullName: users.fullName, nim: users.nim })
          .from(users)
          .where(eq(users.id, userId))
      : db
          .select({ id: users.id, fullName: users.fullName, nim: users.nim })
          .from(users)
          .where(and(eq(users.role, "mahasiswa"), eq(users.isActive, true)))
          .orderBy(asc(users.fullName)),
    db
      .select({
        id: toolAssets.id,
        modelId: toolModels.id,
        modelCode: toolModels.code,
        assetCode: toolAssets.assetCode,
        toolName: toolModels.name,
        labId: toolModels.labId,
        labName: labs.name,
      })
      .from(toolAssets)
      .innerJoin(toolModels, eq(toolModels.id, toolAssets.toolModelId))
      .innerJoin(labs, eq(labs.id, toolModels.labId))
      .where(
        and(
          eq(toolAssets.status, "available"),
          role !== "admin" && role !== "mahasiswa" && accessibleLabIds
            ? accessibleLabIds.length > 0
              ? inArray(toolModels.labId, accessibleLabIds)
              : sql`false`
            : undefined,
        ),
      )
      .orderBy(asc(labs.name), asc(toolModels.name), asc(toolAssets.assetCode)),
    db
      .select({
        id: consumableItems.id,
        name: consumableItems.name,
        code: consumableItems.code,
        labId: consumableItems.labId,
        labName: labs.name,
        stockQty: consumableItems.stockQty,
        unit: consumableItems.unit,
      })
      .from(consumableItems)
      .innerJoin(labs, eq(labs.id, consumableItems.labId))
      .where(
        role !== "admin" && role !== "mahasiswa" && accessibleLabIds
          ? accessibleLabIds.length > 0
            ? inArray(consumableItems.labId, accessibleLabIds)
            : sql`false`
          : undefined,
      )
      .orderBy(asc(labs.name), asc(consumableItems.name)),
    db
      .select({
        id: borrowingApprovalMatrices.id,
        labId: borrowingApprovalMatrices.labId,
        isActive: borrowingApprovalMatrices.isActive,
      })
      .from(borrowingApprovalMatrices)
      .innerJoin(labs, eq(labs.id, borrowingApprovalMatrices.labId))
      .where(labScopeWhere),
    db
      .select({
        matrixId: borrowingApprovalMatrixSteps.matrixId,
        stepOrder: borrowingApprovalMatrixSteps.stepOrder,
        approverRole: borrowingApprovalMatrixSteps.approverRole,
      })
      .from(borrowingApprovalMatrixSteps)
      .innerJoin(borrowingApprovalMatrices, eq(borrowingApprovalMatrices.id, borrowingApprovalMatrixSteps.matrixId))
      .innerJoin(labs, eq(labs.id, borrowingApprovalMatrices.labId))
      .where(labScopeWhere),
    db
      .select({
        labId: userLabAssignments.labId,
        role: users.role,
        id: users.id,
        fullName: users.fullName,
        nip: users.nip,
      })
      .from(userLabAssignments)
      .innerJoin(users, eq(users.id, userLabAssignments.userId))
      .innerJoin(labs, eq(labs.id, userLabAssignments.labId))
      .where(and(inArray(users.role, ["dosen", "petugas_plp"]), eq(users.isActive, true), labScopeWhere))
      .orderBy(asc(users.fullName)),
  ])

  const labsOptions: BorrowingCreateLabOption[] = labRows.map((row) => ({ id: row.id, name: row.name }))
  const requesterOptions: BorrowingCreateRequesterOption[] = requesterRows.map((row) => ({
    id: row.id,
    label: row.nim ? `${row.fullName} (${row.nim})` : row.fullName,
  }))
  const toolOptions: BorrowingCreateToolOption[] = toolRows.map((row) => ({
    id: row.id,
    modelId: row.modelId,
    modelCode: row.modelCode,
    labId: row.labId,
    label: `${row.toolName} - ${row.assetCode} - ${row.labName}`,
  }))
  const consumableOptions: BorrowingCreateConsumableOption[] = consumableRows.map((row) => ({
    id: row.id,
    labId: row.labId,
    label: `${row.name} - ${row.labName} (stok ${row.stockQty} ${row.unit})`,
    stockQty: row.stockQty,
    unit: row.unit,
  }))

  const matrixByLab = new Map(matrixRows.map((row) => [row.labId, row]))
  const stepsByMatrix = new Map<
    string,
    Array<{ stepOrder: number; approverRole: "dosen" | "petugas_plp" | "admin" | "mahasiswa" }>
  >()
  for (const row of stepRows) {
    const list = stepsByMatrix.get(row.matrixId) ?? []
    list.push({ stepOrder: row.stepOrder, approverRole: row.approverRole })
    stepsByMatrix.set(row.matrixId, list)
  }

  const approversByLab = new Map<
    string,
    {
      dosen: Array<{ id: string; name: string; identifier: string | null }>
      plp: Array<{ id: string; name: string; identifier: string | null }>
    }
  >()
  for (const row of approverRows) {
    const bucket = approversByLab.get(row.labId) ?? { dosen: [], plp: [] }
    if (row.role === "dosen") {
      bucket.dosen.push({ id: row.id, name: row.fullName, identifier: row.nip })
    }
    if (row.role === "petugas_plp") {
      bucket.plp.push({ id: row.id, name: row.fullName, identifier: row.nip })
    }
    approversByLab.set(row.labId, bucket)
  }

  const approvalRoutes: BorrowingCreateApprovalRouteOption[] = labsOptions.map((lab) => {
    const matrix = matrixByLab.get(lab.id)
    const steps = matrix ? stepsByMatrix.get(matrix.id) ?? [] : []
    const step1Role = steps.find((item) => item.stepOrder === 1)?.approverRole
    const step2Role = steps.find((item) => item.stepOrder === 2)?.approverRole
    const approvers = approversByLab.get(lab.id) ?? { dosen: [], plp: [] }
    const matrixValid = step1Role === "dosen" && step2Role === "petugas_plp"
    const isReady = Boolean(matrix?.isActive && matrixValid && approvers.dosen.length > 0 && approvers.plp.length > 0)
    return {
      labId: lab.id,
      matrixActive: matrix?.isActive ?? false,
      matrixValid,
      isReady,
      step1Role: step1Role === "dosen" ? "dosen" : null,
      step2Role: step2Role === "petugas_plp" ? "petugas_plp" : null,
      dosenApprovers: approvers.dosen,
      plpApprovers: approvers.plp,
    }
  })

  return { labsOptions, requesterOptions, toolOptions, consumableOptions, approvalRoutes }
}

export default async function BorrowingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) {
    redirect("/")
  }

  const role = session.user.role as Role
  const currentUserId = session.user.id

  const sp = (await searchParams) ?? {}
  const pageParam = Array.isArray(sp.page) ? sp.page[0] : sp.page
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1)
  const statusParamRaw = Array.isArray(sp.status) ? sp.status[0] : sp.status
  const scopeParamRaw = Array.isArray(sp.scope) ? sp.scope[0] : sp.scope
  const statusParam = ([
    "all",
    "pending",
    "approved_waiting_handover",
    "active",
    "partially_returned",
    "overdue",
    "completed",
    "rejected",
    "cancelled",
  ] as const).includes((statusParamRaw ?? "all") as BorrowingPageStatusFilter)
    ? ((statusParamRaw ?? "all") as BorrowingPageStatusFilter)
    : "all"
  const defaultScope: BorrowingPageScopeFilter =
    role === "petugas_plp" || role === "dosen" ? "waiting_me" : role === "mahasiswa" ? "mine" : "all"
  const scopeCandidate = (scopeParamRaw ?? defaultScope) as BorrowingPageScopeFilter
  const scopeParam: BorrowingPageScopeFilter = ["all", "mine", "my_labs", "waiting_me"].includes(scopeCandidate)
    ? scopeCandidate
    : defaultScope

  const { rows, details, accessibleLabIds, pagination, activeFilters } = await getBorrowingData(
    role,
    currentUserId,
    page,
    20,
    { status: statusParam, scope: scopeParam },
  )
  const options = await getCreateOptions(role, currentUserId, accessibleLabIds)
  const prefill = {
    openCreate: sp.openCreate === "1",
    labId: typeof sp.labId === "string" ? sp.labId : undefined,
    toolModelCode: typeof sp.toolModelCode === "string" ? sp.toolModelCode : undefined,
  }

  return (
    <BorrowingPageClient
      role={role}
      currentUserId={currentUserId}
      accessibleLabIds={accessibleLabIds}
      rows={rows}
      details={details}
      createOptions={{
        labs: options.labsOptions,
        requesters: options.requesterOptions,
        tools: options.toolOptions,
        consumables: options.consumableOptions,
        approvalRoutes: options.approvalRoutes,
      }}
      pagination={pagination}
      initialListFilters={activeFilters}
      prefill={prefill}
    />
  )
}

