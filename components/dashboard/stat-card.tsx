import { Card, CardContent } from "@/components/ui/card"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  trend?: string
  variant?: "default" | "primary" | "warning" | "destructive"
}

const variantStyles = {
  default: "bg-secondary text-secondary-foreground",
  primary: "bg-primary/10 text-primary",
  warning: "bg-warning/10 text-warning-foreground",
  destructive: "bg-destructive/10 text-destructive",
}

export function StatCard({ title, value, icon: Icon, trend, variant = "default" }: StatCardProps) {
  return (
    <Card className="border-border/50 bg-gradient-to-br from-card to-muted/20 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="flex items-start gap-4 p-4">
        <div className={cn("mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/40", variantStyles[variant])}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-card-foreground">{value}</p>
          {trend && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{trend}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
