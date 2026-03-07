import { redirect } from "next/navigation"
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm"

import {
  type BorrowingCreateApprovalRouteOption,
  BorrowingPageClient,
  type BorrowingCreateLabOption,
  type BorrowingCreateRequesterOption,
  type BorrowingDetail,
  type BorrowingListRow,
} from "@/components/borrowing/borrowing-page-client"
import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import {
  borrowingApprovals,
  borrowingApprovalMatrices,
  borrowingReturns,
  borrowingTransactionItems,
  borrowingTransactions,
  labs,
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

function getMatrixRequiredApprover(input: {
  approvalsCount: number
  transactionStep1ApproverUserId: string | null
  matrixId: string | null
  matrixById: Map<
    string,
    {
      id: string
      step1ApproverUserId: string | null
    }
  >
}) {
  if (!input.matrixId) return null
  const matrix = input.matrixById.get(input.matrixId)
  if (!matrix) return null
  if (input.approvalsCount <= 0) {
    return {
      stepOrder: 1 as const,
      approverUserId: input.transactionStep1ApproverUserId ?? matrix.step1ApproverUserId,
    }
  }
  if (input.approvalsCount === 1) {
    return { stepOrder: 2 as const, approverUserId: null }
  }
  return null
}

function isValidDateValue(date: unknown): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime())
}

function fmtDate(date: Date | null) {
  if (!isValidDateValue(date)) return null
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date)
}

function fmtDateTime(date: Date | null) {
  if (!isValidDateValue(date)) return null
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date)
}

function getDisplayBorrowAt(input: {
  status: ReturnType<typeof mapBorrowingDisplayStatus>
  plannedBorrowAt: Date | null
  handedOverAt: Date | null
}) {
  if (["active", "overdue", "partially_returned", "completed"].includes(input.status) && input.handedOverAt) {
    return input.handedOverAt
  }
  return input.plannedBorrowAt ?? input.handedOverAt
}

function getDisplayReturnAt(input: {
  status: ReturnType<typeof mapBorrowingDisplayStatus>
  plannedReturnAt: Date | null
  latestReturnedAt: Date | null
}) {
  if (input.status === "completed" && input.latestReturnedAt) {
    return input.latestReturnedAt
  }
  return input.plannedReturnAt
}

function mapBorrowingDisplayStatus(input: {
  status: typeof borrowingTransactions.$inferSelect.status
  dueDate: Date | null
}) {
  const now = Date.now()
  const base = input.status
  if (
    (base === "active" || base === "partially_returned") &&
    isValidDateValue(input.dueDate) &&
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
  step1ApproverName: string | null
  step2PoolReady: boolean
}): PendingApprovalInfo | null {
  if (input.status !== "pending") return null
  if (!input.matrixId) return { label: "Matrix approval belum dipasang", approvers: [], triage: "blocked_matrix" }
  if (!input.step1ApproverName || !input.step2PoolReady) {
    return { label: "Matrix approval tidak valid", approvers: [], triage: "blocked_matrix" }
  }

  if (input.approvalsCount <= 0) {
    return { label: "Tahap 1: Dosen", approvers: [input.step1ApproverName], triage: "step1_ready" }
  }
  if (input.approvalsCount === 1) {
    return { label: "Tahap 2: Petugas PLP", approvers: ["Petugas PLP (sesuai assignment lab)"], triage: "step2_ready" }
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
  filters: {
    status: BorrowingPageStatusFilter
    scope: BorrowingPageScopeFilter
    studyProgram: "all" | "Sanitasi" | "Sanitasi Lingkungan"
    courseName: string
  },
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
            ? role === "dosen"
              ? and(
                  inArray(borrowingTransactions.status, ["submitted", "pending_approval"]),
                  sql`${borrowingTransactions.approvalMatrixId} is not null`,
                  sql`not exists (
                    select 1
                    from borrowing_approvals ba_self
                    where ba_self.transaction_id = ${borrowingTransactions.id}
                      and ba_self.approver_user_id = ${userId}
                  )`,
                  sql`(
                    select count(*)
                    from borrowing_approvals ba_ok
                    where ba_ok.transaction_id = ${borrowingTransactions.id}
                      and ba_ok.decision = 'approved'
                  ) = 0`,
                  sql`exists (
                    select 1 from borrowing_approval_matrices bam
                    where bam.id = ${borrowingTransactions.approvalMatrixId}
                      and coalesce(${borrowingTransactions.step1ApproverUserId}, bam.step1_approver_user_id) = ${userId}
                  )`,
                )
              : or(
                  and(
                    inArray(borrowingTransactions.status, ["submitted", "pending_approval"]),
                    sql`${borrowingTransactions.approvalMatrixId} is not null`,
                    sql`not exists (
                      select 1
                      from borrowing_approvals ba_self
                      where ba_self.transaction_id = ${borrowingTransactions.id}
                        and ba_self.approver_user_id = ${userId}
                    )`,
                    sql`(
                      select count(*)
                      from borrowing_approvals ba_ok
                      where ba_ok.transaction_id = ${borrowingTransactions.id}
                        and ba_ok.decision = 'approved'
                    ) = 1`,
                    sql`exists (
                      select 1
                      from user_lab_assignments ula
                      inner join users u on u.id = ula.user_id
                      where ula.lab_id = ${borrowingTransactions.labId}
                        and ula.user_id = ${userId}
                        and u.role = 'petugas_plp'
                    )`,
                  ),
                  and(
                    eq(borrowingTransactions.status, "approved_waiting_handover"),
                    accessibleLabIds && accessibleLabIds.length > 0
                      ? inArray(borrowingTransactions.labId, accessibleLabIds)
                      : sql`false`,
                  ),
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

  const studyProgramWhere =
    filters.studyProgram === "all"
      ? undefined
      : eq(borrowingTransactions.studyProgram, filters.studyProgram)
  const courseNameWhere = filters.courseName.trim()
    ? ilike(borrowingTransactions.courseName, `%${filters.courseName.trim()}%`)
    : undefined

  const finalWhere = and(roleBaseWhere, scopeWhere, statusWhere, studyProgramWhere, courseNameWhere)
  const shouldApplyPendingTriageSort = filters.status === "pending" || filters.scope === "waiting_me"
  const pendingTriageRank = sql<number>`
    case
      when ${borrowingTransactions.status} in ('submitted', 'pending_approval') then
        case
          when ${borrowingTransactions.approvalMatrixId} is null then 90
          when not exists (
            select 1 from borrowing_approval_matrices bam
            where bam.id = ${borrowingTransactions.approvalMatrixId}
              and coalesce(${borrowingTransactions.step1ApproverUserId}, bam.step1_approver_user_id) is not null
          ) then 90
          when not exists (
            select 1 from borrowing_approval_matrices bam
            where bam.id = ${borrowingTransactions.approvalMatrixId}
              and exists (
                select 1
                from user_lab_assignments ula
                inner join users u on u.id = ula.user_id
                where ula.lab_id = bam.lab_id
                  and u.role = 'petugas_plp'
              )
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
      studyProgram: borrowingTransactions.studyProgram,
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
      plannedBorrowAt: borrowingTransactions.plannedBorrowAt,
      plannedReturnAt: borrowingTransactions.plannedReturnAt,
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

  const [itemRows, approvalRows, matrixRowsForTx, plpAssignedLabRows, returnSummaryRows] = await Promise.all([
    db
      .select({
        transactionId: borrowingTransactionItems.transactionId,
        itemId: borrowingTransactionItems.id,
      })
      .from(borrowingTransactionItems)
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
        id: borrowingApprovalMatrices.id,
        step1ApproverUserId: borrowingApprovalMatrices.step1ApproverUserId,
        labId: borrowingApprovalMatrices.labId,
      })
      .from(borrowingApprovalMatrices)
      .where(
        (() => {
          const matrixIds = txRows
            .map((row) => row.approvalMatrixId)
            .filter((value): value is string => Boolean(value))
          return matrixIds.length > 0 ? inArray(borrowingApprovalMatrices.id, matrixIds) : sql`false`
        })(),
      ),
    db
      .select({
        labId: userLabAssignments.labId,
      })
      .from(userLabAssignments)
      .innerJoin(users, eq(users.id, userLabAssignments.userId))
      .where(eq(users.role, "petugas_plp"))
      .groupBy(userLabAssignments.labId),
    db
      .select({
        transactionId: borrowingReturns.transactionId,
        latestReturnedAt: sql<Date | null>`max(${borrowingReturns.returnedAt})`,
      })
      .from(borrowingReturns)
      .where(inArray(borrowingReturns.transactionId, txIds))
      .groupBy(borrowingReturns.transactionId),
  ])

  const approverIds = Array.from(
    new Set(
      [
        ...txRows.map((row) => row.step1ApproverUserId),
        ...matrixRowsForTx.map((row) => row.step1ApproverUserId),
      ].filter((value): value is string => Boolean(value)),
    ),
  )
  const approverUserRows =
    approverIds.length > 0
      ? await db
          .select({
            id: users.id,
            fullName: users.fullName,
          })
          .from(users)
          .where(and(inArray(users.id, approverIds), eq(users.isActive, true)))
      : []

  const txIdSet = new Set(txRows.map((row) => row.id))
  const itemCountByTx = new Map<string, number>()
  for (const row of itemRows) {
    if (!txIdSet.has(row.transactionId)) continue
    itemCountByTx.set(row.transactionId, (itemCountByTx.get(row.transactionId) ?? 0) + 1)
  }

  const approvalCountByTx = new Map(approvalRows.map((r) => [r.transactionId, Number(r.count)]))
  const matrixById = new Map(matrixRowsForTx.map((row) => [row.id, row]))
  const plpAssignedLabSet = new Set(plpAssignedLabRows.map((row) => row.labId))
  const userById = new Map(approverUserRows.map((row) => [row.id, row.fullName]))
  const latestReturnedAtByTx = new Map(returnSummaryRows.map((row) => [row.transactionId, row.latestReturnedAt]))
  const rows: BorrowingListRow[] = txRows.map((row) => {
    const status = mapBorrowingDisplayStatus({ status: row.status, dueDate: row.dueDate })
    const displayBorrowAt = getDisplayBorrowAt({
      status,
      plannedBorrowAt: row.plannedBorrowAt,
      handedOverAt: row.handedOverAt,
    })
    const displayReturnAt = getDisplayReturnAt({
      status,
      plannedReturnAt: row.plannedReturnAt,
      latestReturnedAt: latestReturnedAtByTx.get(row.id) ?? null,
    })
    const matrix = row.approvalMatrixId ? matrixById.get(row.approvalMatrixId) : undefined
    const requiredApprover = getMatrixRequiredApprover({
      approvalsCount: approvalCountByTx.get(row.id) ?? 0,
      transactionStep1ApproverUserId: row.step1ApproverUserId,
      matrixId: row.approvalMatrixId,
      matrixById,
    })
    const requiredApproverName =
      requiredApprover?.stepOrder === 2
        ? "Petugas PLP (sesuai assignment lab)"
        : requiredApprover?.approverUserId
          ? userById.get(requiredApprover.approverUserId) ?? null
          : null
    const adminOverrideReasonRequired =
      role === "admin" &&
      status === "pending" &&
      ((requiredApprover?.stepOrder === 2) ||
        (!!requiredApprover?.approverUserId && requiredApprover.approverUserId !== userId))
    const pendingApproval = getPendingApprovalInfo({
      status,
      approvalsCount: approvalCountByTx.get(row.id) ?? 0,
      matrixId: row.approvalMatrixId,
      step1ApproverName:
        (row.step1ApproverUserId ? userById.get(row.step1ApproverUserId) ?? null : null) ??
        (matrix?.step1ApproverUserId ? userById.get(matrix.step1ApproverUserId) ?? null : null),
      step2PoolReady: Boolean(matrix?.labId && plpAssignedLabSet.has(matrix.labId)),
    })
    return {
      id: row.id,
      code: row.code,
      labId: row.labId,
      requesterUserId: row.requesterUserId,
      createdByUserId: row.createdByUserId,
      borrower: row.requesterName,
      nim: row.requesterNim,
      borrowDate: fmtDateTime(displayBorrowAt),
      dueDate: fmtDateTime(displayReturnAt),
      status,
      purpose: row.purpose,
      studyProgram: row.studyProgram,
      courseName: row.courseName,
      materialTopic: row.materialTopic,
      semesterLabel: row.semesterLabel,
      groupName: row.groupName,
      advisorLecturerName: row.advisorLecturerName,
      itemCount: itemCountByTx.get(row.id) ?? 0,
      pendingApprovalLabel: pendingApproval?.label ?? null,
      pendingApprovalApprovers: pendingApproval?.approvers ?? [],
      pendingApprovalTriage: pendingApproval?.triage ?? null,
      pendingRequiredApproverName: requiredApproverName,
      adminOverrideReasonRequired,
    }
  })

  return {
    rows,
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

async function getCreateOptions(role: Role, userId: string, accessibleLabIds: string[] | null) {
  if (role === "dosen") {
    return {
      labsOptions: [] as BorrowingCreateLabOption[],
      requesterOptions: [] as BorrowingCreateRequesterOption[],
      approvalRoutes: [] as BorrowingCreateApprovalRouteOption[],
    }
  }

  const labScopeWhere =
    role !== "admin" && role !== "mahasiswa" && accessibleLabIds
      ? accessibleLabIds.length > 0
        ? inArray(labs.id, accessibleLabIds)
        : sql`false`
      : undefined

  const [labRows, requesterRows, matrixRows] = await Promise.all([
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
        id: borrowingApprovalMatrices.id,
        labId: borrowingApprovalMatrices.labId,
        isActive: borrowingApprovalMatrices.isActive,
        step1ApproverUserId: borrowingApprovalMatrices.step1ApproverUserId,
      })
      .from(borrowingApprovalMatrices)
      .innerJoin(labs, eq(labs.id, borrowingApprovalMatrices.labId))
      .where(labScopeWhere),
  ])

  const labsOptions: BorrowingCreateLabOption[] = labRows.map((row) => ({ id: row.id, name: row.name }))
  const requesterOptions: BorrowingCreateRequesterOption[] = requesterRows.map((row) => ({
    id: row.id,
    label: row.nim ? `${row.fullName} (${row.nim})` : row.fullName,
  }))
  const matrixByLab = new Map(matrixRows.map((row) => [row.labId, row]))

  const dosenRows =
    labsOptions.length > 0
      ? await db
          .select({
            labId: userLabAssignments.labId,
            id: users.id,
            fullName: users.fullName,
            nip: users.nip,
          })
          .from(userLabAssignments)
          .innerJoin(users, eq(users.id, userLabAssignments.userId))
          .where(
            and(
              inArray(userLabAssignments.labId, labsOptions.map((lab) => lab.id)),
              eq(users.role, "dosen"),
              eq(users.isActive, true),
            ),
          )
          .orderBy(asc(users.fullName))
      : []
  const dosenByLab = new Map<string, Array<{ id: string; name: string; identifier: string | null }>>()
  for (const row of dosenRows) {
    const list = dosenByLab.get(row.labId) ?? []
    list.push({ id: row.id, name: row.fullName, identifier: row.nip })
    dosenByLab.set(row.labId, list)
  }

  const plpRows =
    labsOptions.length > 0
      ? await db
          .select({
            labId: userLabAssignments.labId,
            id: users.id,
            fullName: users.fullName,
            nip: users.nip,
          })
          .from(userLabAssignments)
          .innerJoin(users, eq(users.id, userLabAssignments.userId))
          .where(
            and(
              inArray(userLabAssignments.labId, labsOptions.map((lab) => lab.id)),
              eq(users.role, "petugas_plp"),
              eq(users.isActive, true),
            ),
          )
          .orderBy(asc(users.fullName))
      : []
  const plpByLab = new Map<string, Array<{ id: string; name: string; identifier: string | null }>>()
  for (const row of plpRows) {
    const list = plpByLab.get(row.labId) ?? []
    list.push({ id: row.id, name: row.fullName, identifier: row.nip })
    plpByLab.set(row.labId, list)
  }

  const approvalRoutes: BorrowingCreateApprovalRouteOption[] = labsOptions.map((lab) => {
    const matrix = matrixByLab.get(lab.id)
    const mappedDosen = dosenByLab.get(lab.id) ?? []
    const mappedPlp = plpByLab.get(lab.id) ?? []
    const matrixValid = mappedPlp.length > 0
    const isReady = Boolean(matrix?.isActive && matrixValid && mappedDosen.length > 0)
    return {
      labId: lab.id,
      matrixActive: matrix?.isActive ?? false,
      matrixValid,
      isReady,
      step1Role: mappedDosen.length > 0 ? "dosen" : null,
      step2Role: mappedPlp.length > 0 ? "petugas_plp" : null,
      dosenApprovers: mappedDosen,
      plpApprovers: mappedPlp,
    }
  })

  return { labsOptions, requesterOptions, approvalRoutes }
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
  const studyProgramParamRaw = Array.isArray(sp.studyProgram) ? sp.studyProgram[0] : sp.studyProgram
  const courseNameParamRaw = Array.isArray(sp.courseName) ? sp.courseName[0] : sp.courseName
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
  const defaultScope: BorrowingPageScopeFilter = "all"
  const scopeCandidate = (scopeParamRaw ?? defaultScope) as BorrowingPageScopeFilter
  const scopeParam: BorrowingPageScopeFilter = ["all", "mine", "my_labs", "waiting_me"].includes(scopeCandidate)
    ? scopeCandidate
    : defaultScope
  const studyProgramParam = (["all", "Sanitasi", "Sanitasi Lingkungan"] as const).includes(
    (studyProgramParamRaw ?? "all") as "all" | "Sanitasi" | "Sanitasi Lingkungan",
  )
    ? ((studyProgramParamRaw ?? "all") as "all" | "Sanitasi" | "Sanitasi Lingkungan")
    : "all"
  const courseNameParam = (courseNameParamRaw ?? "").trim()

  const { rows, details, accessibleLabIds, pagination, activeFilters } = await getBorrowingData(
    role,
    currentUserId,
    page,
    20,
    { status: statusParam, scope: scopeParam, studyProgram: studyProgramParam, courseName: courseNameParam },
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
        approvalRoutes: options.approvalRoutes,
      }}
      pagination={pagination}
      initialListFilters={activeFilters}
      prefill={prefill}
    />
  )
}
