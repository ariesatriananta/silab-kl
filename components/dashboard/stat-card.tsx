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
      <CardContent className="flex items-start gap-2.5 px-3 py-0">
        <div className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border border-border/40", variantStyles[variant])}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="mt-0.5 text-xl font-semibold leading-tight tracking-tight text-card-foreground">{value}</p>
          {trend && <p className="mt-0.5 line-clamp-2 text-[11px] leading-tight text-muted-foreground">{trend}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
