import "server-only"

import { and, asc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm"

import { db } from "@/lib/db/client"
import {
  borrowingHandovers,
  borrowingHandoverConsumableLines,
  borrowingTransactionItems,
  borrowingTransactions,
  consumableItems,
  labs,
  toolAssets,
  toolModels,
  userLabAssignments,
  users,
} from "@/lib/db/schema"

export type ReportRole = "admin" | "petugas_plp"

export type BorrowingReportFilters = {
  status: string
  scope: "all" | "mine" | "my_labs" | "waiting_me"
  studyProgram: "all" | "Sanitasi" | "Sanitasi Lingkungan"
  courseName: string
  startDate: string
  endDate: string
}

export type BorrowingReportData = {
  filters: BorrowingReportFilters
  periodLabel: string
  generatedAt: Date
  loans: Array<{
    code: string
    labName: string
    borrower: string
    nim: string | null
    studyProgram: string
    courseName: string
    materialTopic: string
    semesterLabel: string
    groupName: string
    advisorLecturerName: string | null
    purpose: string
    status: string
    plannedBorrowAt: Date | null
    plannedReturnAt: Date | null
    toolName: string
    assetCode: string
  }>
  consumableUsage: Array<{
    code: string
    labName: string
    borrower: string
    nim: string | null
    studyProgram: string
    courseName: string
    materialTopic: string
    semesterLabel: string
    groupName: string
    purpose: string
    status: string
    plannedBorrowAt: Date | null
    plannedReturnAt: Date | null
    handedOverAt: Date
    consumableName: string
    consumableCode: string
    unit: string
    qtyIssued: number
  }>
}

const validStatuses = new Set([
  "all",
  "pending",
  "approved_waiting_handover",
  "active",
  "partially_returned",
  "overdue",
  "completed",
  "rejected",
  "cancelled",
])

function getFirst(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? ""
}

function validDateInput(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""
}

export function getBorrowingReportFilters(input: Record<string, string | string[] | undefined>): BorrowingReportFilters {
  const status = getFirst(input.status)
  const scope = getFirst(input.scope)
  const studyProgram = getFirst(input.studyProgram)

  return {
    status: validStatuses.has(status) ? status : "all",
    scope: ["all", "mine", "my_labs", "waiting_me"].includes(scope)
      ? (scope as BorrowingReportFilters["scope"])
      : "all",
    studyProgram: ["Sanitasi", "Sanitasi Lingkungan"].includes(studyProgram)
      ? (studyProgram as BorrowingReportFilters["studyProgram"])
      : "all",
    courseName: getFirst(input.courseName).trim(),
    startDate: validDateInput(getFirst(input.startDate)),
    endDate: validDateInput(getFirst(input.endDate)),
  }
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

function getPeriodLabel(filters: BorrowingReportFilters) {
  if (filters.startDate && filters.endDate) return `${filters.startDate} s.d. ${filters.endDate}`
  if (filters.startDate) return `Mulai ${filters.startDate}`
  if (filters.endDate) return `Sampai ${filters.endDate}`
  return "Semua periode"
}

export async function getBorrowingReportData(input: {
  role: ReportRole
  userId: string
  filters: BorrowingReportFilters
}): Promise<BorrowingReportData> {
  const { role, userId, filters } = input
  const assignedLabIds: string[] =
    role === "petugas_plp"
      ? (
          await db
            .select({ labId: userLabAssignments.labId })
            .from(userLabAssignments)
            .where(eq(userLabAssignments.userId, userId))
        ).map((row) => row.labId)
      : []

  const conditions = [] as Array<ReturnType<typeof eq> | ReturnType<typeof inArray> | ReturnType<typeof gte> | ReturnType<typeof lte> | ReturnType<typeof ilike> | ReturnType<typeof or> | ReturnType<typeof sql>>
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
            and ba_self.approver_user_id = ${userId}
        )`,
        sql`(
          select count(*) from borrowing_approvals ba_ok
          where ba_ok.transaction_id = ${borrowingTransactions.id}
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
  // A transaction is included when its planned-use window overlaps the selected period.
  if (startAt) conditions.push(gte(borrowingTransactions.plannedReturnAt, startAt))
  if (endAt) conditions.push(lte(borrowingTransactions.plannedBorrowAt, endAt))

  const where = and(...conditions)
  const [loanRows, consumableRows] = await Promise.all([
    db
      .select({
        code: borrowingTransactions.code,
        labName: labs.name,
        borrower: users.fullName,
        nim: users.nim,
        studyProgram: borrowingTransactions.studyProgram,
        courseName: borrowingTransactions.courseName,
        materialTopic: borrowingTransactions.materialTopic,
        semesterLabel: borrowingTransactions.semesterLabel,
        groupName: borrowingTransactions.groupName,
        advisorLecturerName: borrowingTransactions.advisorLecturerName,
        purpose: borrowingTransactions.purpose,
        status: borrowingTransactions.status,
        dueDate: borrowingTransactions.dueDate,
        plannedBorrowAt: borrowingTransactions.plannedBorrowAt,
        plannedReturnAt: borrowingTransactions.plannedReturnAt,
        toolName: toolModels.name,
        assetCode: toolAssets.assetCode,
      })
      .from(borrowingTransactions)
      .innerJoin(users, eq(users.id, borrowingTransactions.requesterUserId))
      .innerJoin(labs, eq(labs.id, borrowingTransactions.labId))
      .innerJoin(borrowingTransactionItems, eq(borrowingTransactionItems.transactionId, borrowingTransactions.id))
      .innerJoin(toolAssets, eq(toolAssets.id, borrowingTransactionItems.toolAssetId))
      .innerJoin(toolModels, eq(toolModels.id, toolAssets.toolModelId))
      .where(and(where, eq(borrowingTransactionItems.itemType, "tool_asset")))
      .orderBy(asc(borrowingTransactions.plannedBorrowAt), asc(borrowingTransactions.code), asc(toolAssets.assetCode)),
    db
      .select({
        code: borrowingTransactions.code,
        labName: labs.name,
        borrower: users.fullName,
        nim: users.nim,
        studyProgram: borrowingTransactions.studyProgram,
        courseName: borrowingTransactions.courseName,
        materialTopic: borrowingTransactions.materialTopic,
        semesterLabel: borrowingTransactions.semesterLabel,
        groupName: borrowingTransactions.groupName,
        purpose: borrowingTransactions.purpose,
        status: borrowingTransactions.status,
        dueDate: borrowingTransactions.dueDate,
        plannedBorrowAt: borrowingTransactions.plannedBorrowAt,
        plannedReturnAt: borrowingTransactions.plannedReturnAt,
        handedOverAt: borrowingHandovers.handedOverAt,
        consumableName: consumableItems.name,
        consumableCode: consumableItems.code,
        unit: consumableItems.unit,
        qtyIssued: borrowingHandoverConsumableLines.qtyIssued,
      })
      .from(borrowingTransactions)
      .innerJoin(users, eq(users.id, borrowingTransactions.requesterUserId))
      .innerJoin(labs, eq(labs.id, borrowingTransactions.labId))
      .innerJoin(borrowingHandovers, eq(borrowingHandovers.transactionId, borrowingTransactions.id))
      .innerJoin(borrowingHandoverConsumableLines, eq(borrowingHandoverConsumableLines.handoverId, borrowingHandovers.id))
      .innerJoin(consumableItems, eq(consumableItems.id, borrowingHandoverConsumableLines.consumableItemId))
      .where(where)
      .orderBy(asc(borrowingTransactions.plannedBorrowAt), asc(borrowingTransactions.code), asc(consumableItems.name)),
  ])

  return {
    filters,
    periodLabel: getPeriodLabel(filters),
    generatedAt: new Date(),
    loans: loanRows.map((row) => ({ ...row, status: getDisplayStatus(row.status, row.dueDate) })),
    consumableUsage: consumableRows.map((row) => ({ ...row, status: getDisplayStatus(row.status, row.dueDate) })),
  }
}
