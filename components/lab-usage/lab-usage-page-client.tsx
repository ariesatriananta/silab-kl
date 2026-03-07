"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react"
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  GraduationCap,
  Pencil,
  Plus,
  Printer,
  Trash2,
  Users,
  XCircle,
} from "lucide-react"

import {
  approveLabBookingRequestAction,
  createLabScheduleAction,
  createLabUsageLogAction,
  deleteLabScheduleWithFeedbackAction,
  rejectLabBookingRequestAction,
  type LabUsageActionResult,
  updateLabScheduleAction,
} from "@/app/dashboard/lab-usage/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { ActionKpiTile } from "@/components/ui/action-kpi-tile"
import { useToast } from "@/hooks/use-toast"

export type LabUsageLabOption = { id: string; name: string }
export type LabUsageScheduleRow = {
  id: string
  labId: string
  labName: string
  courseName: string
  groupName: string
  instructorName: string
  scheduledDate: string
  startTime: string
  endTime: string
  capacity: number
  enrolledCount: number
}
export type LabUsageHistoryRow = {
  id: string
  displayId: string
  labId: string
  labName: string
  courseName: string
  groupName: string
  studentCount: number
  date: string
  startTime: string
  endTime: string
  durationLabel: string
  attendance: Array<{
    attendeeName: string
    attendeeNim: string | null
  }>
}
export type LabUsageAttendanceRow = LabUsageHistoryRow["attendance"][number]
export type LabUsageBookingRequestRow = {
  id: string
  code: string
  labId: string
  labName: string
  requesterName: string
  requesterNim: string | null
  courseName: string
  materialTopic: string
  studyProgram: string
  semesterClassLabel: string
  groupName: string
  advisorLecturerName: string
  plannedDate: string
  plannedTime: string
  requestedAt: string
  note: string | null
}

type Role = "admin" | "petugas_plp"

function localDateInputValue() {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, "0")
  const dd = String(now.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export function LabUsagePageClient({
  role,
  labs,
  schedules,
  history,
  bookingRequests,
  historyPagination,
}: {
  role: Role
  labs: LabUsageLabOption[]
  schedules: LabUsageScheduleRow[]
  history: LabUsageHistoryRow[]
  bookingRequests: LabUsageBookingRequestRow[]
  historyPagination: { page: number; pageSize: number; totalItems: number; totalPages: number }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [historyPagingPending, startHistoryPagingTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<"booking" | "schedule" | "history">(
    bookingRequests.length > 0 ? "booking" : "schedule",
  )
  const [createScheduleOpen, setCreateScheduleOpen] = useState(false)
  const [createUsageOpen, setCreateUsageOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<LabUsageScheduleRow | null>(null)
  const [deletingSchedule, setDeletingSchedule] = useState<LabUsageScheduleRow | null>(null)
  const [approveTarget, setApproveTarget] = useState<LabUsageBookingRequestRow | null>(null)
  const [rejectTarget, setRejectTarget] = useState<LabUsageBookingRequestRow | null>(null)
  const [scheduleLabId, setScheduleLabId] = useState(labs[0]?.id ?? "")
  const [usageLabId, setUsageLabId] = useState(labs[0]?.id ?? "")
  const [usageScheduleId, setUsageScheduleId] = useState<string>("none")
  const [usageCourseName, setUsageCourseName] = useState("")
  const [usageGroupName, setUsageGroupName] = useState("")
  const [usageDate, setUsageDate] = useState(localDateInputValue())
  const [usageStartTime, setUsageStartTime] = useState("")
  const [usageEndTime, setUsageEndTime] = useState("")
  const [usageAttendanceText, setUsageAttendanceText] = useState("")
  const [selectedHistory, setSelectedHistory] = useState<LabUsageHistoryRow | null>(null)

  const [createScheduleState, createScheduleAction, createSchedulePending] = useActionState(
    createLabScheduleAction,
    null as LabUsageActionResult | null,
  )
  const [updateScheduleState, updateScheduleAction, updateSchedulePending] = useActionState(
    updateLabScheduleAction,
    null as LabUsageActionResult | null,
  )
  const [createUsageState, createUsageAction, createUsagePending] = useActionState(
    createLabUsageLogAction,
    null as LabUsageActionResult | null,
  )
  const [deleteScheduleState, deleteScheduleAction, deleteSchedulePending] = useActionState(
    deleteLabScheduleWithFeedbackAction,
    null as LabUsageActionResult | null,
  )
  const [approveBookingState, approveBookingAction, approveBookingPending] = useActionState(
    approveLabBookingRequestAction,
    null as LabUsageActionResult | null,
  )
  const [rejectBookingState, rejectBookingAction, rejectBookingPending] = useActionState(
    rejectLabBookingRequestAction,
    null as LabUsageActionResult | null,
  )

  const { toast } = useToast()
  const shownToastKeys = useRef<string[]>([])

  const filteredSchedulesForUsageLab = useMemo(
    () => schedules.filter((s) => s.labId === usageLabId),
    [schedules, usageLabId],
  )
  const usageSummary = {
    schedules: schedules.length,
    bookingRequests: bookingRequests.length,
    history: history.length,
    noAttendanceLogs: history.filter((h) => h.attendance.length === 0).length,
  }
  const scheduleTimeOptions = useMemo(() => {
    const options: string[] = []
    for (let hour = 0; hour < 24; hour += 1) {
      for (const minute of [0, 15, 30, 45]) {
        options.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`)
      }
    }
    return options
  }, [])
  const usageTimeOptions = useMemo(() => {
    const set = new Set(scheduleTimeOptions)
    if (usageStartTime) set.add(usageStartTime)
    if (usageEndTime) set.add(usageEndTime)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [scheduleTimeOptions, usageStartTime, usageEndTime])

  const goToHistoryPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page > 1) params.set("histPage", String(page))
    else params.delete("histPage")
    const target = params.toString() ? `${pathname}?${params.toString()}` : pathname
    startHistoryPagingTransition(() => {
      router.replace(target, { scroll: false })
    })
  }

  useEffect(() => {
    const states = [
      createScheduleState
        ? { key: `schedule-create:${createScheduleState.ok}:${createScheduleState.message}`, title: "Jadwal Lab", ...createScheduleState }
        : null,
      updateScheduleState
        ? { key: `schedule-update:${updateScheduleState.ok}:${updateScheduleState.message}`, title: "Jadwal Lab", ...updateScheduleState }
        : null,
      createUsageState
        ? { key: `usage-create:${createUsageState.ok}:${createUsageState.message}`, title: "Riwayat Lab", ...createUsageState }
        : null,
      deleteScheduleState
        ? { key: `schedule-delete:${deleteScheduleState.ok}:${deleteScheduleState.message}`, title: "Jadwal Lab", ...deleteScheduleState }
        : null,
      approveBookingState
        ? { key: `booking-approve:${approveBookingState.ok}:${approveBookingState.message}`, title: "Booking Ruang", ...approveBookingState }
        : null,
      rejectBookingState
        ? { key: `booking-reject:${rejectBookingState.ok}:${rejectBookingState.message}`, title: "Booking Ruang", ...rejectBookingState }
        : null,
    ].filter(Boolean) as Array<{ key: string; title: string; ok: boolean; message: string }>

    for (const s of states) {
      if (shownToastKeys.current.includes(s.key)) continue
      shownToastKeys.current.push(s.key)
      toast({
        title: s.title,
        description: s.message,
        variant: s.ok ? "default" : "destructive",
      })
    }
  }, [
    approveBookingState,
    createScheduleState,
    updateScheduleState,
    createUsageState,
    deleteScheduleState,
    rejectBookingState,
    toast,
  ])

  useEffect(() => {
    if (createUsageState?.ok) {
      queueMicrotask(() => {
        setCreateUsageOpen(false)
        setUsageAttendanceText("")
      })
    }
  }, [createUsageState])

  useEffect(() => {
    if (approveBookingState?.ok) {
      queueMicrotask(() => {
        setApproveTarget(null)
        setActiveTab("schedule")
      })
    }
  }, [approveBookingState])

  useEffect(() => {
    if (rejectBookingState?.ok) {
      queueMicrotask(() => {
        setRejectTarget(null)
      })
    }
  }, [rejectBookingState])

  const handleUsageLabChange = (labId: string) => {
    setUsageLabId(labId)
    const selectedScheduleStillValid = schedules.some((s) => s.labId === labId && s.id === usageScheduleId)
    if (!selectedScheduleStillValid) {
      setUsageScheduleId("none")
    }
  }

  const handleUsageScheduleChange = (value: string) => {
    setUsageScheduleId(value)
    if (value === "none") return
    const selected = schedules.find((s) => s.id === value)
    if (!selected) return
    setUsageLabId(selected.labId)
    setUsageCourseName(selected.courseName)
    setUsageGroupName(selected.groupName)
    setUsageDate(selected.scheduledDate)
    setUsageStartTime(selected.startTime)
    setUsageEndTime(selected.endTime)
  }

  return (
    <div className="min-w-0 overflow-x-hidden flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Penggunaan Lab</h1>
          <p className="text-sm text-muted-foreground">
            Kelola jadwal final, approval booking ruang mahasiswa, dan catat penggunaan aktual laboratorium.
          </p>
        </div>
        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
          <Button
            type="button"
            onClick={() => {
              setActiveTab("history")
              setCreateUsageOpen(true)
            }}
          >
            <Plus className="size-4" />
            Catat Penggunaan Lab
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setActiveTab("schedule")
              setCreateScheduleOpen(true)
            }}
          >
            <Plus className="size-4" />
            Tambah Jadwal
          </Button>
        </div>
      </div>

      <Card className="border-border/50 bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-card-foreground">Fokus Kerja</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ActionKpiTile
            title="Approval Booking"
            metric={usageSummary.bookingRequests}
            description="Pengajuan mahasiswa menunggu tindakan"
            tone={usageSummary.bookingRequests > 0 ? "warning" : "muted"}
            onClick={() => setActiveTab("booking")}
          />
          <ActionKpiTile
            title="Riwayat Penggunaan"
            metric={usageSummary.history}
            description="Log penggunaan tersimpan"
            tone="muted"
            onClick={() => setActiveTab("history")}
          />
          <ActionKpiTile
            title="Jadwal Final"
            metric={usageSummary.schedules}
            description="Slot lab yang sudah dikonfirmasi"
            tone="muted"
            onClick={() => setActiveTab("schedule")}
          />
          <ActionKpiTile
            title="Tanpa Absensi"
            metric={usageSummary.noAttendanceLogs}
            description="Perlu dilengkapi agar data rapi"
            tone="warning"
            onClick={() => setActiveTab("history")}
          />
        </CardContent>
      </Card>

      <>
        <Dialog open={createScheduleOpen} onOpenChange={setCreateScheduleOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tambah Jadwal Lab</DialogTitle>
              <DialogDescription>
                {role === "admin"
                  ? "Admin dapat membuat jadwal untuk semua laboratorium."
                  : "Petugas PLP dapat membuat jadwal untuk laboratorium yang di-assign ke akun Anda."}
              </DialogDescription>
            </DialogHeader>
            <form action={createScheduleAction} className="grid gap-3">
              {createScheduleState && (
                <div className={`rounded-xl border px-3 py-2 text-sm ${createScheduleState.ok ? "border-success/20 bg-success/5 text-success-foreground" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
                  {createScheduleState.message}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Laboratorium</Label>
                  <Select name="labId" value={scheduleLabId} onValueChange={setScheduleLabId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih lab" />
                    </SelectTrigger>
                    <SelectContent>
                      {labs.map((lab) => (
                        <SelectItem key={lab.id} value={lab.id}>
                          {lab.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="scheduleDate">Tanggal</Label>
                  <Input id="scheduleDate" name="date" type="date" defaultValue={localDateInputValue()} required />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="courseName">Mata Kuliah</Label>
                  <Input id="courseName" name="courseName" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="groupName">Kelompok</Label>
                  <Input id="groupName" name="groupName" required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="instructorName">Dosen Pengampu</Label>
                <Input id="instructorName" name="instructorName" required />
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="grid gap-2 sm:col-span-1">
                  <Label htmlFor="startTime">Mulai</Label>
                  <Select name="startTime" defaultValue="08:00">
                    <SelectTrigger id="startTime" className="w-full">
                      <SelectValue placeholder="Pilih jam mulai" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {scheduleTimeOptions.map((time) => (
                        <SelectItem key={`start-${time}`} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 sm:col-span-1">
                  <Label htmlFor="endTime">Selesai</Label>
                  <Select name="endTime" defaultValue="10:00">
                    <SelectTrigger id="endTime" className="w-full">
                      <SelectValue placeholder="Pilih jam selesai" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {scheduleTimeOptions.map((time) => (
                        <SelectItem key={`end-${time}`} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2 sm:col-span-1">
                  <Label htmlFor="capacity">Kapasitas</Label>
                  <Input id="capacity" name="capacity" type="number" min={1} defaultValue={20} required />
                </div>
                <div className="grid gap-2 sm:col-span-1">
                  <Label htmlFor="enrolledCount">Terdaftar</Label>
                  <Input id="enrolledCount" name="enrolledCount" type="number" min={0} defaultValue={0} required />
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Gunakan form ini untuk perencanaan jadwal. Untuk aktivitas yang sudah berlangsung, gunakan <span className="font-medium text-foreground">Catat Penggunaan Lab</span>.
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setCreateScheduleOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={createSchedulePending}>
                  {createSchedulePending ? "Menyimpan..." : "Simpan Jadwal"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={createUsageOpen} onOpenChange={setCreateUsageOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Catat Riwayat Penggunaan Lab</DialogTitle>
              <DialogDescription>Digunakan setelah sesi praktikum/aktivitas lab selesai (bukan untuk membuat rencana jadwal).</DialogDescription>
            </DialogHeader>
            <form action={createUsageAction} className="grid gap-3">
              {createUsageState && (
                <div className={`rounded-xl border px-3 py-2 text-sm ${createUsageState.ok ? "border-success/20 bg-success/5 text-success-foreground" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
                  {createUsageState.message}
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Laboratorium</Label>
                  <Select name="labId" value={usageLabId} onValueChange={handleUsageLabChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih lab" />
                    </SelectTrigger>
                    <SelectContent>
                      {labs.map((lab) => (
                        <SelectItem key={lab.id} value={lab.id}>
                          {lab.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Link Jadwal (opsional)</Label>
                  <Select name="scheduleId" value={usageScheduleId} onValueChange={handleUsageScheduleChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih jadwal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tanpa jadwal</SelectItem>
                      {filteredSchedulesForUsageLab.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.courseName} - {s.groupName} ({s.scheduledDate} {s.startTime})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="usageCourseName">Mata Kuliah/Kegiatan</Label>
                  <Input
                    id="usageCourseName"
                    name="courseName"
                    value={usageCourseName}
                    onChange={(e) => setUsageCourseName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="usageGroupName">Kelompok</Label>
                  <Input
                    id="usageGroupName"
                    name="groupName"
                    value={usageGroupName}
                    onChange={(e) => setUsageGroupName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="usageDate">Tanggal</Label>
                  <Input
                    id="usageDate"
                    name="date"
                    type="date"
                    value={usageDate}
                    onChange={(e) => setUsageDate(e.target.value)}
                    required
                  />
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="usageStart">Mulai</Label>
                  <Select name="startTime" value={usageStartTime} onValueChange={setUsageStartTime}>
                    <SelectTrigger id="usageStart" className="w-full min-w-0">
                      <SelectValue placeholder="Pilih jam mulai" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {usageTimeOptions.map((time) => (
                        <SelectItem key={`usage-start-${time}`} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="usageEnd">Selesai</Label>
                  <Select name="endTime" value={usageEndTime} onValueChange={setUsageEndTime}>
                    <SelectTrigger id="usageEnd" className="w-full min-w-0">
                      <SelectValue placeholder="Pilih jam selesai" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {usageTimeOptions.map((time) => (
                        <SelectItem key={`usage-end-${time}`} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid min-w-0 gap-2">
                  <Label htmlFor="studentCount">Jumlah Mhs</Label>
                  <Input id="studentCount" name="studentCount" type="number" min={1} required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="usageNote">Catatan (opsional)</Label>
                <Textarea id="usageNote" name="note" maxLength={500} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="usageAttendanceText">Daftar Hadir (opsional, 1 baris per mahasiswa)</Label>
                <Textarea
                  id="usageAttendanceText"
                  name="attendanceText"
                  value={usageAttendanceText}
                  onChange={(e) => setUsageAttendanceText(e.target.value)}
                  maxLength={20000}
                  rows={6}
                  placeholder={"Contoh:\nP27834021001 - Andi Pratama\nP27834021002 - Siti Aminah\natau cukup nama tanpa NIM"}
                />
                <p className="text-xs text-muted-foreground">
                  Jika diisi, jumlah baris harus sama dengan jumlah mahasiswa.
                </p>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Tips cepat: pilih <span className="font-medium text-foreground">Link Jadwal</span> untuk auto-fill data sesi, lalu lengkapi absensi jika tersedia.
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setCreateUsageOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={createUsagePending}>
                  {createUsagePending ? "Menyimpan..." : "Simpan Riwayat"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "booking" | "schedule" | "history")}
        className="flex flex-col gap-4"
      >
        <TabsList className="grid h-12 w-full grid-cols-3 items-stretch gap-1 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-1 sm:w-auto">
          <TabsTrigger
            value="booking"
            className="h-full w-full rounded-xl border border-transparent bg-transparent py-0 text-sm font-medium leading-none text-muted-foreground transition-all data-[state=active]:border-primary/25 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Approval Booking
          </TabsTrigger>
          <TabsTrigger
            value="schedule"
            className="h-full w-full rounded-xl border border-transparent bg-transparent py-0 text-sm font-medium leading-none text-muted-foreground transition-all data-[state=active]:border-primary/25 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Jadwal Lab
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="h-full w-full rounded-xl border border-transparent bg-transparent py-0 text-sm font-medium leading-none text-muted-foreground transition-all data-[state=active]:border-primary/25 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
          >
            Riwayat Penggunaan
          </TabsTrigger>
        </TabsList>

        <TabsContent value="booking" className="mt-0">
          <Card className="border-border/50 bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-card-foreground">
                Pengajuan Booking Ruang Mahasiswa
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <div className="px-6 pb-2 text-xs text-muted-foreground">
                Slot pending dianggap blok sementara agar tidak terjadi double booking sebelum Petugas PLP mengambil keputusan.
              </div>
              {bookingRequests.length === 0 ? (
                <div className="px-6 pb-6">
                  <Empty className="border border-border/50 bg-muted/20 py-8">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <CheckCircle2 className="size-5" />
                      </EmptyMedia>
                      <EmptyTitle className="text-base">Tidak ada booking yang menunggu approval</EmptyTitle>
                      <EmptyDescription>
                        Semua pengajuan ruang mahasiswa sudah selesai diproses.
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <Table className="min-w-[1180px]">
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold">Kode</TableHead>
                        <TableHead className="font-semibold">Pemohon</TableHead>
                        <TableHead className="font-semibold">Lab</TableHead>
                        <TableHead className="font-semibold">Tanggal</TableHead>
                        <TableHead className="font-semibold">Waktu</TableHead>
                        <TableHead className="font-semibold">Akademik</TableHead>
                        <TableHead className="font-semibold">Pembimbing</TableHead>
                        <TableHead className="text-right font-semibold">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bookingRequests.map((request) => (
                        <TableRow key={request.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs text-muted-foreground">{request.code}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">{request.requesterName}</span>
                              <span className="text-xs text-muted-foreground">{request.requesterNim ?? "-"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{request.labName}</TableCell>
                          <TableCell className="text-muted-foreground">{request.plannedDate}</TableCell>
                          <TableCell className="text-muted-foreground">{request.plannedTime}</TableCell>
                          <TableCell>
                            <div className="flex flex-col text-sm">
                              <span className="text-foreground">{request.courseName}</span>
                              <span className="text-xs text-muted-foreground">
                                {request.studyProgram} / {request.semesterClassLabel} / {request.groupName}
                              </span>
                              <span className="text-xs text-muted-foreground">{request.materialTopic}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{request.advisorLecturerName}</TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button type="button" size="sm" variant="outline" onClick={() => setRejectTarget(request)}>
                                <XCircle className="size-4" />
                                Tolak
                              </Button>
                              <Button type="button" size="sm" onClick={() => setApproveTarget(request)}>
                                <CheckCircle2 className="size-4" />
                                Setujui
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedule" className="mt-0">
          <div className="mb-4 rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            Fokus tab ini: perencanaan dan pengelolaan jadwal lab (create/edit/hapus jadwal).
          </div>
          {schedules.length === 0 ? (
            <Card className="border-border/50 bg-card shadow-sm">
              <CardContent className="p-4">
                <Empty className="border border-border/50 bg-muted/20 py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <CalendarDays className="size-5" />
                    </EmptyMedia>
                    <EmptyTitle className="text-base">Belum ada jadwal laboratorium</EmptyTitle>
                    <EmptyDescription>
                      Buat jadwal pertama untuk membantu perencanaan sesi praktikum dan mempermudah auto-fill usage log.
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <Button type="button" size="sm" onClick={() => setCreateScheduleOpen(true)}>
                      <Plus className="size-4" />
                      Tambah Jadwal
                    </Button>
                  </EmptyContent>
                </Empty>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {schedules.map((schedule) => {
                const isFull = schedule.enrolledCount >= schedule.capacity
                const remaining = Math.max(0, schedule.capacity - schedule.enrolledCount)
                return (
                  <Card key={schedule.id} className="border-border/50 bg-card shadow-sm">
                    <CardContent className="flex flex-col gap-3 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-card-foreground">{schedule.courseName}</p>
                          <p className="text-xs text-muted-foreground">
                            {schedule.labName} - Kelompok {schedule.groupName}
                          </p>
                        </div>
                        <Badge
                          className={
                            isFull
                              ? "rounded-full border-destructive/20 bg-destructive/10 text-destructive"
                              : "rounded-full border-success/20 bg-success/10 text-success-foreground"
                          }
                        >
                          {isFull ? "Penuh" : "Tersedia"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                        <div className="rounded-lg border border-border/50 bg-muted/25 px-2 py-1.5">
                          <p className="mb-0.5 text-[11px] uppercase tracking-wide">Tanggal</p>
                          <p className="text-foreground">{schedule.scheduledDate}</p>
                        </div>
                        <div className="rounded-lg border border-border/50 bg-muted/25 px-2 py-1.5">
                          <p className="mb-0.5 text-[11px] uppercase tracking-wide">Waktu</p>
                          <p className="text-foreground">
                            {schedule.startTime} - {schedule.endTime}
                          </p>
                        </div>
                        <div className="rounded-lg border border-border/50 bg-muted/25 px-2 py-1.5">
                          <p className="mb-0.5 text-[11px] uppercase tracking-wide">Kapasitas</p>
                          <p className="text-foreground">{schedule.capacity}</p>
                        </div>
                        <div className="rounded-lg border border-border/50 bg-muted/25 px-2 py-1.5">
                          <p className="mb-0.5 text-[11px] uppercase tracking-wide">Sisa Slot</p>
                          <p className={isFull ? "text-destructive" : "text-success-foreground"}>{remaining}</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <GraduationCap className="size-3.5" />
                          <span>Dosen: {schedule.instructorName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="size-3.5" />
                          <span>
                            Terdaftar {schedule.enrolledCount}/{schedule.capacity}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-border/50 pt-3">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarDays className="size-3.5" />
                          <Clock className="size-3.5" />
                          <span>Kelola jadwal</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditingSchedule(schedule)}>
                            <Pencil className="size-4" />
                            Edit
                          </Button>
                          <Button type="button" variant="destructive" size="sm" onClick={() => setDeletingSchedule(schedule)}>
                            <Trash2 className="size-4" />
                            Hapus
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <Card className="border-border/50 bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle className="text-base font-semibold text-card-foreground">Riwayat Penggunaan Lab</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Halaman {historyPagination.page}/{historyPagination.totalPages} • {historyPagination.totalItems} riwayat
                </p>
              </div>
            </CardHeader>
            <CardContent className="px-0">
              <div className="px-6 pb-2 text-xs text-muted-foreground">
                Geser tabel ke samping pada layar kecil untuk melihat semua kolom riwayat.
              </div>
              <div className="w-full overflow-x-auto">
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">ID Riwayat</TableHead>
                      <TableHead className="font-semibold">Laboratorium</TableHead>
                      <TableHead className="font-semibold">Tanggal</TableHead>
                      <TableHead className="font-semibold">Mata Kuliah</TableHead>
                      <TableHead className="font-semibold">Kelompok</TableHead>
                      <TableHead className="font-semibold">Jumlah Mhs</TableHead>
                      <TableHead className="font-semibold">Durasi</TableHead>
                      <TableHead className="text-right font-semibold">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="py-6">
                          <Empty className="border border-border/50 bg-muted/20 py-8">
                            <EmptyHeader>
                              <EmptyMedia variant="icon">
                                <Clock className="size-5" />
                              </EmptyMedia>
                              <EmptyTitle className="text-base">Belum ada riwayat penggunaan</EmptyTitle>
                              <EmptyDescription>
                                Catat penggunaan lab setelah sesi selesai agar histori dan absensi tersimpan.
                              </EmptyDescription>
                            </EmptyHeader>
                            <EmptyContent>
                              <Button type="button" size="sm" onClick={() => setCreateUsageOpen(true)}>
                                <Plus className="size-4" />
                                Catat Penggunaan Lab
                              </Button>
                            </EmptyContent>
                          </Empty>
                        </TableCell>
                      </TableRow>
                    )}
                    {history.map((usage) => (
                      <TableRow key={usage.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-xs text-muted-foreground">{usage.displayId}</TableCell>
                        <TableCell className="font-medium text-foreground">{usage.labName}</TableCell>
                        <TableCell className="text-muted-foreground">{usage.date}</TableCell>
                        <TableCell className="text-muted-foreground">{usage.courseName}</TableCell>
                        <TableCell className="text-muted-foreground">{usage.groupName}</TableCell>
                        <TableCell className="text-muted-foreground">{usage.studentCount}</TableCell>
                        <TableCell className="text-muted-foreground">{usage.durationLabel}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" className="size-8" onClick={() => setSelectedHistory(usage)}>
                              <Eye className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              onClick={() =>
                                window.open(`/lab-usage-proof/${usage.id}`, "_blank", "noopener,noreferrer")
                              }
                              title="Cetak lembar"
                              aria-label="Cetak lembar"
                            >
                              <Printer className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 border-t border-border/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Menampilkan {(historyPagination.page - 1) * historyPagination.pageSize + (history.length > 0 ? 1 : 0)}-
                  {(historyPagination.page - 1) * historyPagination.pageSize + history.length} dari{" "}
                  {historyPagination.totalItems} riwayat penggunaan.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={historyPagination.page <= 1 || historyPagingPending}
                    onClick={() => goToHistoryPage(historyPagination.page - 1)}
                  >
                    Sebelumnya
                  </Button>
                  <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
                    {historyPagination.page}/{historyPagination.totalPages}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={historyPagination.page >= historyPagination.totalPages || historyPagingPending}
                    onClick={() => goToHistoryPage(historyPagination.page + 1)}
                  >
                    {historyPagingPending ? "Memuat..." : "Berikutnya"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingSchedule} onOpenChange={(open) => !open && setEditingSchedule(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Jadwal Lab</DialogTitle>
            <DialogDescription>Perbarui detail jadwal laboratorium.</DialogDescription>
          </DialogHeader>
          {editingSchedule && (
            <form action={updateScheduleAction} className="grid gap-3">
              {updateScheduleState && (
                <div className={`rounded-xl border px-3 py-2 text-sm ${updateScheduleState.ok ? "border-success/20 bg-success/5 text-success-foreground" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
                  {updateScheduleState.message}
                </div>
              )}
              <input type="hidden" name="scheduleId" value={editingSchedule.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Laboratorium</Label>
                  <Select name="labId" defaultValue={editingSchedule.labId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih lab" />
                    </SelectTrigger>
                    <SelectContent>
                      {labs.map((lab) => (
                        <SelectItem key={lab.id} value={lab.id}>
                          {lab.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Tanggal</Label>
                  <Input name="date" type="date" defaultValue={editingSchedule.scheduledDate} required />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Mata Kuliah</Label>
                  <Input name="courseName" defaultValue={editingSchedule.courseName} required />
                </div>
                <div className="grid gap-2">
                  <Label>Kelompok</Label>
                  <Input name="groupName" defaultValue={editingSchedule.groupName} required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Dosen Pengampu</Label>
                <Input name="instructorName" defaultValue={editingSchedule.instructorName} required />
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="grid gap-2">
                  <Label>Mulai</Label>
                  <Select name="startTime" defaultValue={editingSchedule.startTime}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih jam mulai" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {scheduleTimeOptions.map((time) => (
                        <SelectItem key={`edit-start-${time}`} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Selesai</Label>
                  <Select name="endTime" defaultValue={editingSchedule.endTime}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih jam selesai" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {scheduleTimeOptions.map((time) => (
                        <SelectItem key={`edit-end-${time}`} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Kapasitas</Label>
                  <Input name="capacity" type="number" min={1} defaultValue={editingSchedule.capacity} required />
                </div>
                <div className="grid gap-2">
                  <Label>Terdaftar</Label>
                  <Input name="enrolledCount" type="number" min={0} defaultValue={editingSchedule.enrolledCount} required />
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setEditingSchedule(null)}>
                  Batal
                </Button>
                <Button type="submit" disabled={updateSchedulePending}>
                  {updateSchedulePending ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingSchedule} onOpenChange={(open) => !open && setDeletingSchedule(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Hapus Jadwal Lab</DialogTitle>
            <DialogDescription>
              {deletingSchedule
                ? `Jadwal "${deletingSchedule.courseName} - ${deletingSchedule.groupName}" akan dihapus. Tindakan ini tidak dapat dibatalkan.`
                : "Konfirmasi penghapusan jadwal."}
            </DialogDescription>
          </DialogHeader>
          <form action={deleteScheduleAction} className="grid gap-3">
            {deleteScheduleState && (
              <div className={`rounded-xl border px-3 py-2 text-sm ${deleteScheduleState.ok ? "border-success/20 bg-success/5 text-success-foreground" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
                {deleteScheduleState.message}
              </div>
            )}
            <input type="hidden" name="scheduleId" value={deletingSchedule?.id ?? ""} />
            {deletingSchedule && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{deletingSchedule.courseName} - {deletingSchedule.groupName}</p>
                <p className="mt-1">
                  {deletingSchedule.labName} • {deletingSchedule.scheduledDate} • {deletingSchedule.startTime} - {deletingSchedule.endTime}
                </p>
                <p className="mt-2 text-xs">Tindakan ini bersifat permanen dan tidak dapat dibatalkan.</p>
              </div>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDeletingSchedule(null)}>
                Batal
              </Button>
              <Button type="submit" variant="destructive" disabled={deleteSchedulePending || !deletingSchedule}>
                {deleteSchedulePending ? "Menghapus..." : "Ya, Hapus"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!approveTarget} onOpenChange={(open) => !open && setApproveTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Setujui Booking Ruang</DialogTitle>
            <DialogDescription>
              Approval akan otomatis membuat jadwal final pada slot yang diajukan mahasiswa.
            </DialogDescription>
          </DialogHeader>
          {approveTarget && (
            <form action={approveBookingAction} className="grid gap-3">
              {approveBookingState && (
                <div
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    approveBookingState.ok
                      ? "border-success/20 bg-success/5 text-success-foreground"
                      : "border-destructive/20 bg-destructive/5 text-destructive"
                  }`}
                >
                  {approveBookingState.message}
                </div>
              )}
              <input type="hidden" name="requestId" value={approveTarget.id} />
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4 text-sm">
                <p className="font-medium text-foreground">{approveTarget.code}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 text-muted-foreground">
                  <p>
                    Mahasiswa: <span className="text-foreground">{approveTarget.requesterName}</span>
                  </p>
                  <p>
                    Lab: <span className="text-foreground">{approveTarget.labName}</span>
                  </p>
                  <p>
                    Tanggal: <span className="text-foreground">{approveTarget.plannedDate}</span>
                  </p>
                  <p>
                    Waktu: <span className="text-foreground">{approveTarget.plannedTime}</span>
                  </p>
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="approveNote">Catatan Approval (opsional)</Label>
                <Textarea
                  id="approveNote"
                  name="note"
                  rows={3}
                  placeholder="Contoh: disetujui sesuai jadwal lab tersedia"
                />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setApproveTarget(null)}>
                  Batal
                </Button>
                <Button type="submit" disabled={approveBookingPending}>
                  {approveBookingPending ? "Menyetujui..." : "Setujui Booking"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tolak Booking Ruang</DialogTitle>
            <DialogDescription>
              Penolakan akan terlihat oleh mahasiswa pada daftar booking mereka.
            </DialogDescription>
          </DialogHeader>
          {rejectTarget && (
            <form action={rejectBookingAction} className="grid gap-3">
              {rejectBookingState && (
                <div
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    rejectBookingState.ok
                      ? "border-success/20 bg-success/5 text-success-foreground"
                      : "border-destructive/20 bg-destructive/5 text-destructive"
                  }`}
                >
                  {rejectBookingState.message}
                </div>
              )}
              <input type="hidden" name="requestId" value={rejectTarget.id} />
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-muted-foreground">
                <p className="font-medium text-foreground">{rejectTarget.code}</p>
                <p className="mt-1">
                  {rejectTarget.requesterName} - {rejectTarget.labName}
                </p>
                <p className="mt-1">
                  {rejectTarget.plannedDate} • {rejectTarget.plannedTime}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rejectNote">Alasan Penolakan</Label>
                <Textarea
                  id="rejectNote"
                  name="note"
                  rows={3}
                  placeholder="Contoh: slot bentrok dengan kegiatan prioritas lab"
                  required
                />
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
                  Batal
                </Button>
                <Button type="submit" variant="destructive" disabled={rejectBookingPending}>
                  {rejectBookingPending ? "Menolak..." : "Tolak Booking"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedHistory} onOpenChange={(open) => !open && setSelectedHistory(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Riwayat Penggunaan Lab</DialogTitle>
            <DialogDescription>
              {selectedHistory ? `${selectedHistory.courseName} - ${selectedHistory.groupName}` : "Detail riwayat"}
            </DialogDescription>
          </DialogHeader>
          {selectedHistory && (
            <div className="grid gap-4">
              <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Ringkasan Sesi</p>
                  <span className="rounded-full border border-border/50 bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
                    Riwayat Penggunaan
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div><p className="text-muted-foreground">Laboratorium</p><p>{selectedHistory.labName}</p></div>
                <div><p className="text-muted-foreground">Tanggal</p><p>{selectedHistory.date}</p></div>
                <div><p className="text-muted-foreground">Jam</p><p>{selectedHistory.startTime} - {selectedHistory.endTime}</p></div>
                <div><p className="text-muted-foreground">Durasi</p><p>{selectedHistory.durationLabel}</p></div>
                <div><p className="text-muted-foreground">Kelompok</p><p>{selectedHistory.groupName}</p></div>
                <div><p className="text-muted-foreground">Jumlah Mhs</p><p>{selectedHistory.studentCount}</p></div>
              </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    window.open(`/lab-usage-proof/${selectedHistory.id}`, "_blank", "noopener,noreferrer")
                  }
                >
                  <Printer className="size-4" />
                  Cetak Lembar
                </Button>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Daftar Hadir</p>
                <div className="max-h-72 overflow-auto rounded-lg border border-border/50 bg-muted/30">
                  {selectedHistory.attendance.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-muted-foreground">Belum ada daftar hadir tercatat.</div>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {selectedHistory.attendance.map((a, idx) => (
                        <div key={`${a.attendeeNim ?? a.attendeeName}-${idx}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                          <span className="text-foreground">{a.attendeeName}</span>
                          <span className="font-mono text-xs text-muted-foreground">{a.attendeeNim ?? "-"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="outline" onClick={() => setSelectedHistory(null)}>Tutup</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
