"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Bell, Clock3, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type ItemTone = "warning" | "danger" | "info" | "success"

type HeaderNotificationItem = {
  id: string
  title: string
  description: string
  count: number
  href: string
  tone: ItemTone
}

type NotificationResponse = {
  totalUnread: number
  items: HeaderNotificationItem[]
  generatedAt?: string
}

const toneClassMap: Record<ItemTone, string> = {
  warning: "bg-warning/10 text-warning-foreground border-warning/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-primary/10 text-primary border-primary/20",
  success: "bg-success/10 text-success-foreground border-success/20",
}

const tonePriority: Record<ItemTone, number> = {
  danger: 1,
  warning: 2,
  info: 3,
  success: 4,
}

export function HeaderNotificationMenu() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [data, setData] = useState<NotificationResponse>({ totalUnread: 0, items: [] })

  const fetchSummary = async (mode: "initial" | "refresh" = "refresh") => {
    if (mode === "refresh") setRefreshing(true)
    try {
      const response = await fetch("/api/notifications/summary", { method: "GET", cache: "no-store" })
      if (!response.ok) return
      const next = (await response.json()) as NotificationResponse
      setData(next)
    } catch {
      // ignore network issues for non-blocking header notification
    } finally {
      if (mode === "initial") setLoading(false)
      setRefreshing(false)
    }
  }

  const markAsRead = async () => {
    try {
      await fetch("/api/notifications/mark-read", { method: "POST", keepalive: true })
    } catch {
      // ignore network issues for non-blocking header notification
    }
  }

  useEffect(() => {
    void fetchSummary("initial")
    const timer = window.setInterval(() => {
      void fetchSummary("refresh")
    }, 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const hasUnread = data.totalUnread > 0
  const badgeLabel = useMemo(() => {
    if (data.totalUnread <= 0) return null
    if (data.totalUnread > 99) return "99+"
    return String(data.totalUnread)
  }, [data.totalUnread])

  const orderedItems = useMemo(() => {
    return [...data.items].sort((a, b) => {
      const toneGap = tonePriority[a.tone] - tonePriority[b.tone]
      if (toneGap !== 0) return toneGap
      return b.count - a.count
    })
  }, [data.items])

  const highPriorityItems = orderedItems.filter((item) => item.tone === "danger" || item.tone === "warning")
  const otherItems = orderedItems.filter((item) => item.tone !== "danger" && item.tone !== "warning")

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (!open) return
        setData((prev) => ({ ...prev, totalUnread: 0 }))
        void (async () => {
          await markAsRead()
          await fetchSummary("refresh")
        })()
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Notifikasi"
          title="Notifikasi"
          onClick={() => {
            void fetchSummary("refresh")
          }}
          className="relative h-10 w-10 rounded-full border border-border/60 bg-background/90 shadow-sm transition hover:bg-muted/40"
        >
          <Bell className={`size-4 ${hasUnread ? "text-primary" : "text-muted-foreground"}`} />
          {badgeLabel && (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {badgeLabel}
            </span>
          )}
          <span className="sr-only">Notifikasi</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[340px] rounded-xl border-border/60 p-2 shadow-lg">
        <DropdownMenuLabel className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-foreground">Notifikasi</span>
            {refreshing && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground">Ringkasan tugas yang perlu ditindaklanjuti.</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {loading ? (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Memuat notifikasi...
          </div>
        ) : orderedItems.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
            <Clock3 className="size-4" />
            Tidak ada notifikasi baru.
          </div>
        ) : (
          <div className="space-y-2">
            {highPriorityItems.length > 0 && (
              <div className="px-2 pb-1 pt-0.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Prioritas Tinggi
                </p>
              </div>
            )}
            {highPriorityItems.map((item) => (
              <DropdownMenuItem key={item.id} asChild className="rounded-lg p-0 focus:bg-transparent">
                <Link href={item.href} className="w-full rounded-lg border border-border/50 bg-background px-3 py-2.5 hover:bg-muted/30">
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${toneClassMap[item.tone]}`}>
                      {item.count}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                </Link>
              </DropdownMenuItem>
            ))}
            {otherItems.length > 0 && (
              <>
                <div className="px-2 pb-1 pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Update Lainnya
                  </p>
                </div>
                {otherItems.map((item) => (
                  <DropdownMenuItem key={item.id} asChild className="rounded-lg p-0 focus:bg-transparent">
                    <Link href={item.href} className="w-full rounded-lg border border-border/50 bg-background px-3 py-2.5 hover:bg-muted/30">
                      <div className="flex items-start gap-2">
                        <span className={`mt-0.5 inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${toneClassMap[item.tone]}`}>
                          {item.count}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                    </Link>
                  </DropdownMenuItem>
                ))}
              </>
            )}
          </div>
        )}

        {orderedItems.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/dashboard/borrowing" className="rounded-lg text-xs text-muted-foreground">
                <AlertTriangle className="size-3.5" />
                Buka modul Peminjaman untuk tindakan lanjut
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
