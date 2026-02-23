import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { overdueAlerts } from "@/lib/mock-data"
import { AlertTriangle, Clock } from "lucide-react"

export function OverdueAlerts() {
  return (
    <Card className="border-destructive/20 bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-destructive" />
          <CardTitle className="text-base font-semibold text-card-foreground">Peringatan Keterlambatan</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3">
          {overdueAlerts.map((alert) => (
            <div key={alert.id} className="flex items-center justify-between rounded-lg border border-destructive/10 bg-destructive/5 p-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-card-foreground">{alert.tool}</span>
                <span className="text-xs text-muted-foreground">{alert.borrower}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="destructive" className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {alert.daysOverdue} hari
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
