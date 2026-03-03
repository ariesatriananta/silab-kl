"use client"

import { useMemo, useState } from "react"
import { CalendarDays, Clock3, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type StudentLabScheduleRow = {
  id: string
  labId: string
  labName: string
  courseName: string
  groupName: string
  instructorName: string
  dateLabel: string
  dateKey: string
  startTimeLabel: string
  endTimeLabel: string
  startAtMs: number
  capacity: number
  enrolledCount: number
  status: "ongoing" | "upcoming" | "finished"
}

export function StudentLabSchedulePageClient({ rows }: { rows: StudentLabScheduleRow[] }) {
  const [search, setSearch] = useState("")
  const [labFilter, setLabFilter] = useState("all")

  const labOptions = useMemo(
    () =>
      Array.from(
        new Map(rows.map((row) => [row.labId, { id: row.labId, name: row.labName }])).values(),
      ).sort((a, b) => a.name.localeCompare(b.name, "id-ID")),
    [rows],
  )

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    const statusOrder: Record<StudentLabScheduleRow["status"], number> = {
      ongoing: 0,
      upcoming: 1,
      finished: 2,
    }
    return rows
      .filter((row) => {
        const matchesLab = labFilter === "all" || row.labId === labFilter
        if (!matchesLab) return false
        if (!keyword) return true
        return (
          row.courseName.toLowerCase().includes(keyword) ||
          row.groupName.toLowerCase().includes(keyword) ||
          row.instructorName.toLowerCase().includes(keyword) ||
          row.labName.toLowerCase().includes(keyword)
        )
      })
      .sort((a, b) => {
        const statusDiff = statusOrder[a.status] - statusOrder[b.status]
        if (statusDiff !== 0) return statusDiff
        if (a.status === "finished") return b.startAtMs - a.startAtMs
        return a.startAtMs - b.startAtMs
      })
  }, [labFilter, rows, search])

  const summary = useMemo(() => {
    const available = filteredRows.filter((row) => row.enrolledCount < row.capacity).length
    const full = filteredRows.filter((row) => row.enrolledCount >= row.capacity).length
    const ongoing = filteredRows.filter((row) => row.status === "ongoing").length
    return {
      total: filteredRows.length,
      available,
      full,
      ongoing,
    }
  }, [filteredRows])

  const statusBadge = (status: StudentLabScheduleRow["status"]) => {
    if (status === "ongoing") {
      return <Badge className="rounded-full border-primary/20 bg-primary/10 text-primary">Sedang Berlangsung</Badge>
    }
    if (status === "upcoming") {
      return <Badge className="rounded-full border-border/60 bg-muted text-foreground">Akan Datang</Badge>
    }
    return <Badge className="rounded-full border-border/60 bg-muted/40 text-muted-foreground">Selesai</Badge>
  }

  const todayKey = useMemo(
    () =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    [],
  )

  return (
    <div className="min-w-0 overflow-x-hidden flex flex-col gap-6 p-4 lg:p-6">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Ketersediaan Ruang Lab</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Lihat jadwal penggunaan laboratorium secara read-only sebelum mengajukan kegiatan.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:w-[360px]">
            <div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
              <p className="text-xs text-muted-foreground">Jadwal Ditampilkan</p>
              <p className="text-lg font-semibold text-foreground">{summary.total}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
              <p className="text-xs text-muted-foreground">Sedang Berlangsung</p>
              <p className="text-lg font-semibold text-foreground">{summary.ongoing}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
              <p className="text-xs text-muted-foreground">Slot Masih Tersedia</p>
              <p className="text-lg font-semibold text-success-foreground">{summary.available}</p>
            </div>
            <div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
              <p className="text-xs text-muted-foreground">Slot Penuh</p>
              <p className="text-lg font-semibold text-destructive">{summary.full}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_260px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Cari mata kuliah, kelompok, dosen, atau lab..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Select value={labFilter} onValueChange={setLabFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Semua Lab" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Lab</SelectItem>
            {labOptions.map((lab) => (
              <SelectItem key={lab.id} value={lab.id}>
                {lab.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {filteredRows.map((row) => {
          const remaining = Math.max(0, row.capacity - row.enrolledCount)
          const isFull = remaining === 0
          return (
            <Card key={row.id} className="border-border/50 bg-card shadow-sm">
              <CardContent className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-card-foreground">{row.courseName}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.labName} • Kelompok {row.groupName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {row.dateKey === todayKey && (
                      <Badge className="rounded-full border-success/20 bg-success/10 text-success-foreground">
                        Hari Ini
                      </Badge>
                    )}
                    {statusBadge(row.status)}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                  <div className="rounded-lg border border-border/50 bg-muted/25 px-2 py-1.5">
                    <p className="mb-0.5 text-[11px] uppercase tracking-wide">Tanggal</p>
                    <p className="text-foreground">{row.dateLabel}</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-muted/25 px-2 py-1.5">
                    <p className="mb-0.5 text-[11px] uppercase tracking-wide">Waktu</p>
                    <p className="text-foreground">
                      {row.startTimeLabel} - {row.endTimeLabel}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-muted/25 px-2 py-1.5">
                    <p className="mb-0.5 text-[11px] uppercase tracking-wide">Kapasitas</p>
                    <p className="text-foreground">{row.capacity}</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-muted/25 px-2 py-1.5">
                    <p className="mb-0.5 text-[11px] uppercase tracking-wide">Sisa Slot</p>
                    <p className={isFull ? "text-destructive" : "text-success-foreground"}>{remaining}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5" />
                    <span>Dosen: {row.instructorName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock3 className="size-3.5" />
                    <span>
                      Terdaftar {row.enrolledCount}/{row.capacity}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredRows.length === 0 && (
        <Empty className="border border-border/50 bg-muted/20 py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarDays className="size-5" />
            </EmptyMedia>
            <EmptyTitle className="text-base">Jadwal tidak ditemukan</EmptyTitle>
            <EmptyDescription>
              Ubah filter kata kunci atau pilihan laboratorium untuk melihat jadwal yang tersedia.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <button
              type="button"
              className="rounded-md border border-border/60 px-3 py-1.5 text-sm text-foreground transition hover:bg-muted/50"
              onClick={() => {
                setSearch("")
                setLabFilter("all")
              }}
            >
              Reset Filter
            </button>
          </EmptyContent>
        </Empty>
      )}
    </div>
  )
}
