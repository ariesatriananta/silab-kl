import { and, eq, inArray, or, sql } from "drizzle-orm"
import { NextResponse } from "next/server"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import {
  borrowingTransactions,
  labRoomBookingRequests,
  userLabAssignments,
  userNotificationStates,
  users,
} from "@/lib/db/schema"

type ItemTone = "warning" | "danger" | "info" | "success"

type NotificationItem = {
  id: string
  title: string
  description: string
  count: number
  href: string
  tone: ItemTone
}

type AggregateCountsRow = {
  pending: number
  active: number
  overdue: number
  latest: Date | null
}

type BookingAggregateCountsRow = {
  pending: number
  approved: number
  rejected: number
  latest: Date | null
}

function toMillis(value: Date | string | null | undefined) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime()
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : t
}

async function countByWhere(whereClause: ReturnType<typeof and> | undefined) {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(borrowingTransactions)
    .where(whereClause)
  return Number(rows[0]?.total ?? 0)
}

async function maxUpdatedAtByWhere(whereClause: ReturnType<typeof and> | undefined) {
  const rows = await db
    .select({ latest: sql<Date | null>`max(${borrowingTransactions.updatedAt})` })
    .from(borrowingTransactions)
    .where(whereClause)
  return rows[0]?.latest ?? null
}

async function countBookingByWhere(whereClause: ReturnType<typeof and> | undefined) {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(labRoomBookingRequests)
    .where(whereClause)
  return Number(rows[0]?.total ?? 0)
}

async function maxBookingUpdatedAtByWhere(whereClause: ReturnType<typeof and> | undefined) {
  const rows = await db
    .select({ latest: sql<Date | null>`max(${labRoomBookingRequests.updatedAt})` })
    .from(labRoomBookingRequests)
    .where(whereClause)
  return rows[0]?.latest ?? null
}

async function getBorrowingAggregateForRequester(userId: string) {
  const rows = await db
    .select({
      pending: sql<number>`coalesce(sum(case when ${borrowingTransactions.status} in ('submitted', 'pending_approval') then 1 else 0 end), 0)`,
      active: sql<number>`coalesce(sum(case when ${borrowingTransactions.status} in ('active', 'partially_returned') then 1 else 0 end), 0)`,
      overdue: sql<number>`coalesce(sum(case when ${borrowingTransactions.status} in ('active', 'partially_returned') and ${borrowingTransactions.dueDate} is not null and ${borrowingTransactions.dueDate} < now() then 1 else 0 end), 0)`,
      latest: sql<Date | null>`max(${borrowingTransactions.updatedAt})`,
    })
    .from(borrowingTransactions)
    .where(eq(borrowingTransactions.requesterUserId, userId))
  return (rows[0] ?? { pending: 0, active: 0, overdue: 0, latest: null }) as AggregateCountsRow
}

async function getBorrowingAggregateForAdmin() {
  const rows = await db
    .select({
      pending: sql<number>`coalesce(sum(case when ${borrowingTransactions.status} in ('submitted', 'pending_approval') then 1 else 0 end), 0)`,
      active: sql<number>`coalesce(sum(case when ${borrowingTransactions.status} in ('approved_waiting_handover') then 1 else 0 end), 0)`,
      overdue: sql<number>`coalesce(sum(case when ${borrowingTransactions.status} in ('active', 'partially_returned') and ${borrowingTransactions.dueDate} is not null and ${borrowingTransactions.dueDate} < now() then 1 else 0 end), 0)`,
      latest: sql<Date | null>`max(${borrowingTransactions.updatedAt})`,
    })
    .from(borrowingTransactions)
  return (rows[0] ?? { pending: 0, active: 0, overdue: 0, latest: null }) as AggregateCountsRow
}

async function getBookingAggregateForRequester(userId: string) {
  const rows = await db
    .select({
      pending: sql<number>`coalesce(sum(case when ${labRoomBookingRequests.status} = 'pending' then 1 else 0 end), 0)`,
      approved: sql<number>`coalesce(sum(case when ${labRoomBookingRequests.status} = 'approved' and ${labRoomBookingRequests.usageLogId} is null then 1 else 0 end), 0)`,
      rejected: sql<number>`coalesce(sum(case when ${labRoomBookingRequests.status} = 'rejected' then 1 else 0 end), 0)`,
      latest: sql<Date | null>`max(${labRoomBookingRequests.updatedAt})`,
    })
    .from(labRoomBookingRequests)
    .where(eq(labRoomBookingRequests.requesterUserId, userId))
  return (rows[0] ?? { pending: 0, approved: 0, rejected: 0, latest: null }) as BookingAggregateCountsRow
}

async function getBookingAggregateForAdmin() {
  const rows = await db
    .select({
      pending: sql<number>`coalesce(sum(case when ${labRoomBookingRequests.status} = 'pending' then 1 else 0 end), 0)`,
      approved: sql<number>`0`,
      rejected: sql<number>`0`,
      latest: sql<Date | null>`max(${labRoomBookingRequests.updatedAt})`,
    })
    .from(labRoomBookingRequests)
  return (rows[0] ?? { pending: 0, approved: 0, rejected: 0, latest: null }) as BookingAggregateCountsRow
}

function emptyNotificationResponse() {
  return NextResponse.json({
    totalUnread: 0,
    items: [] satisfies NotificationItem[],
    generatedAt: new Date().toISOString(),
    degraded: true,
  })
}

async function getAssignedLabIds(userId: string) {
  const rows = await db
    .select({ labId: userLabAssignments.labId })
    .from(userLabAssignments)
    .where(eq(userLabAssignments.userId, userId))
  return rows.map((row) => row.labId)
}

function pendingApprovalCountSql(actorUserId: string, step: 1 | 2) {
  return sql<number>`
    (
      select count(*)
      from borrowing_transactions bt
      inner join borrowing_approval_matrices bam on bam.id = bt.approval_matrix_id
      where bt.status in ('submitted', 'pending_approval')
        and ${
          step === 1
            ? sql`coalesce(bt.step1_approver_user_id, bam.step1_approver_user_id) = ${actorUserId}`
            : sql`exists (
                select 1
                from user_lab_assignments ula
                inner join users u on u.id = ula.user_id
                where ula.lab_id = bt.lab_id
                  and ula.user_id = ${actorUserId}
                  and u.role = 'petugas_plp'
              )`
        }
        and not exists (
          select 1
          from borrowing_approvals ba_self
          where ba_self.transaction_id = bt.id
            and ba_self.approver_user_id = ${actorUserId}
        )
        and (
          select count(*)
          from borrowing_approvals ba_ok
          where ba_ok.transaction_id = bt.id
            and ba_ok.decision = 'approved'
        ) = ${step === 1 ? 0 : 1}
    )
  `
}

export async function GET() {
  try {
    const session = await getServerAuthSession()
    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const role = session.user.role
    const userId = session.user.id
    const items: NotificationItem[] = []
    let latestActionAtMs: number | null = null
    const captureLatest = (candidate: Date | string | null | undefined) => {
      const candidateMs = toMillis(candidate)
      if (candidateMs === null) return
      if (latestActionAtMs === null || candidateMs > latestActionAtMs) {
        latestActionAtMs = candidateMs
      }
    }

    if (role === "dosen") {
    const rows = await db
      .select({ total: pendingApprovalCountSql(userId, 1) })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    const total = Number(rows[0]?.total ?? 0)
    captureLatest(
      await maxUpdatedAtByWhere(
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
        ) = 0`,
        sql`exists (
          select 1 from borrowing_approval_matrices bam
          where bam.id = ${borrowingTransactions.approvalMatrixId}
            and coalesce(${borrowingTransactions.step1ApproverUserId}, bam.step1_approver_user_id) = ${userId}
        )`,
      ),
      ),
    )
    if (total > 0) {
      items.push({
        id: "borrowing-approve-step1",
        title: "Approval Tahap 1",
        description: "Pengajuan menunggu persetujuan Dosen.",
        count: total,
        href: "/dashboard/borrowing?scope=waiting_me&status=pending",
        tone: "warning",
      })
    }
    } else if (role === "petugas_plp") {
    const assignedLabIds = await getAssignedLabIds(userId)
    const scopeWhere =
      assignedLabIds.length > 0 ? inArray(borrowingTransactions.labId, assignedLabIds) : sql`false`

    const [approvalRows, handoverCount, overdueCount] = await Promise.all([
      db
        .select({ total: pendingApprovalCountSql(userId, 2) })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
      countByWhere(
        and(eq(borrowingTransactions.status, "approved_waiting_handover"), scopeWhere),
      ),
      countByWhere(
        and(
          inArray(borrowingTransactions.status, ["active", "partially_returned"]),
          sql`${borrowingTransactions.dueDate} is not null`,
          sql`${borrowingTransactions.dueDate} < now()`,
          scopeWhere,
        ),
      ),
    ])
    captureLatest(
      await maxUpdatedAtByWhere(
      and(
        scopeWhere,
        or(
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
          eq(borrowingTransactions.status, "approved_waiting_handover"),
          and(
            inArray(borrowingTransactions.status, ["active", "partially_returned"]),
            sql`${borrowingTransactions.dueDate} is not null`,
            sql`${borrowingTransactions.dueDate} < now()`,
          ),
        ),
      ),
      ),
    )
    const [pendingRoomBookingCount, latestRoomBookingAt] = await Promise.all([
      countBookingByWhere(
        assignedLabIds.length > 0
          ? and(
              inArray(labRoomBookingRequests.labId, assignedLabIds),
              eq(labRoomBookingRequests.status, "pending"),
            )
          : sql`false`,
      ),
      maxBookingUpdatedAtByWhere(
        assignedLabIds.length > 0
          ? and(
              inArray(labRoomBookingRequests.labId, assignedLabIds),
              eq(labRoomBookingRequests.status, "pending"),
            )
          : sql`false`,
      ),
    ])
    captureLatest(latestRoomBookingAt)

    const approvalCount = Number(approvalRows[0]?.total ?? 0)
    if (approvalCount > 0) {
      items.push({
        id: "borrowing-approve-step2",
        title: "Approval Tahap 2",
        description: "Pengajuan menunggu persetujuan Petugas PLP.",
        count: approvalCount,
        href: "/dashboard/borrowing?scope=waiting_me&status=pending",
        tone: "warning",
      })
    }
    if (handoverCount > 0) {
      items.push({
        id: "borrowing-handover",
        title: "Menunggu Serah Terima",
        description: "Transaksi approved siap diproses handover.",
        count: handoverCount,
        href: "/dashboard/borrowing?status=approved_waiting_handover",
        tone: "info",
      })
    }
    if (pendingRoomBookingCount > 0) {
      items.push({
        id: "lab-booking-pending",
        title: "Booking Ruang Menunggu Approval",
        description: "Ada pengajuan penggunaan ruang lab yang menunggu keputusan.",
        count: pendingRoomBookingCount,
        href: "/dashboard/lab-usage",
        tone: "warning",
      })
    }
    if (overdueCount > 0) {
      items.push({
        id: "borrowing-overdue",
        title: "Keterlambatan Pengembalian",
        description: "Transaksi melewati due date dan perlu tindak lanjut.",
        count: overdueCount,
        href: "/dashboard/borrowing?status=overdue",
        tone: "danger",
      })
    }
    } else if (role === "admin") {
      const [borrowingAgg, bookingAgg] = await Promise.all([
        getBorrowingAggregateForAdmin(),
        getBookingAggregateForAdmin(),
      ])
      const pendingCount = Number(borrowingAgg.pending ?? 0)
      const handoverCount = Number(borrowingAgg.active ?? 0)
      const overdueCount = Number(borrowingAgg.overdue ?? 0)
      const pendingRoomBookingCount = Number(bookingAgg.pending ?? 0)
      captureLatest(borrowingAgg.latest)
      captureLatest(bookingAgg.latest)

    if (pendingCount > 0) {
      items.push({
        id: "admin-pending-approval",
        title: "Approval Pending",
        description: "Ada pengajuan yang masih menunggu keputusan approval.",
        count: pendingCount,
        href: "/dashboard/borrowing?status=pending",
        tone: "warning",
      })
    }
    if (handoverCount > 0) {
      items.push({
        id: "admin-handover",
        title: "Menunggu Serah Terima",
        description: "Transaksi approved menunggu proses handover.",
        count: handoverCount,
        href: "/dashboard/borrowing?status=approved_waiting_handover",
        tone: "info",
      })
    }
    if (pendingRoomBookingCount > 0) {
      items.push({
        id: "admin-lab-booking-pending",
        title: "Booking Ruang Menunggu Approval",
        description: "Ada pengajuan penggunaan ruang lab yang menunggu keputusan.",
        count: pendingRoomBookingCount,
        href: "/dashboard/lab-usage",
        tone: "warning",
      })
    }
    if (overdueCount > 0) {
      items.push({
        id: "admin-overdue",
        title: "Keterlambatan Pengembalian",
        description: "Ada transaksi overdue yang perlu ditindaklanjuti.",
        count: overdueCount,
        href: "/dashboard/borrowing?status=overdue",
        tone: "danger",
      })
    }
    } else if (role === "mahasiswa") {
      const [borrowingAgg, bookingAgg] = await Promise.all([
        getBorrowingAggregateForRequester(userId),
        getBookingAggregateForRequester(userId),
      ])
      const pendingCount = Number(borrowingAgg.pending ?? 0)
      const activeCount = Number(borrowingAgg.active ?? 0)
      const overdueCount = Number(borrowingAgg.overdue ?? 0)
      const approvedRoomBookingCount = Number(bookingAgg.approved ?? 0)
      const rejectedRoomBookingCount = Number(bookingAgg.rejected ?? 0)
      captureLatest(borrowingAgg.latest)
      captureLatest(bookingAgg.latest)

    if (pendingCount > 0) {
      items.push({
        id: "student-pending",
        title: "Pengajuan Menunggu Approval",
        description: "Pengajuan kamu sedang diproses approver.",
        count: pendingCount,
        href: "/dashboard/borrowing?scope=mine&status=pending",
        tone: "warning",
      })
    }
    if (activeCount > 0) {
      items.push({
        id: "student-active",
        title: "Peminjaman Aktif",
        description: "Transaksi peminjaman kamu masih berjalan.",
        count: activeCount,
        href: "/dashboard/borrowing?scope=mine&status=active",
        tone: "info",
      })
    }
    if (approvedRoomBookingCount > 0) {
      items.push({
        id: "student-room-booking-approved",
        title: "Booking Lab Disetujui",
        description: "Booking ruang sudah disetujui. Lanjutkan isi penggunaan lab setelah sesi.",
        count: approvedRoomBookingCount,
        href: "/dashboard/student-lab-schedule",
        tone: "success",
      })
    }
    if (rejectedRoomBookingCount > 0) {
      items.push({
        id: "student-room-booking-rejected",
        title: "Booking Lab Ditolak",
        description: "Ada pengajuan ruang yang ditolak. Cek alasan penolakan di booking Anda.",
        count: rejectedRoomBookingCount,
        href: "/dashboard/student-lab-schedule",
        tone: "danger",
      })
    }
    if (overdueCount > 0) {
      items.push({
        id: "student-overdue",
        title: "Peminjaman Terlambat",
        description: "Segera lakukan pengembalian alat yang overdue.",
        count: overdueCount,
        href: "/dashboard/borrowing?scope=mine&status=overdue",
        tone: "danger",
      })
    }
    }

    const actionableCount = items.reduce((acc, item) => acc + item.count, 0)
    const state = await db.query.userNotificationStates.findFirst({
      where: eq(userNotificationStates.userId, userId),
      columns: { borrowingLastReadAt: true },
    })

    const lastReadAtMs = toMillis(state?.borrowingLastReadAt)
    const isRead =
      actionableCount <= 0 ||
      !latestActionAtMs ||
      (lastReadAtMs !== null && lastReadAtMs >= latestActionAtMs)
    const totalUnread = isRead ? 0 : actionableCount
    return NextResponse.json({
      totalUnread,
      items,
      generatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Notification summary degraded:", error)
    return emptyNotificationResponse()
  }
}
