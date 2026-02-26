import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowUpRight, ArrowDownLeft, AlertTriangle } from "lucide-react"

const typeConfig = {
  borrow: { icon: ArrowUpRight, label: "Pinjam", className: "bg-primary/10 text-primary border-primary/20" },
  return: { icon: ArrowDownLeft, label: "Kembali", className: "bg-success/10 text-success-foreground border-success/20" },
  damage: { icon: AlertTriangle, label: "Rusak", className: "bg-destructive/10 text-destructive border-destructive/20" },
}

export type RecentActivityItem = {
  id: string | number
  user: string
  action: string
  time: string
  type: keyof typeof typeConfig
}

export function RecentActivity({ items }: { items: RecentActivityItem[] }) {
  return (
    <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold text-card-foreground">Aktivitas Terbaru</CardTitle>
          <Badge variant="outline" className="rounded-full border-border/60 bg-background/80 text-xs">
            {items.length} item
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <ScrollArea className="h-[300px] px-6">
          <div className="flex flex-col gap-4">
            {items.length === 0 && (
              <div className="rounded-xl border border-border/50 bg-background/70 py-10 text-center text-sm text-muted-foreground">
                Belum ada aktivitas terbaru.
              </div>
            )}
            {items.map((activity) => {
              const config = typeConfig[activity.type]
              const Icon = config.icon
              return (
                <div key={activity.id} className="flex items-start gap-3 rounded-xl border border-border/40 bg-background/70 p-3">
                  <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/70">
                    <Icon className="size-4 text-foreground/80" />
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
