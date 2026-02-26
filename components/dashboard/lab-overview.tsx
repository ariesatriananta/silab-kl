import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { FlaskConical } from "lucide-react"

export type LabOverviewItem = {
  name: string
  toolCount: number
  usageRate: number
  status: "active" | "maintenance"
}

export function LabOverview({ items }: { items: LabOverviewItem[] }) {
  return (
    <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-card-foreground">Ringkasan Laboratorium</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {items.length === 0 && (
            <div className="rounded-xl border border-border/50 bg-background/70 p-4 text-sm text-muted-foreground">
              Belum ada data laboratorium.
            </div>
          )}
          {items.map((lab) => (
            <div key={lab.name} className="flex flex-col gap-2 rounded-xl border border-border/50 bg-background/75 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FlaskConical className="size-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">{lab.name}</span>
                </div>
                <Badge
                  variant="outline"
                  className={
                    lab.status === "active"
                      ? "bg-success/10 text-success-foreground border-success/20"
                      : "bg-warning/10 text-warning-foreground border-warning/20"
                  }
                >
                  {lab.status === "active" ? "Aktif" : "Maintenance"}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{lab.toolCount} alat</span>
                <span>Penggunaan {lab.usageRate}%</span>
              </div>
              <Progress value={lab.usageRate} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
