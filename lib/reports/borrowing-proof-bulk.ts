import "server-only"

import { and, asc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm"

import { db } from "@/lib/db/client"
import {
  borrowingApprovals,
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
import type { BorrowingReportFilters, ReportRole } from "@/lib/reports/borrowing-report"

export const BORROWING_PROOF_BULK_LIMIT = 50

export type BorrowingProofBulkItem = {
  id: string
  toolName: string
  assetCode: string
  qty: number
  returnCondition: "baik" | "maintenance" | "damaged" | null
}

export type BorrowingProofBulkApproval = {
  decision: "approved" | "rejected"
  note: string | null
  decidedAt: Date
  approverName: string
  approverRole: "admin" | "mahasiswa" | "petugas_plp" | "dosen"
}

export type BorrowingProofBulkTransaction = {
  id: string
  code: string
  requesterName: string
  requesterNim: string | null
  labName: string
  purpose: string
  studyProgram: string
  courseName: string
  materialTopic: string
  semesterLabel: string
  groupName: string
  advisorLecturerName: string | null
  status: string
  plannedBorrowAt: Date | null
  plannedReturnAt: Date | null
  handedOverAt: Date | null
  dueDate: Date | null
  latestReturnedAt: Date | null
  items: BorrowingProofBulkItem[]
  approvals: BorrowingProofBulkApproval[]
}

export type ConsumableRequestProofBulkItem = {
  id: string
  consumableName: string
  consumableUnit: string | null
  qty: number
}

export type ConsumableRequestProofBulkTransaction = {
  id: string
  code: string
  requesterName: string
  requesterNim: string | null
  labName: string
  purpose: string
  studyProgram: string
  courseName: string
  materialTopic: string
  semesterLabel: string
  groupName: string
  requestedAt: Date
  plannedBorrowAt: Date | null
  plannedReturnAt: Date | null
  items: ConsumableRequestProofBulkItem[]
}

function parseWibBoundary(value: string, endOfDay: boolean) {
  if (!value) return undefined
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function getDisplayStatus(status: string, dueDate: Date | null) {
  if ((status === "active" || status === "partially_returned") && dueDate && dueDate.getTime() < Date.now()) {
    return "overdue"
  }
  return status === "submitted" || status === "pending_approval" ? "pending" : status
}

export function getBulkBorrowAt(input: {
  status: string
  plannedBorrowAt: Date | null
  handedOverAt: Date | null
}) {
  if (["active", "overdue", "partially_returned", "completed"].includes(input.status) && input.handedOverAt) {
    return input.handedOverAt
  }
  return input.plannedBorrowAt ?? input.handedOverAt
}

export function getBulkReturnAt(input: {
  status: string
  plannedReturnAt: Date | null
  latestReturnedAt: Date | null
}) {
  if (input.status === "completed" && input.latestReturnedAt) return input.latestReturnedAt
  return input.plannedReturnAt
}

export async function getBorrowingProofBulkData(input: {
  role: ReportRole
  userId: string
  filters: BorrowingReportFilters
  limit?: number
}) {
  const { role, userId, filters } = input
  const limit = input.limit ?? BORROWING_PROOF_BULK_LIMIT
  const assignedLabIds: string[] =
    role === "petugas_plp"
      ? (
          await db
            .select({ labId: userLabAssignments.labId })
            .from(userLabAssignments)
            .where(eq(userLabAssignments.userId, userId))
        ).map((row) => row.labId)
      : []

  const conditions = [] as Array<
    | ReturnType<typeof eq>
    | ReturnType<typeof inArray>
    | ReturnType<typeof gte>
    | ReturnType<typeof lte>
    | ReturnType<typeof ilike>
    | ReturnType<typeof or>
    | ReturnType<typeof sql>
  >
  if (role === "petugas_plp") {
    conditions.push(assignedLabIds.length > 0 ? inArray(borrowingTransactions.labId, assignedLabIds) : sql`false`)
  }
  if (filters.scope === "mine") {
    conditions.push(or(eq(borrowingTransactions.requesterUserId, userId), eq(borrowingTransactions.createdByUserId, userId)))
  }
  if (filters.scope === "waiting_me" && role === "petugas_plp") {
    conditions.push(
      and(
        inArray(borrowingTransactions.status, ["submitted", "pending_approval"]),
        sql`not exists (
          select 1 from borrowing_approvals ba_self
          where ba_self.transaction_id = ${borrowingTransactions.id}
            and ba_self.approval_round = ${borrowingTransactions.approvalRound}
            and ba_self.approver_user_id = ${userId}
        )`,
        sql`(
          select count(*) from borrowing_approvals ba_ok
          where ba_ok.transaction_id = ${borrowingTransactions.id}
            and ba_ok.approval_round = ${borrowingTransactions.approvalRound}
            and ba_ok.decision = 'approved'
        ) = 1`,
      ),
    )
  }
  if (filters.status !== "all") {
    if (filters.status === "pending") {
      conditions.push(inArray(borrowingTransactions.status, ["submitted", "pending_approval"]))
    } else if (filters.status === "overdue") {
      conditions.push(
        and(
          inArray(borrowingTransactions.status, ["active", "partially_returned"]),
          sql`${borrowingTransactions.dueDate} is not null`,
          sql`${borrowingTransactions.dueDate} < now()`,
        ),
      )
    } else {
      conditions.push(eq(borrowingTransactions.status, filters.status as typeof borrowingTransactions.$inferSelect.status))
    }
  }
  if (filters.studyProgram !== "all") conditions.push(eq(borrowingTransactions.studyProgram, filters.studyProgram))
  if (filters.courseName) conditions.push(ilike(borrowingTransactions.courseName, `%${filters.courseName}%`))

  const startAt = parseWibBoundary(filters.startDate, false)
  const endAt = parseWibBoundary(filters.endDate, true)
  if (startAt) conditions.push(gte(borrowingTransactions.plannedReturnAt, startAt))
  if (endAt) conditions.push(lte(borrowingTransactions.plannedBorrowAt, endAt))

  conditions.push(sql`exists (
    select 1 from borrowing_transaction_items bti_tool
    where bti_tool.transaction_id = ${borrowingTransactions.id}
      and bti_tool.item_type = 'tool_asset'
  )`)

  const where = and(...conditions)
  const txRows = await db
    .select({
      id: borrowingTransactions.id,
      code: borrowingTransactions.code,
      requesterName: users.fullName,
      requesterNim: users.nim,
      labName: labs.name,
      purpose: borrowingTransactions.purpose,
      studyProgram: borrowingTransactions.studyProgram,
      courseName: borrowingTransactions.courseName,
      materialTopic: borrowingTransactions.materialTopic,
      semesterLabel: borrowingTransactions.semesterLabel,
      groupName: borrowingTransactions.groupName,
      advisorLecturerName: borrowingTransactions.advisorLecturerName,
      status: borrowingTransactions.status,
      approvalRound: borrowingTransactions.approvalRound,
      plannedBorrowAt: borrowingTransactions.plannedBorrowAt,
      plannedReturnAt: borrowingTransactions.plannedReturnAt,
      handedOverAt: borrowingTransactions.handedOverAt,
      dueDate: borrowingTransactions.dueDate,
    })
    .from(borrowingTransactions)
    .innerJoin(users, eq(users.id, borrowingTransactions.requesterUserId))
    .innerJoin(labs, eq(labs.id, borrowingTransactions.labId))
    .where(where)
    .orderBy(asc(borrowingTransactions.plannedBorrowAt), asc(borrowingTransactions.code))
    .limit(limit + 1)

  const limitedRows = txRows.slice(0, limit)
  const txIds = limitedRows.map((row) => row.id)
  if (txIds.length === 0) return { rows: [] as BorrowingProofBulkTransaction[], truncated: false, limit }

  const [itemRows, approvalRows, returnRows] = await Promise.all([
    db
      .select({
        transactionId: borrowingTransactionItems.transactionId,
        id: borrowingTransactionItems.id,
        qty: borrowingTransactionItems.qtyRequested,
        toolName: toolModels.name,
        assetCode: toolAssets.assetCode,
      })
      .from(borrowingTransactionItems)
      .innerJoin(toolAssets, eq(toolAssets.id, borrowingTransactionItems.toolAssetId))
      .innerJoin(toolModels, eq(toolModels.id, toolAssets.toolModelId))
      .where(and(inArray(borrowingTransactionItems.transactionId, txIds), eq(borrowingTransactionItems.itemType, "tool_asset")))
      .orderBy(asc(borrowingTransactionItems.createdAt)),
    db
      .select({
        transactionId: borrowingApprovals.transactionId,
        approvalRound: borrowingApprovals.approvalRound,
        decision: borrowingApprovals.decision,
        note: borrowingApprovals.note,
        decidedAt: borrowingApprovals.decidedAt,
        approverName: users.fullName,
        approverRole: users.role,
      })
      .from(borrowingApprovals)
      .innerJoin(users, eq(users.id, borrowingApprovals.approverUserId))
      .where(inArray(borrowingApprovals.transactionId, txIds))
      .orderBy(asc(borrowingApprovals.decidedAt)),
    db
      .select({
        transactionId: borrowingReturns.transactionId,
        transactionItemId: borrowingReturnItems.transactionItemId,
        returnedAt: borrowingReturns.returnedAt,
        returnCondition: borrowingReturnItems.returnCondition,
      })
      .from(borrowingReturnItems)
      .innerJoin(borrowingReturns, eq(borrowingReturns.id, borrowingReturnItems.returnId))
      .where(inArray(borrowingReturns.transactionId, txIds))
      .orderBy(asc(borrowingReturns.returnedAt)),
  ])

  const returnByItemId = new Map(returnRows.map((row) => [row.transactionItemId, row]))
  const itemsByTx = new Map<string, BorrowingProofBulkItem[]>()
  for (const item of itemRows) {
    const list = itemsByTx.get(item.transactionId) ?? []
    const returnInfo = returnByItemId.get(item.id)
    list.push({
      id: item.id,
      toolName: item.toolName,
      assetCode: item.assetCode,
      qty: item.qty,
      returnCondition: returnInfo?.returnCondition ?? null,
    })
    itemsByTx.set(item.transactionId, list)
  }

  const latestReturnByTx = new Map<string, Date | null>()
  for (const ret of returnRows) latestReturnByTx.set(ret.transactionId, ret.returnedAt)

  const roundByTx = new Map(limitedRows.map((row) => [row.id, row.approvalRound]))
  const approvalsByTx = new Map<string, BorrowingProofBulkApproval[]>()
  for (const approval of approvalRows) {
    if (approval.approvalRound !== roundByTx.get(approval.transactionId)) continue
    const list = approvalsByTx.get(approval.transactionId) ?? []
    list.push({
      decision: approval.decision,
      note: approval.note,
      decidedAt: approval.decidedAt,
      approverName: approval.approverName,
      approverRole: approval.approverRole,
    })
    approvalsByTx.set(approval.transactionId, list)
  }

  return {
    rows: limitedRows.map((row) => {
      const status = getDisplayStatus(row.status, row.dueDate)
      return {
        ...row,
        status,
        latestReturnedAt: latestReturnByTx.get(row.id) ?? null,
        items: itemsByTx.get(row.id) ?? [],
        approvals: approvalsByTx.get(row.id) ?? [],
      }
    }),
    truncated: txRows.length > limit,
    limit,
  }
}

export async function getConsumableRequestProofBulkData(input: {
  role: ReportRole
  userId: string
  filters: BorrowingReportFilters
  limit?: number
}) {
  const { role, userId, filters } = input
  const limit = input.limit ?? BORROWING_PROOF_BULK_LIMIT
  const assignedLabIds: string[] =
    role === "petugas_plp"
      ? (
          await db
            .select({ labId: userLabAssignments.labId })
            .from(userLabAssignments)
            .where(eq(userLabAssignments.userId, userId))
        ).map((row) => row.labId)
      : []

  const conditions = [] as Array<
    | ReturnType<typeof eq>
    | ReturnType<typeof inArray>
    | ReturnType<typeof gte>
    | ReturnType<typeof lte>
    | ReturnType<typeof ilike>
    | ReturnType<typeof or>
    | ReturnType<typeof sql>
  >
  if (role === "petugas_plp") {
    conditions.push(assignedLabIds.length > 0 ? inArray(borrowingTransactions.labId, assignedLabIds) : sql`false`)
  }
  if (filters.scope === "mine") {
    conditions.push(or(eq(borrowingTransactions.requesterUserId, userId), eq(borrowingTransactions.createdByUserId, userId)))
  }
  if (filters.scope === "waiting_me" && role === "petugas_plp") {
    conditions.push(
      and(
        inArray(borrowingTransactions.status, ["submitted", "pending_approval"]),
        sql`not exists (
          select 1 from borrowing_approvals ba_self
          where ba_self.transaction_id = ${borrowingTransactions.id}
            and ba_self.approval_round = ${borrowingTransactions.approvalRound}
            and ba_self.approver_user_id = ${userId}
        )`,
        sql`(
          select count(*) from borrowing_approvals ba_ok
          where ba_ok.transaction_id = ${borrowingTransactions.id}
            and ba_ok.approval_round = ${borrowingTransactions.approvalRound}
            and ba_ok.decision = 'approved'
        ) = 1`,
      ),
    )
  }
  if (filters.status !== "all") {
    if (filters.status === "pending") {
      conditions.push(inArray(borrowingTransactions.status, ["submitted", "pending_approval"]))
    } else if (filters.status === "overdue") {
      conditions.push(
        and(
          inArray(borrowingTransactions.status, ["active", "partially_returned"]),
          sql`${borrowingTransactions.dueDate} is not null`,
          sql`${borrowingTransactions.dueDate} < now()`,
        ),
      )
    } else {
      conditions.push(eq(borrowingTransactions.status, filters.status as typeof borrowingTransactions.$inferSelect.status))
    }
  }
  if (filters.studyProgram !== "all") conditions.push(eq(borrowingTransactions.studyProgram, filters.studyProgram))
  if (filters.courseName) conditions.push(ilike(borrowingTransactions.courseName, `%${filters.courseName}%`))

  const startAt = parseWibBoundary(filters.startDate, false)
  const endAt = parseWibBoundary(filters.endDate, true)
  if (startAt) conditions.push(gte(borrowingTransactions.plannedReturnAt, startAt))
  if (endAt) conditions.push(lte(borrowingTransactions.plannedBorrowAt, endAt))

  conditions.push(sql`exists (
    select 1 from borrowing_transaction_items bti_consumable
    where bti_consumable.transaction_id = ${borrowingTransactions.id}
      and bti_consumable.item_type = 'consumable'
  )`)

  const where = and(...conditions)
  const txRows = await db
    .select({
      id: borrowingTransactions.id,
      code: borrowingTransactions.code,
      requesterName: users.fullName,
      requesterNim: users.nim,
      labName: labs.name,
      purpose: borrowingTransactions.purpose,
      studyProgram: borrowingTransactions.studyProgram,
      courseName: borrowingTransactions.courseName,
      materialTopic: borrowingTransactions.materialTopic,
      semesterLabel: borrowingTransactions.semesterLabel,
      groupName: borrowingTransactions.groupName,
      requestedAt: borrowingTransactions.requestedAt,
      plannedBorrowAt: borrowingTransactions.plannedBorrowAt,
      plannedReturnAt: borrowingTransactions.plannedReturnAt,
    })
    .from(borrowingTransactions)
    .innerJoin(users, eq(users.id, borrowingTransactions.requesterUserId))
    .innerJoin(labs, eq(labs.id, borrowingTransactions.labId))
    .where(where)
    .orderBy(asc(borrowingTransactions.plannedBorrowAt), asc(borrowingTransactions.code))
    .limit(limit + 1)

  const limitedRows = txRows.slice(0, limit)
  const txIds = limitedRows.map((row) => row.id)
  if (txIds.length === 0) return { rows: [] as ConsumableRequestProofBulkTransaction[], truncated: false, limit }

  const itemRows = await db
    .select({
      transactionId: borrowingTransactionItems.transactionId,
      id: borrowingTransactionItems.id,
      qty: borrowingTransactionItems.qtyRequested,
      consumableName: consumableItems.name,
      consumableUnit: consumableItems.unit,
    })
    .from(borrowingTransactionItems)
    .innerJoin(consumableItems, eq(consumableItems.id, borrowingTransactionItems.consumableItemId))
    .where(and(inArray(borrowingTransactionItems.transactionId, txIds), eq(borrowingTransactionItems.itemType, "consumable")))
    .orderBy(asc(borrowingTransactionItems.createdAt))

  const itemsByTx = new Map<string, ConsumableRequestProofBulkItem[]>()
  for (const item of itemRows) {
    const list = itemsByTx.get(item.transactionId) ?? []
    list.push({
      id: item.id,
      consumableName: item.consumableName,
      consumableUnit: item.consumableUnit,
      qty: item.qty,
    })
    itemsByTx.set(item.transactionId, list)
  }

  return {
    rows: limitedRows.map((row) => ({
      ...row,
      items: itemsByTx.get(row.id) ?? [],
    })),
    truncated: txRows.length > limit,
    limit,
  }
}
