import { type LucideIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type KpiTone = "default" | "primary" | "success" | "warning" | "destructive"

interface KpiCardProps {
  title: string
  value: number | string
  description?: string
  icon?: LucideIcon
  tone?: KpiTone
  className?: string
}

const toneStyles: Record<KpiTone, { iconWrap: string; icon: string }> = {
  default: {
    iconWrap: "bg-muted/50 border-border/50",
    icon: "text-foreground",
  },
  primary: {
    iconWrap: "bg-primary/10 border-primary/20",
    icon: "text-primary",
  },
  success: {
    iconWrap: "bg-success/10 border-success/20",
    icon: "text-success-foreground",
  },
  warning: {
    iconWrap: "bg-warning/10 border-warning/20",
    icon: "text-warning-foreground",
  },
  destructive: {
    iconWrap: "bg-destructive/10 border-destructive/20",
    icon: "text-destructive",
  },
}

export function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  tone = "default",
  className,
}: KpiCardProps) {
  const style = toneStyles[tone]

  return (
    <Card className={cn("border-border/50 bg-card shadow-sm", className)}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2.5">
          {Icon ? (
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                style.iconWrap,
              )}
            >
              <Icon className={cn("size-4", style.icon)} />
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="mt-0.5 text-lg font-semibold leading-tight text-foreground">{value}</p>
            {description ? (
              <p className="mt-0.5 line-clamp-1 text-[11px] leading-tight text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

