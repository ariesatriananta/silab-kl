"use client"

import { useActionState, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { CalendarDays, Clock3, FilePlus2, Printer, Search, XCircle } from "lucide-react"

import {
  cancelStudentLabBookingAction,
  createStudentLabBookingAction,
  createStudentLabUsageAction,
  type StudentLabBookingActionResult,
} from "@/app/dashboard/student-lab-schedule/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

export type StudentLabScheduleRow = {
  id: string
  source: "schedule" | "booking_request"
  sourceStatus: "final" | "pending"
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
  endAtMs: number
  status: "ongoing" | "upcoming" | "finished"
}

export type StudentLabBookingRow = {
  id: string
  code: string
  labId: string
  labName: string
  status: "pending" | "approved" | "rejected" | "cancelled"
  courseName: string
  materialTopic: string
  studyProgram: string
  semesterClassLabel: string
  groupName: string
  advisorLecturerName: string
  plannedDateLabel: string
  plannedTimeLabel: string
  note: string | null
  rejectionReason: string | null
  usageLogId: string | null
  canCancel: boolean
  canFillUsage: boolean
  canPrintUsage: boolean
}

type LabOption = { id: string; name: string }

export type StudentLabBookingRouteOption = {
  labId: string
  lecturers: Array<{ id: string; name: string }>
  plpApprovers: Array<{ id: string; name: string; identifier: string | null }>
}

export type StudentLabAvailabilityFilters = {
  search: string
  labId: string
  windowLabel: string
  totalItems: number
}

export type StudentLabAvailabilityPagination = {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  showingFrom: number
  showingTo: number
}

const studyProgramOptions = ["Sanitasi", "Sanitasi Lingkungan"] as const

function localDateTimeValue(minutesOffset = 60) {
  const target = new Date(Date.now() + minutesOffset * 60 * 1000)
  const wib = new Date(target.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }))
  const yyyy = wib.getFullYear()
  const mm = String(wib.getMonth() + 1).padStart(2, "0")
  const dd = String(wib.getDate()).padStart(2, "0")
  const hh = String(wib.getHours()).padStart(2, "0")
  const mi = String(wib.getMinutes()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

function splitDateTimeValue(value: string) {
  const [datePart = "", timePart = ""] = value.split("T")
  const normalizedTime = timePart.length >= 5 ? timePart.slice(0, 5) : "08:00"
  return {
    date: datePart,
    time: normalizedTime,
  }
}

export function StudentLabSchedulePageClient({
  rows,
  labs,
  myBookings,
  bookingRoutes,
  availabilityFilters,
  availabilityPagination,
}: {
  rows: StudentLabScheduleRow[]
  labs: LabOption[]
  myBookings: StudentLabBookingRow[]
  bookingRoutes: StudentLabBookingRouteOption[]
  availabilityFilters: StudentLabAvailabilityFilters
  availabilityPagination: StudentLabAvailabilityPagination
}) {
  const { toast } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const shownToastKeys = useRef<string[]>([])
  const [isPending, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<"availability" | "mine">("availability")
  const [createOpen, setCreateOpen] = useState(false)
  const [search, setSearch] = useState(availabilityFilters.search)
  const [bookingLabId, setBookingLabId] = useState(labs[0]?.id ?? "")
  const [selectedLecturerId, setSelectedLecturerId] = useState("")
  const [studyProgram, setStudyProgram] = useState<(typeof studyProgramOptions)[number] | undefined>(undefined)
  const initialStart = localDateTimeValue(60)
  const initialEnd = localDateTimeValue(180)
  const [plannedStartDate, setPlannedStartDate] = useState(splitDateTimeValue(initialStart).date)
  const [plannedStartTime, setPlannedStartTime] = useState(splitDateTimeValue(initialStart).time)
  const [plannedEndDate, setPlannedEndDate] = useState(splitDateTimeValue(initialEnd).date)
  const [plannedEndTime, setPlannedEndTime] = useState(splitDateTimeValue(initialEnd).time)
  const [cancelTarget, setCancelTarget] = useState<StudentLabBookingRow | null>(null)
  const [usageTarget, setUsageTarget] = useState<StudentLabBookingRow | null>(null)
  const [usageAttendanceText, setUsageAttendanceText] = useState("")
  const deferredSearch = useDeferredValue(search)

  const [createState, createAction, createPending] = useActionState(
    createStudentLabBookingAction,
    null as StudentLabBookingActionResult | null,
  )
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelStudentLabBookingAction,
    null as StudentLabBookingActionResult | null,
  )
  const [createUsageState, createUsageAction, createUsagePending] = useActionState(
    createStudentLabUsageAction,
    null as StudentLabBookingActionResult | null,
  )

  useEffect(() => {
    const states = [
      createState ? { key: `create:${createState.ok}:${createState.message}`, title: "Booking Ruang", ...createState } : null,
      cancelState ? { key: `cancel:${cancelState.ok}:${cancelState.message}`, title: "Booking Ruang", ...cancelState } : null,
      createUsageState ? { key: `usage:${createUsageState.ok}:${createUsageState.message}`, title: "Penggunaan Lab", ...createUsageState } : null,
    ].filter(Boolean) as Array<{ key: string; title: string; ok: boolean; message: string }>

    for (const item of states) {
      if (shownToastKeys.current.includes(item.key)) continue
      shownToastKeys.current.push(item.key)
      toast({
        title: item.title,
        description: item.message,
        variant: item.ok ? "default" : "destructive",
      })
    }
  }, [cancelState, createState, createUsageState, toast])

  useEffect(() => {
    if (!createState?.ok) return
    queueMicrotask(() => {
      setCreateOpen(false)
      setSelectedLecturerId("")
      setStudyProgram(undefined)
      const resetStart = splitDateTimeValue(localDateTimeValue(60))
      const resetEnd = splitDateTimeValue(localDateTimeValue(180))
      setPlannedStartDate(resetStart.date)
      setPlannedStartTime(resetStart.time)
      setPlannedEndDate(resetEnd.date)
      setPlannedEndTime(resetEnd.time)
      setActiveTab("mine")
    })
  }, [createState])

  useEffect(() => {
    if (!cancelState?.ok) return
    queueMicrotask(() => setCancelTarget(null))
  }, [cancelState])

  useEffect(() => {
    if (!createUsageState?.ok) return
    queueMicrotask(() => {
      setUsageTarget(null)
      setUsageAttendanceText("")
    })
  }, [createUsageState])

  useEffect(() => {
    setSearch(availabilityFilters.search)
  }, [availabilityFilters.search])

  useEffect(() => {
    const nextSearch = deferredSearch.trim()
    const currentSearch = searchParams.get("search") ?? ""
    if (nextSearch === currentSearch) return

    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (nextSearch) params.set("search", nextSearch)
      else params.delete("search")
      params.delete("page")

      startTransition(() => {
        router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, {
          scroll: false,
        })
      })
    }, 300)

    return () => clearTimeout(handle)
  }, [deferredSearch, pathname, router, searchParams])

  const selectedBookingRoute = useMemo(
    () => bookingRoutes.find((item) => item.labId === bookingLabId) ?? null,
    [bookingLabId, bookingRoutes],
  )

  const selectedLecturer = useMemo(
    () => selectedBookingRoute?.lecturers.find((item) => item.id === selectedLecturerId) ?? null,
    [selectedLecturerId, selectedBookingRoute],
  )

  useEffect(() => {
    if (!selectedBookingRoute) {
      setSelectedLecturerId("")
      return
    }
    const stillValid = selectedBookingRoute.lecturers.some((item) => item.id === selectedLecturerId)
    if (!stillValid) {
      setSelectedLecturerId(selectedBookingRoute.lecturers[0]?.id ?? "")
    }
  }, [selectedBookingRoute, selectedLecturerId])

  const summary = useMemo(() => {
    const pendingBlock = rows.filter((row) => row.sourceStatus === "pending").length
    const finalBlock = rows.filter((row) => row.sourceStatus === "final").length
    const ongoing = rows.filter((row) => row.status === "ongoing").length
    return {
      total: availabilityFilters.totalItems,
      pendingBlock,
      finalBlock,
      ongoing,
    }
  }, [availabilityFilters.totalItems, rows])

  const bookingSummary = useMemo(
    () => ({
      total: myBookings.length,
      pending: myBookings.filter((row) => row.status === "pending").length,
      approved: myBookings.filter((row) => row.status === "approved").length,
      closed: myBookings.filter((row) => row.status === "rejected" || row.status === "cancelled").length,
    }),
    [myBookings],
  )

  const isBookingApprovalReady = Boolean(selectedLecturer && (selectedBookingRoute?.plpApprovers.length ?? 0) > 0)
  const scheduleTimeOptions = useMemo(() => {
    const options: string[] = []
    for (let hour = 0; hour < 24; hour += 1) {
      for (const minute of [0, 15, 30, 45]) {
        options.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`)
      }
    }
    return options
  }, [])
  const plannedStartAt = `${plannedStartDate}T${plannedStartTime}`
  const plannedEndAt = `${plannedEndDate}T${plannedEndTime}`

  function updateAvailabilityQuery(updater: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    updater(params)
    startTransition(() => {
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, {
        scroll: false,
      })
    })
  }

  const statusBadge = (row: StudentLabScheduleRow) => {
    if (row.sourceStatus === "pending") {
      return (
        <Badge className="rounded-full border-warning/20 bg-warning/10 text-warning-foreground">
          Menunggu Approval
        </Badge>
      )
    }
    if (row.status === "ongoing") {
      return <Badge className="rounded-full border-primary/20 bg-primary/10 text-primary">Sedang Berlangsung</Badge>
    }
    if (row.status === "upcoming") {
      return <Badge className="rounded-full border-border/60 bg-muted text-foreground">Jadwal Final</Badge>
    }
    return <Badge className="rounded-full border-border/60 bg-muted/40 text-muted-foreground">Selesai</Badge>
  }

  const bookingStatusBadge = (status: StudentLabBookingRow["status"]) => {
    if (status === "pending") {
      return <Badge className="rounded-full border-warning/20 bg-warning/10 text-warning-foreground">Menunggu</Badge>
    }
    if (status === "approved") {
      return <Badge className="rounded-full border-success/20 bg-success/10 text-success-foreground">Disetujui</Badge>
    }
    if (status === "rejected") {
      return <Badge className="rounded-full border-destructive/20 bg-destructive/10 text-destructive">Ditolak</Badge>
    }
    return <Badge className="rounded-full border-border/60 bg-muted text-muted-foreground">Dibatalkan</Badge>
  }

  return (
    <div className="min-w-0 overflow-x-hidden flex flex-col gap-6 p-4 lg:p-6">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Booking Ruang Lab</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Lihat slot penggunaan ruang, ajukan booking, lalu pantau status approval Anda.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <FilePlus2 className="size-4" />
                  Ajukan Booking
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] md:max-w-[50vw] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Ajukan Booking Ruang Lab</DialogTitle>
                  <DialogDescription>
                    Pengajuan akan diperiksa oleh Petugas PLP. Slot bentrok dengan jadwal final atau pengajuan lain akan ditolak.
                  </DialogDescription>
                </DialogHeader>
                <form action={createAction} className="grid gap-4">
                  {createState && !createState.ok && (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {createState.message}
                    </div>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="labId">Ruang Lab</Label>
                      <Select value={bookingLabId} onValueChange={setBookingLabId}>
                        <SelectTrigger id="labId" className="w-full">
                          <SelectValue placeholder="Pilih ruang lab" />
                        </SelectTrigger>
                        <SelectContent>
                          {labs.map((lab) => (
                            <SelectItem key={lab.id} value={lab.id}>
                              {lab.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <input type="hidden" name="labId" value={bookingLabId} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="studyProgram">Prodi</Label>
                      <Select value={studyProgram} onValueChange={(value) => setStudyProgram(value as (typeof studyProgramOptions)[number])}>
                        <SelectTrigger id="studyProgram" className="w-full">
                          <SelectValue placeholder="Pilih prodi" />
                        </SelectTrigger>
                        <SelectContent>
                          {studyProgramOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <input type="hidden" name="studyProgram" value={studyProgram ?? ""} />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="courseName">Mata Kuliah</Label>
                      <Input id="courseName" name="courseName" placeholder="Contoh: Kimia Lingkungan" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="materialTopic">Materi</Label>
                      <Input id="materialTopic" name="materialTopic" placeholder="Contoh: Uji Kualitas Air" required />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-2">
                      <Label htmlFor="semesterClassLabel">Semester - Kelas</Label>
                      <Input id="semesterClassLabel" name="semesterClassLabel" placeholder="Contoh: 4 - B" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="groupName">Kelompok</Label>
                      <Input id="groupName" name="groupName" placeholder="A / B / C" required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="advisorLecturerName">Dosen Pembimbing</Label>
                      <Select value={selectedLecturerId} onValueChange={setSelectedLecturerId}>
                        <SelectTrigger id="advisorLecturerName" className="w-full">
                          <SelectValue placeholder="Pilih dosen (sesuai lab)" />
                        </SelectTrigger>
                        <SelectContent>
                          {(selectedBookingRoute?.lecturers ?? []).map((lecturer) => (
                            <SelectItem key={lecturer.id} value={lecturer.id}>
                              {lecturer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <input type="hidden" name="advisorLecturerName" value={selectedLecturer?.name ?? ""} />
                      {selectedBookingRoute && selectedBookingRoute.lecturers.length === 0 && (
                        <p className="text-xs text-warning-foreground">Belum ada dosen yang ter-assign pada lab ini.</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-3">
                      <Label>Waktu Mulai</Label>
                      <div className="grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
                        <Input
                          id="plannedStartDate"
                          type="date"
                          value={plannedStartDate}
                          onChange={(event) => setPlannedStartDate(event.target.value)}
                          required
                        />
                        <Select value={plannedStartTime} onValueChange={setPlannedStartTime}>
                          <SelectTrigger id="plannedStartTime" className="w-full">
                            <SelectValue placeholder="Pilih jam mulai" />
                          </SelectTrigger>
                          <SelectContent>
                            {scheduleTimeOptions.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid gap-3">
                      <Label>Waktu Selesai</Label>
                      <div className="grid gap-3 sm:grid-cols-[1.15fr_0.85fr]">
                        <Input
                          id="plannedEndDate"
                          type="date"
                          value={plannedEndDate}
                          onChange={(event) => setPlannedEndDate(event.target.value)}
                          required
                        />
                        <Select value={plannedEndTime} onValueChange={setPlannedEndTime}>
                          <SelectTrigger id="plannedEndTime" className="w-full">
                            <SelectValue placeholder="Pilih jam selesai" />
                          </SelectTrigger>
                          <SelectContent>
                            {scheduleTimeOptions.map((time) => (
                              <SelectItem key={time} value={time}>
                                {time}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                  <input type="hidden" name="plannedStartAt" value={plannedStartAt} />
                  <input type="hidden" name="plannedEndAt" value={plannedEndAt} />

                  <div className="grid gap-2">
                    <Label htmlFor="note">Catatan (opsional)</Label>
                    <Textarea id="note" name="note" placeholder="Tuliskan kebutuhan khusus penggunaan ruang jika ada." />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-3 text-sm">
                      <p className="font-medium text-foreground">Pembimbing Akademik</p>
                      <div className="mt-2 rounded-lg border border-border/60 bg-card px-3 py-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Dosen Pembimbing</p>
                        {selectedLecturer ? (
                          <p className="mt-1 text-sm font-medium text-foreground">{selectedLecturer.name}</p>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">Pilih dosen pembimbing terlebih dahulu.</p>
                        )}
                      </div>
                    </div>

                    <div
                      className={`rounded-xl border px-3 py-3 text-sm ${
                        selectedBookingRoute?.plpApprovers.length
                          ? "border-success/25 bg-success/5"
                          : "border-warning/25 bg-warning/5"
                      }`}
                    >
                      <p className="font-medium text-foreground">Persetujuan</p>
                      <div className="mt-2 rounded-lg border border-border/60 bg-card px-3 py-2">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Approver Booking</p>
                        <p className="mt-1 text-sm font-medium text-foreground">Petugas PLP</p>
                        {selectedBookingRoute?.plpApprovers.length ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {selectedBookingRoute.plpApprovers
                              .map((item) => (item.identifier ? `${item.name} (${item.identifier})` : item.name))
                              .join(", ")}
                          </p>
                        ) : (
                          <p className="mt-1 text-xs text-muted-foreground">Belum ada Petugas PLP ter-assign pada lab ini.</p>
                        )}
                      </div>
                      {!selectedBookingRoute?.plpApprovers.length && (
                        <p className="mt-2 text-xs text-warning-foreground">
                          Pengajuan belum siap karena lab ini belum memiliki Petugas PLP ter-assign untuk approval.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-3 text-sm text-muted-foreground">
                    Slot dengan status <span className="font-medium text-foreground">Jadwal Final</span> dan{" "}
                    <span className="font-medium text-foreground">Menunggu Approval</span> dianggap terblokir agar tidak terjadi double booking.
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                      Batal
                    </Button>
                    <Button type="submit" disabled={createPending || !isBookingApprovalReady}>
                      {createPending ? "Mengirim..." : "Kirim Pengajuan"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "availability" | "mine")} className="flex flex-col gap-4">
        <TabsList className="grid h-12 w-full grid-cols-2 items-stretch gap-1 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-1">
          <TabsTrigger className="h-full w-full rounded-xl border border-transparent bg-transparent py-0 text-sm font-medium leading-none text-muted-foreground transition-all data-[state=active]:border-primary/25 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm" value="availability">
            Availability Ruang
          </TabsTrigger>
          <TabsTrigger className="h-full w-full rounded-xl border border-transparent bg-transparent py-0 text-sm font-medium leading-none text-muted-foreground transition-all data-[state=active]:border-primary/25 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm" value="mine">
            Booking Saya
          </TabsTrigger>
        </TabsList>

        <TabsContent value="availability" className="mt-0 flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <Card className="border-border/50 bg-card shadow-sm py-2">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Slot Tampil</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{summary.total}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card shadow-sm py-2">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Sedang Berlangsung</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{summary.ongoing}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card shadow-sm py-2">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Blok Final</p>
                <p className="mt-1 text-2xl font-semibold text-primary">{summary.finalBlock}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card shadow-sm py-2">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Blok Pending</p>
                <p className="mt-1 text-2xl font-semibold text-warning-foreground">{summary.pendingBlock}</p>
              </CardContent>
            </Card>
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
            <Select
              value={availabilityFilters.labId}
              onValueChange={(value) =>
                updateAvailabilityQuery((params) => {
                  if (value === "all") params.delete("lab")
                  else params.set("lab", value)
                  params.delete("page")
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Semua Lab" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Lab</SelectItem>
                {labs.map((lab) => (
                  <SelectItem key={lab.id} value={lab.id}>
                    {lab.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-border/50 bg-card/70 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-muted-foreground">
                Menampilkan <span className="font-medium text-foreground">{availabilityPagination.showingFrom}</span>
                {" - "}
                <span className="font-medium text-foreground">{availabilityPagination.showingTo}</span> dari{" "}
                <span className="font-medium text-foreground">{availabilityPagination.totalItems}</span> slot
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Jendela data availability dibatasi {availabilityFilters.windowLabel}.
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {availabilityFilters.labId === "all"
                ? "Semua Lab"
                : `Lab terpilih: ${labs.find((lab) => lab.id === availabilityFilters.labId)?.name ?? "-"}`}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {rows.map((row) => (
              <Card key={`${row.source}-${row.id}`} className="border-border/50 bg-card shadow-sm">
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-card-foreground">{row.courseName}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.labName} - Kelompok {row.groupName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">{statusBadge(row)}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-3">
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
                      <p className="mb-0.5 text-[11px] uppercase tracking-wide">Sumber</p>
                      <p className="text-foreground">
                        {row.sourceStatus === "pending" ? "Pengajuan Menunggu Approval" : "Jadwal Final"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      <span>Pembimbing: {row.instructorName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock3 className="size-3.5" />
                      <span>{row.status === "finished" ? "Sesi selesai" : "Slot sedang digunakan"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {availabilityPagination.totalPages > 1 && (
            <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Halaman <span className="font-medium text-foreground">{availabilityPagination.page}</span> dari{" "}
                <span className="font-medium text-foreground">{availabilityPagination.totalPages}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={availabilityPagination.page <= 1 || isPending}
                  onClick={() =>
                    updateAvailabilityQuery((params) => {
                      const nextPage = Math.max(1, availabilityPagination.page - 1)
                      if (nextPage <= 1) params.delete("page")
                      else params.set("page", String(nextPage))
                    })
                  }
                >
                  Sebelumnya
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={availabilityPagination.page >= availabilityPagination.totalPages || isPending}
                  onClick={() =>
                    updateAvailabilityQuery((params) => {
                      params.set("page", String(availabilityPagination.page + 1))
                    })
                  }
                >
                  Berikutnya
                </Button>
              </div>
            </div>
          )}

          {availabilityPagination.totalItems === 0 && (
            <Empty className="border border-border/50 bg-muted/20 py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarDays className="size-5" />
                </EmptyMedia>
                <EmptyTitle className="text-base">Tidak ada slot ditampilkan</EmptyTitle>
                <EmptyDescription>
                  Ubah filter untuk melihat slot penggunaan ruang yang sedang memblok waktu lab.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("")
                    startTransition(() => {
                      router.replace(pathname, { scroll: false })
                    })
                  }}
                >
                  Reset Filter
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </TabsContent>

        <TabsContent value="mine" className="mt-0 flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <Card className="border-border/50 bg-card shadow-sm py-2">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Total Booking</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{bookingSummary.total}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card shadow-sm py-2">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Menunggu Approval</p>
                <p className="mt-1 text-2xl font-semibold text-warning-foreground">{bookingSummary.pending}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card shadow-sm py-2">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Disetujui</p>
                <p className="mt-1 text-2xl font-semibold text-success-foreground">{bookingSummary.approved}</p>
              </CardContent>
            </Card>
            <Card className="border-border/50 bg-card shadow-sm py-2">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Selesai / Ditutup</p>
                <p className="mt-1 text-2xl font-semibold text-muted-foreground">{bookingSummary.closed}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {myBookings.map((booking) => (
              <Card key={booking.id} className="border-border/50 bg-card shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{booking.courseName}</CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {booking.code} - {booking.labName}
                      </p>
                    </div>
                    {bookingStatusBadge(booking.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Waktu Rencana</p>
                      <p className="text-foreground">{booking.plannedDateLabel}</p>
                      <p className="text-foreground">{booking.plannedTimeLabel}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Prodi / Semester - Kelas</p>
                      <p className="text-foreground">{booking.studyProgram}</p>
                      <p className="text-foreground">{booking.semesterClassLabel}</p>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Materi</p>
                      <p className="text-foreground">{booking.materialTopic}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Kelompok / Pembimbing</p>
                      <p className="text-foreground">Kelompok {booking.groupName}</p>
                      <p className="text-foreground">{booking.advisorLecturerName}</p>
                    </div>
                  </div>

                  {booking.note && (
                    <div>
                      <p className="text-xs text-muted-foreground">Catatan</p>
                      <p className="text-foreground">{booking.note}</p>
                    </div>
                  )}

                  {booking.rejectionReason && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                      <p className="text-xs text-muted-foreground">Alasan Penolakan</p>
                      <p className="text-sm text-destructive">{booking.rejectionReason}</p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    {booking.canFillUsage && (
                      <Button type="button" onClick={() => setUsageTarget(booking)}>
                        <FilePlus2 className="size-4" />
                        Isi Penggunaan Lab
                      </Button>
                    )}
                    {booking.canPrintUsage && booking.usageLogId && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => window.open(`/lab-usage-proof/${booking.usageLogId}`, "_blank", "noopener,noreferrer")}
                      >
                        <Printer className="size-4" />
                        Cetak Lembar
                      </Button>
                    )}
                    {booking.canCancel && (
                      <Button type="button" variant="outline" onClick={() => setCancelTarget(booking)}>
                        <XCircle className="size-4" />
                        Batalkan
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {myBookings.length === 0 && (
            <Empty className="border border-border/50 bg-muted/20 py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FilePlus2 className="size-5" />
                </EmptyMedia>
                <EmptyTitle className="text-base">Belum ada booking ruang</EmptyTitle>
                <EmptyDescription>
                  Ajukan booking pertama Anda untuk memulai penggunaan ruang lab.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button type="button" onClick={() => setCreateOpen(true)}>
                  Ajukan Booking
                </Button>
              </EmptyContent>
            </Empty>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Batalkan Booking Ruang</DialogTitle>
            <DialogDescription>
              Booking yang dibatalkan akan melepaskan slot agar dapat diajukan kembali.
            </DialogDescription>
          </DialogHeader>
          {cancelTarget && (
            <form action={cancelAction} className="grid gap-4">
              <input type="hidden" name="requestId" value={cancelTarget.id} />
              {cancelState && !cancelState.ok && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {cancelState.message}
                </div>
              )}
              <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{cancelTarget.courseName}</p>
                <p className="mt-1">{cancelTarget.labName}</p>
                <p>{cancelTarget.plannedDateLabel}</p>
                <p>{cancelTarget.plannedTimeLabel}</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCancelTarget(null)}>
                  Tutup
                </Button>
                <Button type="submit" variant="destructive" disabled={cancelPending}>
                  {cancelPending ? "Membatalkan..." : "Ya, Batalkan"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!usageTarget} onOpenChange={(open) => !open && setUsageTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Isi Penggunaan Lab</DialogTitle>
            <DialogDescription>
              Isi daftar peserta yang benar-benar hadir. Setelah tersimpan, lembar pemakaian lab bisa dicetak ulang kapan saja.
            </DialogDescription>
          </DialogHeader>
          {usageTarget && (
            <form action={createUsageAction} className="grid gap-4">
              <input type="hidden" name="requestId" value={usageTarget.id} />
              {createUsageState && !createUsageState.ok && (
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {createUsageState.message}
                </div>
              )}
              <div className="rounded-xl border border-border/60 bg-muted/25 px-3 py-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{usageTarget.courseName}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <p>
                    Lab: <span className="text-foreground">{usageTarget.labName}</span>
                  </p>
                  <p>
                    Waktu: <span className="text-foreground">{usageTarget.plannedDateLabel}</span>
                  </p>
                  <p>
                    Jadwal: <span className="text-foreground">{usageTarget.plannedTimeLabel}</span>
                  </p>
                  <p>
                    Kelompok: <span className="text-foreground">{usageTarget.groupName}</span>
                  </p>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="usageAttendanceText">Daftar Peserta (1 baris per mahasiswa)</Label>
                <Textarea
                  id="usageAttendanceText"
                  name="attendanceText"
                  value={usageAttendanceText}
                  onChange={(event) => setUsageAttendanceText(event.target.value)}
                  rows={8}
                  placeholder={"Contoh:\nP27834021001 - Andi Pratama\nP27834021002 - Siti Aminah\natau cukup nama tanpa NIM"}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="usageNote">Catatan (opsional)</Label>
                <Textarea
                  id="usageNote"
                  name="note"
                  rows={3}
                  placeholder="Catatan sesi penggunaan lab jika diperlukan"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setUsageTarget(null)}>
                  Tutup
                </Button>
                <Button type="submit" disabled={createUsagePending}>
                  {createUsagePending ? "Menyimpan..." : "Simpan Penggunaan"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
