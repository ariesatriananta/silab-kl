import { StatCard } from "@/components/dashboard/stat-card"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { LabOverview } from "@/components/dashboard/lab-overview"
import { OverdueAlerts } from "@/components/dashboard/overdue-alerts"
import { statsData } from "@/lib/mock-data"
import { Package, ArrowUpRight, AlertTriangle, Wrench } from "lucide-react"

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Alat Tersedia"
          value={statsData.availableTools}
          icon={Package}
          variant="primary"
          trend="+12 dari bulan lalu"
        />
        <StatCard
          title="Sedang Dipinjam"
          value={statsData.borrowedTools}
          icon={ArrowUpRight}
          variant="default"
          trend="8 pengembalian hari ini"
        />
        <StatCard
          title="Terlambat"
          value={statsData.overdue}
          icon={AlertTriangle}
          variant="warning"
          trend="Perlu tindakan segera"
        />
        <StatCard
          title="Rusak/Perbaikan"
          value={statsData.damaged}
          icon={Wrench}
          variant="destructive"
          trend="1 sedang diperbaiki"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentActivity />
        <LabOverview />
      </div>

      {/* Overdue Alerts */}
      <OverdueAlerts />
    </div>
  )
}
