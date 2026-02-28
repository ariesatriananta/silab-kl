import { and, eq, inArray, sql } from "drizzle-orm"
import { NextResponse } from "next/server"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import { borrowingTransactions, userLabAssignments, users } from "@/lib/db/schema"

type ItemTone = "warning" | "danger" | "info" | "success"

type NotificationItem = {
  id: string
  title: string
  description: string
  count: number
  href: string
  tone: ItemTone
}

async function countByWhere(whereClause: ReturnType<typeof and> | undefined) {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    .from(borrowingTransactions)
    .where(whereClause)
  return Number(rows[0]?.total ?? 0)
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
            ? sql`bam.step1_approver_user_id = ${actorUserId}`
            : sql`bam.step2_approver_user_id = ${actorUserId}`
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
  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const role = session.user.role
  const userId = session.user.id
  const items: NotificationItem[] = []

  if (role === "dosen") {
    const rows = await db
      .select({ total: pendingApprovalCountSql(userId, 1) })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    const total = Number(rows[0]?.total ?? 0)
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
    const [pendingCount, handoverCount, overdueCount] = await Promise.all([
      countByWhere(inArray(borrowingTransactions.status, ["submitted", "pending_approval"])),
      countByWhere(eq(borrowingTransactions.status, "approved_waiting_handover")),
      countByWhere(
        and(
          inArray(borrowingTransactions.status, ["active", "partially_returned"]),
          sql`${borrowingTransactions.dueDate} is not null`,
          sql`${borrowingTransactions.dueDate} < now()`,
        ),
      ),
    ])

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
    const [pendingCount, activeCount, overdueCount] = await Promise.all([
      countByWhere(
        and(
          eq(borrowingTransactions.requesterUserId, userId),
          inArray(borrowingTransactions.status, ["submitted", "pending_approval"]),
        ),
      ),
      countByWhere(
        and(
          eq(borrowingTransactions.requesterUserId, userId),
          inArray(borrowingTransactions.status, ["active", "partially_returned"]),
        ),
      ),
      countByWhere(
        and(
          eq(borrowingTransactions.requesterUserId, userId),
          inArray(borrowingTransactions.status, ["active", "partially_returned"]),
          sql`${borrowingTransactions.dueDate} is not null`,
          sql`${borrowingTransactions.dueDate} < now()`,
        ),
      ),
    ])

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

  const totalUnread = items.reduce((acc, item) => acc + item.count, 0)
  return NextResponse.json({
    totalUnread,
    items,
    generatedAt: new Date().toISOString(),
  })
}
