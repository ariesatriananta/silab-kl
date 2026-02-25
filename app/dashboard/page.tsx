import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { ArrowUpRight, AlertTriangle, Package, Wrench } from "lucide-react"

import { LabOverview, type LabOverviewItem } from "@/components/dashboard/lab-overview"
import { OverdueAlerts, type OverdueAlertItem } from "@/components/dashboard/overdue-alerts"
import { RecentActivity, type RecentActivityItem } from "@/components/dashboard/recent-activity"
import { StatCard } from "@/components/dashboard/stat-card"
import { db } from "@/lib/db/client"
import {
  borrowingReturnItems,
  borrowingReturns,
  borrowingTransactions,
  labs,
  toolAssets,
  toolModels,
  users,
} from "@/lib/db/schema"

export const dynamic = "force-dynamic"

function formatRelativeTime(date: Date | null) {
  if (!date) return "-"
  const diffMs = Date.now() - date.getTime()
  const minutes = Math.max(1, Math.floor(diffMs / 60_000))
  if (minutes < 60) return `${minutes} menit lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  return `${days} hari lalu`
}

async function getDashboardData() {
  const [assetStatusRows, labRows, overdueTxRows, handovers, returns] = await Promise.all([
    db
      .select({
        status: toolAssets.status,
        count: sql<number>`count(*)`,
      })
      .from(toolAssets)
      .groupBy(toolAssets.status),
    db
      .select({
        labId: labs.id,
        labName: labs.name,
        toolCount: sql<number>`count(${toolAssets.id})`,
        borrowedCount: sql<number>`coalesce(sum(case when ${toolAssets.status} = 'borrowed' then 1 else 0 end), 0)`,
        maintenanceCount: sql<number>`coalesce(sum(case when ${toolAssets.status} in ('maintenance', 'damaged') then 1 else 0 end), 0)`,
      })
      .from(labs)
      .leftJoin(toolModels, eq(toolModels.labId, labs.id))
      .leftJoin(toolAssets, eq(toolAssets.toolModelId, toolModels.id))
      .groupBy(labs.id)
      .orderBy(asc(labs.name)),
    db
      .select({
        id: borrowingTransactions.id,
        code: borrowingTransactions.code,
        dueDate: borrowingTransactions.dueDate,
        borrowerName: users.fullName,
      })
      .from(borrowingTransactions)
      .innerJoin(users, eq(users.id, borrowingTransactions.requesterUserId))
      .where(
        and(
          inArray(borrowingTransactions.status, ["active", "partially_returned"]),
          sql`${borrowingTransactions.dueDate} < now()`,
        ),
      )
      .orderBy(asc(borrowingTransactions.dueDate))
      .limit(5),
    db
      .select({
        id: borrowingTransactions.id,
        code: borrowingTransactions.code,
        userName: users.fullName,
        createdAt: borrowingTransactions.handedOverAt,
      })
      .from(borrowingTransactions)
      .innerJoin(users, eq(users.id, borrowingTransactions.requesterUserId))
      .where(eq(borrowingTransactions.status, "active"))
      .orderBy(desc(borrowingTransactions.handedOverAt))
      .limit(5),
    db
      .select({
        id: borrowingReturns.id,
        txCode: borrowingTransactions.code,
        userName: users.fullName,
        returnedAt: borrowingReturns.returnedAt,
        itemCount: sql<number>`count(${borrowingReturnItems.id})`,
      })
      .from(borrowingReturns)
      .innerJoin(borrowingTransactions, eq(borrowingTransactions.id, borrowingReturns.transactionId))
      .innerJoin(users, eq(users.id, borrowingTransactions.requesterUserId))
      .leftJoin(borrowingReturnItems, eq(borrowingReturnItems.returnId, borrowingReturns.id))
      .groupBy(borrowingReturns.id, borrowingTransactions.code, users.fullName)
      .orderBy(desc(borrowingReturns.returnedAt))
      .limit(5),
  ])

  const counts = {
    availableTools: 0,
    borrowedTools: 0,
    overdue: overdueTxRows.length,
    damaged: 0,
  }

  for (const row of assetStatusRows) {
    const count = Number(row.count)
    if (row.status === "available") counts.availableTools += count
    if (row.status === "borrowed") counts.borrowedTools += count
    if (row.status === "maintenance" || row.status === "damaged") counts.damaged += count
  }

  const labOverview: LabOverviewItem[] = labRows.map((row) => {
    const toolCount = Number(row.toolCount)
    const borrowedCount = Number(row.borrowedCount)
    const maintenanceCount = Number(row.maintenanceCount)
    const usageRate = toolCount > 0 ? Math.round((borrowedCount / toolCount) * 100) : 0

    return {
      name: row.labName,
      toolCount,
      usageRate,
      status: maintenanceCount > 0 ? "maintenance" : "active",
    }
  })

  const overdueAlerts: OverdueAlertItem[] = overdueTxRows.map((row) => ({
    id: row.id,
    tool: `Transaksi ${row.code}`,
    borrower: row.borrowerName,
    daysOverdue: row.dueDate ? Math.max(1, Math.floor((Date.now() - row.dueDate.getTime()) / 86_400_000)) : 1,
  }))

  const recentActivities: RecentActivityItem[] = [
    ...handovers.map((row) => ({
      id: `handover-${row.id}`,
      user: row.userName,
      action: `Pengambilan transaksi ${row.code}`,
      time: formatRelativeTime(row.createdAt),
      type: "borrow" as const,
      sortAt: row.createdAt ? row.createdAt.getTime() : 0,
    })),
    ...returns.map((row) => ({
      id: `return-${row.id}`,
      user: row.userName,
      action: `Pengembalian ${Number(row.itemCount)} alat (transaksi ${row.txCode})`,
      time: formatRelativeTime(row.returnedAt),
      type: "return" as const,
      sortAt: row.returnedAt.getTime(),
    })),
  ]
    .sort((a, b) => b.sortAt - a.sortAt)
    .slice(0, 8)
    .map((item) => {
      const { sortAt, ...rest } = item
      void sortAt
      return rest
    })

  return { counts, labOverview, overdueAlerts, recentActivities }
}

export default async function DashboardPage() {
  const { counts, labOverview, overdueAlerts, recentActivities } = await getDashboardData()

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Alat Tersedia"
          value={counts.availableTools}
          icon={Package}
          variant="primary"
          trend="Data real dari inventaris"
        />
        <StatCard
          title="Sedang Dipinjam"
          value={counts.borrowedTools}
          icon={ArrowUpRight}
          variant="default"
          trend="Berdasarkan status asset"
        />
        <StatCard
          title="Terlambat"
          value={counts.overdue}
          icon={AlertTriangle}
          variant="warning"
          trend="Derived dari due date transaksi"
        />
        <StatCard
          title="Rusak/Perbaikan"
          value={counts.damaged}
          icon={Wrench}
          variant="destructive"
          trend="Asset maintenance + damaged"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentActivity items={recentActivities} />
        <LabOverview items={labOverview} />
      </div>

      <OverdueAlerts items={overdueAlerts} />
    </div>
  )
}
