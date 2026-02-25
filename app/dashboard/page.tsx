import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { ArrowUpRight, AlertTriangle, Package, Wrench } from "lucide-react"

import { LabOverview, type LabOverviewItem } from "@/components/dashboard/lab-overview"
import { OverdueAlerts, type OverdueAlertItem } from "@/components/dashboard/overdue-alerts"
import { RecentActivity, type RecentActivityItem } from "@/components/dashboard/recent-activity"
import { StatCard } from "@/components/dashboard/stat-card"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { db } from "@/lib/db/client"
import {
  borrowingReturnItems,
  borrowingReturns,
  borrowingTransactionItems,
  borrowingTransactions,
  consumableItems,
  consumableStockMovements,
  labUsageLogs,
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

function fmtDateTime(date: Date | null) {
  if (!date) return "-"
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date)
}

async function getDashboardData() {
  const [
    assetStatusRows,
    labRows,
    overdueTxRows,
    handovers,
    returns,
    topToolUsageRows,
    damageSummaryRows,
    recentDamageRows,
    consumableUsageSummaryRows,
    topConsumableUsageRows,
    roomActivityRows,
  ] = await Promise.all([
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
    db
      .select({
        toolModelId: toolModels.id,
        toolName: toolModels.name,
        labName: labs.name,
        usageCount: sql<number>`count(*)`,
      })
      .from(borrowingTransactionItems)
      .innerJoin(toolAssets, eq(toolAssets.id, borrowingTransactionItems.toolAssetId))
      .innerJoin(toolModels, eq(toolModels.id, toolAssets.toolModelId))
      .innerJoin(labs, eq(labs.id, toolModels.labId))
      .innerJoin(borrowingTransactions, eq(borrowingTransactions.id, borrowingTransactionItems.transactionId))
      .where(
        and(
          eq(borrowingTransactionItems.itemType, "tool_asset"),
          sql`${borrowingTransactions.handedOverAt} is not null`,
        ),
      )
      .groupBy(toolModels.id, labs.name)
      .orderBy(desc(sql`count(*)`), asc(toolModels.name))
      .limit(5),
    db
      .select({
        returnCondition: borrowingReturnItems.returnCondition,
        count: sql<number>`count(*)`,
      })
      .from(borrowingReturnItems)
      .groupBy(borrowingReturnItems.returnCondition),
    db
      .select({
        returnedAt: borrowingReturns.returnedAt,
        toolName: toolModels.name,
        assetCode: toolAssets.assetCode,
        condition: borrowingReturnItems.returnCondition,
      })
      .from(borrowingReturnItems)
      .innerJoin(borrowingReturns, eq(borrowingReturns.id, borrowingReturnItems.returnId))
      .innerJoin(toolAssets, eq(toolAssets.id, borrowingReturnItems.toolAssetId))
      .innerJoin(toolModels, eq(toolModels.id, toolAssets.toolModelId))
      .where(inArray(borrowingReturnItems.returnCondition, ["maintenance", "damaged"]))
      .orderBy(desc(borrowingReturns.returnedAt))
      .limit(5),
    db
      .select({
        movementType: consumableStockMovements.movementType,
        totalDelta: sql<number>`coalesce(sum(${consumableStockMovements.qtyDelta}), 0)`,
      })
      .from(consumableStockMovements)
      .where(sql`${consumableStockMovements.createdAt} >= now() - interval '30 days'`)
      .groupBy(consumableStockMovements.movementType),
    db
      .select({
        consumableName: consumableItems.name,
        labName: labs.name,
        totalIssued: sql<number>`coalesce(sum(abs(${consumableStockMovements.qtyDelta})), 0)`,
        unit: consumableItems.unit,
      })
      .from(consumableStockMovements)
      .innerJoin(consumableItems, eq(consumableItems.id, consumableStockMovements.consumableItemId))
      .innerJoin(labs, eq(labs.id, consumableItems.labId))
      .where(
        and(
          inArray(consumableStockMovements.movementType, ["material_request_fulfill", "borrowing_handover_issue"]),
          sql`${consumableStockMovements.createdAt} >= now() - interval '30 days'`,
        ),
      )
      .groupBy(consumableItems.id, labs.name)
      .orderBy(desc(sql`coalesce(sum(abs(${consumableStockMovements.qtyDelta})), 0)`), asc(consumableItems.name))
      .limit(5),
    db
      .select({
        id: labUsageLogs.id,
        labName: labs.name,
        courseName: labUsageLogs.courseName,
        groupName: labUsageLogs.groupName,
        studentCount: labUsageLogs.studentCount,
        startedAt: labUsageLogs.startedAt,
        endedAt: labUsageLogs.endedAt,
      })
      .from(labUsageLogs)
      .innerJoin(labs, eq(labs.id, labUsageLogs.labId))
      .orderBy(desc(labUsageLogs.startedAt))
      .limit(6),
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

  const topUsedTools = topToolUsageRows.map((row) => ({
    id: row.toolModelId,
    name: row.toolName,
    labName: row.labName,
    usageCount: Number(row.usageCount),
  }))

  const damageSummary = {
    maintenanceReturns: 0,
    damagedReturns: 0,
    currentMaintenanceAssets: counts.damaged,
  }
  for (const row of damageSummaryRows) {
    const count = Number(row.count)
    if (row.returnCondition === "maintenance") damageSummary.maintenanceReturns = count
    if (row.returnCondition === "damaged") damageSummary.damagedReturns = count
  }

  const recentDamageEvents = recentDamageRows.map((row) => ({
    when: fmtDateTime(row.returnedAt) ?? "-",
    toolLabel: `${row.toolName} - ${row.assetCode}`,
    condition: row.condition,
  }))

  const consumableUsageSummary = {
    stockIn30d: 0,
    issueForBorrowing30d: 0,
    issueForRequests30d: 0,
    manualAdjust30d: 0,
  }
  for (const row of consumableUsageSummaryRows) {
    const total = Number(row.totalDelta)
    if (row.movementType === "stock_in") consumableUsageSummary.stockIn30d += total
    if (row.movementType === "borrowing_handover_issue") consumableUsageSummary.issueForBorrowing30d += Math.abs(total)
    if (row.movementType === "material_request_fulfill") consumableUsageSummary.issueForRequests30d += Math.abs(total)
    if (row.movementType === "manual_adjustment") consumableUsageSummary.manualAdjust30d += total
  }

  const topConsumableUsage = topConsumableUsageRows.map((row) => ({
    name: row.consumableName,
    labName: row.labName,
    totalIssued: Number(row.totalIssued),
    unit: row.unit,
  }))

  const roomActivities = roomActivityRows.map((row) => ({
    id: row.id,
    labName: row.labName,
    courseName: row.courseName,
    groupName: row.groupName,
    studentCount: row.studentCount,
    start: fmtDateTime(row.startedAt) ?? "-",
    end: fmtDateTime(row.endedAt) ?? "-",
  }))

  return {
    counts,
    labOverview,
    overdueAlerts,
    recentActivities,
    topUsedTools,
    damageSummary,
    recentDamageEvents,
    consumableUsageSummary,
    topConsumableUsage,
    roomActivities,
  }
}

export default async function DashboardPage() {
  const {
    counts,
    labOverview,
    overdueAlerts,
    recentActivities,
    topUsedTools,
    damageSummary,
    recentDamageEvents,
    consumableUsageSummary,
    topConsumableUsage,
    roomActivities,
  } = await getDashboardData()

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

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="border-border/50 bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Alat Sering Dipakai (30 hari)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {topUsedTools.length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada data penggunaan alat.</p>
            )}
            {topUsedTools.map((tool, idx) => (
              <div key={tool.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/40 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{idx + 1}. {tool.name}</p>
                  <p className="text-xs text-muted-foreground">{tool.labName}</p>
                </div>
                <Badge variant="secondary">{tool.usageCount}x</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Rekap Kerusakan & Maintenance</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border/50 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Return perlu maintenance</p>
                <p className="mt-1 text-lg font-bold">{damageSummary.maintenanceReturns}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Return rusak</p>
                <p className="mt-1 text-lg font-bold">{damageSummary.damagedReturns}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Asset rusak/perbaikan saat ini</p>
                <p className="mt-1 text-lg font-bold">{damageSummary.currentMaintenanceAssets}</p>
              </div>
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium text-foreground">Kejadian terbaru</p>
              {recentDamageEvents.length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada pengembalian rusak/maintenance.</p>
              )}
              {recentDamageEvents.map((event, idx) => (
                <div key={`${event.toolLabel}-${idx}`} className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-foreground">{event.toolLabel}</span>
                    <Badge variant="outline" className={event.condition === "damaged" ? "border-destructive/20 bg-destructive/10 text-destructive" : "border-warning/20 bg-warning/10 text-warning-foreground"}>
                      {event.condition === "damaged" ? "Rusak" : "Maintenance"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{event.when}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="border-border/50 bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Ringkasan Penggunaan Bahan (30 hari)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-border/50 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Stok Masuk</p>
                <p className="mt-1 text-lg font-bold">{consumableUsageSummary.stockIn30d}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Keluar (Peminjaman)</p>
                <p className="mt-1 text-lg font-bold">{consumableUsageSummary.issueForBorrowing30d}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Keluar (Permintaan)</p>
                <p className="mt-1 text-lg font-bold">{consumableUsageSummary.issueForRequests30d}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground">Koreksi Manual</p>
                <p className="mt-1 text-lg font-bold">{consumableUsageSummary.manualAdjust30d}</p>
              </div>
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium text-foreground">Bahan paling sering digunakan</p>
              {topConsumableUsage.length === 0 && (
                <p className="text-sm text-muted-foreground">Belum ada data pemakaian bahan.</p>
              )}
              {topConsumableUsage.map((row, idx) => (
                <div key={`${row.name}-${idx}`} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/40 px-3 py-2">
                  <div>
                    <p className="text-sm text-foreground">{idx + 1}. {row.name}</p>
                    <p className="text-xs text-muted-foreground">{row.labName}</p>
                  </div>
                  <Badge variant="secondary">{row.totalIssued} {row.unit}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Aktivitas Penggunaan Ruang Lab</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {roomActivities.length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada riwayat penggunaan ruang.</p>
            )}
            {roomActivities.map((activity) => (
              <div key={activity.id} className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{activity.courseName} - {activity.groupName}</p>
                  <Badge variant="outline">{activity.studentCount} mhs</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{activity.labName}</p>
                <p className="mt-1 text-xs text-muted-foreground">{activity.start} s/d {activity.end}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
