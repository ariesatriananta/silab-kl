import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { recentActivities } from "@/lib/mock-data"
import { ArrowUpRight, ArrowDownLeft, AlertTriangle } from "lucide-react"

const typeConfig = {
  borrow: { icon: ArrowUpRight, label: "Pinjam", className: "bg-primary/10 text-primary border-primary/20" },
  return: { icon: ArrowDownLeft, label: "Kembali", className: "bg-success/10 text-success-foreground border-success/20" },
  damage: { icon: AlertTriangle, label: "Rusak", className: "bg-destructive/10 text-destructive border-destructive/20" },
}

export function RecentActivity() {
  return (
    <Card className="border-border/50 bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-card-foreground">Aktivitas Terbaru</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <ScrollArea className="h-[300px] px-6">
          <div className="flex flex-col gap-4">
            {recentActivities.map((activity) => {
              const config = typeConfig[activity.type]
              const Icon = config.icon
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <Icon className="size-4 text-muted-foreground" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-card-foreground">{activity.user}</span>
                      <Badge variant="outline" className={config.className}>
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{activity.action}</p>
                    <p className="text-xs text-muted-foreground/70">{activity.time}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
