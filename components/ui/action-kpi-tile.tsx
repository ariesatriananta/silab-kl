import * as React from "react"

import { cn } from "@/lib/utils"

type ActionKpiTone = "primary" | "warning" | "destructive" | "muted"

const toneClasses: Record<ActionKpiTone, string> = {
  primary: "border-primary/20 bg-primary/5 hover:bg-primary/10",
  warning: "border-warning/20 bg-warning/5 hover:bg-warning/10",
  destructive: "border-destructive/20 bg-destructive/5 hover:bg-destructive/10",
  muted: "border-border/50 bg-muted/30 hover:bg-muted/50",
}

interface ActionKpiTileProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  title: string
  metric: React.ReactNode
  description: string
  tone?: ActionKpiTone
}

export function ActionKpiTile({
  title,
  metric,
  description,
  tone = "muted",
  className,
  ...props
}: ActionKpiTileProps) {
  return (
    <button
      type="button"
      className={cn(
        "rounded-lg border p-2.5 text-left transition-colors",
        toneClasses[tone],
        className,
      )}
      {...props}
    >
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-0.5 text-base font-semibold leading-tight text-foreground">{metric}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{description}</p>
    </button>
  )
}
