"use client"

import Link from "next/link"
import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, Clock, Eye, Package, Plus, Printer, XCircle } from "lucide-react"

import {
  approveBorrowingAction,
  approveBorrowingWithFeedbackAction,
  createBorrowingRequestAction,
  handoverBorrowingAction,
  rejectBorrowingAction,
  rejectBorrowingWithFeedbackAction,
  returnBorrowingToolAction,
  type BorrowingMutationResult,
  type CreateBorrowingActionResult,
} from "@/app/dashboard/borrowing/actions"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"

type DisplayStatus =
  | "pending"
  | "approved_waiting_handover"
  | "active"
  | "overdue"
  | "partially_returned"
  | "completed"
  | "rejected"
  | "cancelled"

const statusConfig: Record<DisplayStatus, { label: string; className: string }> = {
  pending: { label: "Menunggu", className: "bg-warning/10 text-warning-foreground border-warning/20" },
  approved_waiting_handover: {
    label: "Menunggu Serah Terima",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  active: { label: "Aktif", className: "bg-primary/10 text-primary border-primary/20" },
  overdue: { label: "Terlambat", className: "bg-destructive/10 text-destructive border-destructive/20" },
  partially_returned: {
    label: "Kembali Sebagian",
    className: "bg-primary/10 text-primary border-primary/20",
  },
  completed: {
    label: "Dikembalikan",
    className: "bg-success/10 text-success-foreground border-success/20",
  },
  rejected: { label: "Ditolak", className: "bg-destructive/10 text-destructive border-destructive/20" },
  cancelled: { label: "Dibatalkan", className: "bg-muted text-muted-foreground border-border" },
}

const approvalDecisionLabel: Record<"approved" | "rejected", string> = {
  approved: "Disetujui",
  rejected: "Ditolak",
}

const roleLabel: Record<"admin" | "mahasiswa" | "petugas_plp", string> = {
  admin: "Admin",
  mahasiswa: "Mahasiswa",
  petugas_plp: "Petugas PLP",
}

const returnConditionLabel: Record<"baik" | "maintenance" | "damaged", string> = {
  baik: "Baik",
  maintenance: "Perlu Maintenance",
  damaged: "Rusak",
}

export type BorrowingListRow = {
  id: string
  code: string
  labId: string
  requesterUserId: string
  createdByUserId: string
  borrower: string
  nim: string | null
  borrowDate: string | null
  dueDate: string | null
  status: DisplayStatus
  purpose: string
  courseName: string
  materialTopic: string
  semesterLabel: string
  groupName: string
  advisorLecturerName: string | null
  itemCount: number
}

export type BorrowingDetail = {
  id: string
  code: string
  borrower: string
  nim: string | null
  status: DisplayStatus
  purpose: string
  courseName: string
  materialTopic: string
  semesterLabel: string
  groupName: string
  advisorLecturerName: string | null
  requestedAt: string
  borrowDate: string | null
  dueDate: string | null
  labName: string
  approvalsCount: number
  items: Array<{
    id: string
    itemType: "tool_asset" | "consumable"
    name: string
    qty: number
    toolAssetId?: string | null
    assetCode?: string | null
    unit?: string | null
    returned?: boolean
  }>
  approvalHistory: Array<{
    approverName: string
    approverRole: "admin" | "mahasiswa" | "petugas_plp"
    decision: "approved" | "rejected"
    decidedAt: string
    note: string | null
  }>
  handoverHistory: Array<{
    handedOverAt: string
    dueDate: string
    handedOverByName: string
    note: string | null
  }>
  returnEvents: Array<{
    returnedAt: string
    receivedByName: string
    note: string | null
    items: Array<{
      transactionItemId: string
      toolName: string
      assetCode: string
      returnCondition: "baik" | "maintenance" | "damaged"
      note: string | null
    }>
  }>
}

export type BorrowingCreateLabOption = { id: string; name: string }
export type BorrowingCreateRequesterOption = { id: string; label: string }
export type BorrowingCreateToolOption = { id: string; label: string; labId: string; modelId: string; modelCode: string }
export type BorrowingCreateConsumableOption = {
  id: string
  label: string
  labId: string
  stockQty: number
  unit: string
}

export function BorrowingPageClient({
  role,
  currentUserId,
  accessibleLabIds,
  rows,
  details,
  createOptions,
  prefill,
}: {
  role: "admin" | "mahasiswa" | "petugas_plp"
  currentUserId: string
  accessibleLabIds: string[] | null
  rows: BorrowingListRow[]
  details: Record<string, BorrowingDetail>
  createOptions: {
    labs: BorrowingCreateLabOption[]
    requesters: BorrowingCreateRequesterOption[]
    tools: BorrowingCreateToolOption[]
    consumables: BorrowingCreateConsumableOption[]
  }
  prefill?: {
    openCreate?: boolean
    labId?: string
    toolModelCode?: string
  }
}) {
  const [statusFilter, setStatusFilter] = useState("all")
  const [scopeFilter, setScopeFilter] = useState<"all" | "mine" | "my_labs">(
    role === "petugas_plp" ? "my_labs" : role === "mahasiswa" ? "mine" : "all",
  )
  const [selectedBorrowingId, setSelectedBorrowingId] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedLabId, setSelectedLabId] = useState(createOptions.labs[0]?.id ?? "")
  const [selectedRequesterId, setSelectedRequesterId] = useState(
    role === "mahasiswa" ? currentUserId : createOptions.requesters[0]?.id ?? "",
  )
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([])
  const [consumableQtyMap, setConsumableQtyMap] = useState<Record<string, number>>({})
  const [courseName, setCourseName] = useState("")
  const [materialTopic, setMaterialTopic] = useState("")
  const [semesterLabel, setSemesterLabel] = useState("")
  const [groupName, setGroupName] = useState("")
  const [advisorLecturerName, setAdvisorLecturerName] = useState("")
  const [approvalNote, setApprovalNote] = useState("")
  const [rejectNote, setRejectNote] = useState("")
  const [handoverNote, setHandoverNote] = useState("")
  const [returnNote, setReturnNote] = useState("")

  const [createState, createAction, createPending] = useActionState(
    createBorrowingRequestAction,
    null as CreateBorrowingActionResult | null,
  )
  const [approveState, approveAction, approvePending] = useActionState(
    approveBorrowingWithFeedbackAction,
    null as BorrowingMutationResult | null,
  )
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectBorrowingWithFeedbackAction,
    null as BorrowingMutationResult | null,
  )
  const [handoverState, handoverAction, handoverPending] = useActionState(
    handoverBorrowingAction,
    null as BorrowingMutationResult | null,
  )
  const [returnState, returnAction, returnPending] = useActionState(
    returnBorrowingToolAction,
    null as BorrowingMutationResult | null,
  )
  const { toast } = useToast()
  const feedbackRef = useRef<string[]>([])

  const canApprove = role === "admin" || role === "petugas_plp"
  const canHandover = role === "admin" || role === "petugas_plp"

  const filtered = rows.filter((b) => {
    const statusMatch = statusFilter === "all" || b.status === statusFilter
    if (!statusMatch) return false

    if (scopeFilter === "mine") {
      return b.requesterUserId === currentUserId || b.createdByUserId === currentUserId
    }
    if (scopeFilter === "my_labs") {
      return !!accessibleLabIds?.includes(b.labId)
    }
    return true
  })

  const summary = {
    pending: rows.filter((b) => b.status === "pending" || b.status === "approved_waiting_handover").length,
    active: rows.filter((b) => b.status === "active" || b.status === "partially_returned").length,
    overdue: rows.filter((b) => b.status === "overdue").length,
    completed: rows.filter((b) => b.status === "completed").length,
  }

  const selectedBorrowing = selectedBorrowingId ? details[selectedBorrowingId] : null

  const availableToolsForLab = useMemo(
    () => createOptions.tools.filter((item) => item.labId === selectedLabId),
    [createOptions.tools, selectedLabId],
  )
  const availableConsumablesForLab = useMemo(
    () => createOptions.consumables.filter((item) => item.labId === selectedLabId),
    [createOptions.consumables, selectedLabId],
  )
  const itemsPayload = useMemo(
    () =>
      JSON.stringify({
        toolAssetIds: selectedToolIds,
        consumables: Object.entries(consumableQtyMap)
          .filter(([, qty]) => qty > 0)
          .map(([consumableItemId, qty]) => ({ consumableItemId, qty })),
      }),
    [consumableQtyMap, selectedToolIds],
  )
  const returnableToolItems = (selectedBorrowing?.items ?? []).filter(
    (item) => item.itemType === "tool_asset" && !item.returned,
  )

  const handleLabChange = (labId: string) => {
    setSelectedLabId(labId)
    setSelectedToolIds([])
    setConsumableQtyMap({})
  }

  const toggleToolSelection = (toolId: string, checked: boolean) => {
    setSelectedToolIds((prev) => {
      if (checked) return Array.from(new Set([...prev, toolId]))
      return prev.filter((id) => id !== toolId)
    })
  }

  const setConsumableQty = (consumableId: string, qty: number) => {
    setConsumableQtyMap((prev) => ({
      ...prev,
      [consumableId]: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0,
    }))
  }

  useEffect(() => {
    const feedbacks = [
      createState ? { key: `create:${createState.ok}:${createState.message}`, title: "Pengajuan", ...createState } : null,
      approveState ? { key: `approve:${approveState.ok}:${approveState.message}`, title: "Approval", ...approveState } : null,
      rejectState ? { key: `reject:${rejectState.ok}:${rejectState.message}`, title: "Penolakan", ...rejectState } : null,
      handoverState ? { key: `handover:${handoverState.ok}:${handoverState.message}`, title: "Serah Terima", ...handoverState } : null,
      returnState ? { key: `return:${returnState.ok}:${returnState.message}`, title: "Pengembalian", ...returnState } : null,
    ].filter(Boolean) as Array<{ key: string; title: string; ok: boolean; message: string }>

    for (const item of feedbacks) {
      if (feedbackRef.current.includes(item.key)) continue
      feedbackRef.current.push(item.key)
      toast({
        title: item.title,
        description: item.message,
        variant: item.ok ? "default" : "destructive",
      })
    }
  }, [approveState, createState, handoverState, rejectState, returnState, toast])

  useEffect(() => {
    if (!createState?.ok) return
    queueMicrotask(() => {
      setCreateOpen(false)
      setSelectedToolIds([])
      setConsumableQtyMap({})
      setCourseName("")
      setMaterialTopic("")
      setSemesterLabel("")
      setGroupName("")
      setAdvisorLecturerName("")
    })
  }, [createState])

  useEffect(() => {
    if (!prefill?.openCreate) return
    queueMicrotask(() => {
      setCreateOpen(true)
      if (prefill.labId && createOptions.labs.some((l) => l.id === prefill.labId)) {
        setSelectedLabId(prefill.labId)
      }
      if (prefill.toolModelCode) {
        const firstTool = createOptions.tools.find(
          (t) =>
            t.modelCode === prefill.toolModelCode &&
            (!prefill.labId || t.labId === prefill.labId),
        )
        if (firstTool) {
          if (!prefill.labId) setSelectedLabId(firstTool.labId)
          setSelectedToolIds([firstTool.id])
        }
      }
    })
  }, [createOptions.labs, createOptions.tools, prefill])

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="border-border/50 bg-card shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-warning/10">
                <Clock className="size-4 text-warning-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-lg font-bold text-card-foreground">{summary.pending}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Package className="size-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Aktif</p>
                <p className="text-lg font-bold text-card-foreground">{summary.active}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-destructive/10">
                <XCircle className="size-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Terlambat</p>
                <p className="text-lg font-bold text-card-foreground">{summary.overdue}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle2 className="size-4 text-success-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dikembalikan</p>
                <p className="text-lg font-bold text-card-foreground">{summary.completed}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0">
              <Plus className="size-4" />
              Buat Pengajuan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Buat Pengajuan Peminjaman</DialogTitle>
              <DialogDescription>
                Mendukung multi-item alat dan bahan habis pakai dalam satu pengajuan.
              </DialogDescription>
            </DialogHeader>
            <form action={createAction} className="grid gap-4">
              {createState && (
                <div
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    createState.ok
                      ? "border-success/20 bg-success/5 text-success-foreground"
                      : "border-destructive/20 bg-destructive/5 text-destructive"
                  }`}
                >
                  {createState.message}
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="labId">Laboratorium</Label>
                <Select name="labId" value={selectedLabId} onValueChange={handleLabChange}>
                  <SelectTrigger id="labId">
                    <SelectValue placeholder="Pilih lab" />
                  </SelectTrigger>
                  <SelectContent>
                    {createOptions.labs.map((lab) => (
                      <SelectItem key={lab.id} value={lab.id}>
                        {lab.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="requesterUserId">Peminjam (Mahasiswa)</Label>
                {role === "mahasiswa" ? (
                  <>
                    <input type="hidden" name="requesterUserId" value={selectedRequesterId} />
                    <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">Akun Anda</div>
                  </>
                ) : (
                  <Select name="requesterUserId" value={selectedRequesterId} onValueChange={setSelectedRequesterId}>
                    <SelectTrigger id="requesterUserId">
                      <SelectValue placeholder="Pilih mahasiswa" />
                    </SelectTrigger>
                    <SelectContent>
                      {createOptions.requesters.map((requester) => (
                        <SelectItem key={requester.id} value={requester.id}>
                          {requester.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="purpose">Keperluan</Label>
                <Input id="purpose" name="purpose" placeholder="Contoh: Praktikum Hematologi" required />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="courseName">Mata Kuliah</Label>
                  <Input
                    id="courseName"
                    name="courseName"
                    value={courseName}
                    onChange={(e) => setCourseName(e.target.value)}
                    placeholder="Contoh: Kimia Lingkungan"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="materialTopic">Materi</Label>
                  <Input
                    id="materialTopic"
                    name="materialTopic"
                    value={materialTopic}
                    onChange={(e) => setMaterialTopic(e.target.value)}
                    placeholder="Contoh: Titrasi Asam Basa"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="semesterLabel">Semester</Label>
                  <Input
                    id="semesterLabel"
                    name="semesterLabel"
                    value={semesterLabel}
                    onChange={(e) => setSemesterLabel(e.target.value)}
                    placeholder="Contoh: 4"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="groupName">Kelompok</Label>
                  <Input
                    id="groupName"
                    name="groupName"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="A / B / C"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="advisorLecturerName">Dosen (opsional)</Label>
                  <Input
                    id="advisorLecturerName"
                    name="advisorLecturerName"
                    value={advisorLecturerName}
                    onChange={(e) => setAdvisorLecturerName(e.target.value)}
                    placeholder="Nama dosen"
                  />
                </div>
              </div>

              <Separator />

              <div className="grid gap-2">
                <Label>Alat (bisa pilih lebih dari satu)</Label>
                <div className="max-h-44 space-y-2 overflow-auto rounded-md border border-border p-3">
                  {availableToolsForLab.length === 0 && (
                    <p className="text-sm text-muted-foreground">Tidak ada alat tersedia untuk lab ini.</p>
                  )}
                  {availableToolsForLab.map((tool) => {
                    const checked = selectedToolIds.includes(tool.id)
                    return (
                      <label key={tool.id} className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleToolSelection(tool.id, e.target.checked)}
                          className="mt-0.5"
                        />
                        <span>{tool.label}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Bahan Habis Pakai (isi qty &gt; 0 untuk menambahkan)</Label>
                <div className="max-h-52 space-y-2 overflow-auto rounded-md border border-border p-3">
                  {availableConsumablesForLab.length === 0 && (
                    <p className="text-sm text-muted-foreground">Tidak ada bahan untuk lab ini.</p>
                  )}
                  {availableConsumablesForLab.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1fr_90px] items-center gap-3">
                      <div className="text-sm">
                        <p className="text-foreground">{item.label}</p>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        value={consumableQtyMap[item.id] ?? 0}
                        onChange={(e) => setConsumableQty(item.id, Number(e.target.value))}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <input type="hidden" name="itemsPayload" value={itemsPayload} />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={createPending}>
                  Batal
                </Button>
                <Button type="submit" disabled={createPending}>
                  {createPending ? "Menyimpan..." : "Kirim Pengajuan"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-56 bg-card">
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="pending">Menunggu</SelectItem>
            <SelectItem value="approved_waiting_handover">Menunggu Serah Terima</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="partially_returned">Kembali Sebagian</SelectItem>
            <SelectItem value="overdue">Terlambat</SelectItem>
            <SelectItem value="completed">Dikembalikan</SelectItem>
            <SelectItem value="rejected">Ditolak</SelectItem>
            <SelectItem value="cancelled">Dibatalkan</SelectItem>
          </SelectContent>
        </Select>
        {(role === "admin" || role === "petugas_plp") && (
          <Select value={scopeFilter} onValueChange={(v) => setScopeFilter(v as "all" | "mine" | "my_labs")}>
            <SelectTrigger className="w-56 bg-card">
              <SelectValue placeholder="Filter Ruang Lingkup" />
            </SelectTrigger>
            <SelectContent>
              {role === "admin" && <SelectItem value="all">Semua Transaksi</SelectItem>}
              <SelectItem value="mine">Milik Saya</SelectItem>
              <SelectItem value="my_labs" disabled={!accessibleLabIds || accessibleLabIds.length === 0}>
                Lab Saya
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      <Card className="border-border/50 bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-card-foreground">Daftar Peminjaman ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">ID</TableHead>
                  <TableHead className="font-semibold">Peminjam</TableHead>
                  <TableHead className="font-semibold">NIM</TableHead>
                  <TableHead className="font-semibold">Tgl Pinjam</TableHead>
                  <TableHead className="font-semibold">Tgl Kembali</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Keperluan</TableHead>
                  <TableHead className="text-right font-semibold">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      Belum ada transaksi peminjaman.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((borrow) => {
                  const status = statusConfig[borrow.status]
                  const showApprovalActions = canApprove && borrow.status === "pending"
                  return (
                    <TableRow key={borrow.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs text-muted-foreground">{borrow.code}</TableCell>
                      <TableCell className="font-medium text-foreground">{borrow.borrower}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{borrow.nim ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{borrow.borrowDate ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground">{borrow.dueDate ?? "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-muted-foreground">{borrow.purpose}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="size-8" onClick={() => setSelectedBorrowingId(borrow.id)} aria-label="Lihat detail">
                            <Eye className="size-4" />
                          </Button>
                          {showApprovalActions && (
                            <>
                              <form action={approveBorrowingAction}>
                                <input type="hidden" name="transactionId" value={borrow.id} />
                                <Button type="submit" variant="ghost" size="icon" className="size-8 text-success-foreground hover:text-success-foreground" aria-label="Setujui">
                                  <CheckCircle2 className="size-4" />
                                </Button>
                              </form>
                              <form action={rejectBorrowingAction}>
                                <input type="hidden" name="transactionId" value={borrow.id} />
                                <Button type="submit" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label="Tolak">
                                  <XCircle className="size-4" />
                                </Button>
                              </form>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedBorrowing} onOpenChange={() => setSelectedBorrowingId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detail Peminjaman {selectedBorrowing?.code}</DialogTitle>
            <DialogDescription>Informasi transaksi peminjaman dari database.</DialogDescription>
          </DialogHeader>
          {selectedBorrowing && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-end">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/borrowing-proof/${selectedBorrowing.id}`} target="_blank" rel="noreferrer">
                    <Printer className="size-4" />
                    Cetak Bukti
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Peminjam</p>
                  <p className="font-medium text-foreground">{selectedBorrowing.borrower}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">NIM</p>
                  <p className="font-mono text-foreground">{selectedBorrowing.nim ?? "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Laboratorium</p>
                  <p className="text-foreground">{selectedBorrowing.labName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="outline" className={statusConfig[selectedBorrowing.status].className}>
                    {statusConfig[selectedBorrowing.status].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Tanggal Pengajuan</p>
                  <p className="text-foreground">{selectedBorrowing.requestedAt}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tanggal Pinjam / Due Date</p>
                  <p className="text-foreground">{selectedBorrowing.borrowDate ?? "-"} / {selectedBorrowing.dueDate ?? "-"}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">Keperluan</p>
                  <p className="text-foreground">{selectedBorrowing.purpose}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Mata Kuliah</p>
                  <p className="text-foreground">{selectedBorrowing.courseName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Materi</p>
                  <p className="text-foreground">{selectedBorrowing.materialTopic}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Semester</p>
                  <p className="text-foreground">{selectedBorrowing.semesterLabel}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Kelompok</p>
                  <p className="text-foreground">{selectedBorrowing.groupName}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground">Dosen Pembimbing</p>
                  <p className="text-foreground">{selectedBorrowing.advisorLecturerName ?? "-"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Jumlah Approval</p>
                  <p className="text-foreground">{selectedBorrowing.approvalsCount}/2</p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Item Pengajuan</p>
                <div className="flex flex-col gap-2">
                  {selectedBorrowing.items.length === 0 && (
                    <div className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      Belum ada item pada transaksi ini.
                    </div>
                  )}
                  {selectedBorrowing.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/50 px-3 py-2">
                      <div className="flex flex-col">
                        <span className="text-sm text-foreground">{item.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {item.itemType === "tool_asset"
                            ? `Alat${item.assetCode ? ` - ${item.assetCode}` : ""}`
                            : `Bahan - ${item.unit ?? "-"}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.itemType === "tool_asset" && item.returned && (
                          <Badge variant="outline" className="border-success/20 bg-success/10 text-success-foreground">
                            Sudah Kembali
                          </Badge>
                        )}
                        <Badge variant="secondary">{item.qty}x</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Riwayat Approval</p>
                <div className="flex flex-col gap-2">
                  {selectedBorrowing.approvalHistory.length === 0 ? (
                    <div className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      Belum ada riwayat approval.
                    </div>
                  ) : (
                    selectedBorrowing.approvalHistory.map((approval, index) => (
                      <div
                        key={`${approval.decidedAt}-${approval.approverName}-${index}`}
                        className="rounded-lg border border-border/50 bg-muted/50 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm text-foreground">
                            {approval.approverName} ({roleLabel[approval.approverRole]})
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className={
                                approval.decision === "approved"
                                  ? "border-success/20 bg-success/10 text-success-foreground"
                                  : "border-destructive/20 bg-destructive/10 text-destructive"
                              }
                            >
                              {approvalDecisionLabel[approval.decision]}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{approval.decidedAt}</span>
                          </div>
                        </div>
                        {approval.note && (
                          <p className="mt-1 text-xs text-muted-foreground">Catatan: {approval.note}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Riwayat Serah Terima</p>
                <div className="flex flex-col gap-2">
                  {selectedBorrowing.handoverHistory.length === 0 ? (
                    <div className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      Belum ada riwayat serah terima.
                    </div>
                  ) : (
                    selectedBorrowing.handoverHistory.map((event, index) => (
                      <div
                        key={`${event.handedOverAt}-${event.handedOverByName}-${index}`}
                        className="rounded-lg border border-border/50 bg-muted/50 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm text-foreground">Diserahkan oleh {event.handedOverByName}</div>
                          <span className="text-xs text-muted-foreground">{event.handedOverAt}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">Due date: {event.dueDate}</p>
                        {event.note && (
                          <p className="mt-1 text-xs text-muted-foreground">Catatan: {event.note}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <Separator />

              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Riwayat Pengembalian</p>
                <div className="flex flex-col gap-2">
                  {selectedBorrowing.returnEvents.length === 0 ? (
                    <div className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                      Belum ada riwayat pengembalian.
                    </div>
                  ) : (
                    selectedBorrowing.returnEvents.map((event, index) => (
                      <div
                        key={`${event.returnedAt}-${event.receivedByName}-${index}`}
                        className="rounded-lg border border-border/50 bg-muted/50 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="text-sm text-foreground">Diterima oleh {event.receivedByName}</div>
                          <span className="text-xs text-muted-foreground">{event.returnedAt}</span>
                        </div>
                        <div className="mt-2 flex flex-col gap-1">
                          {event.items.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Tidak ada item tercatat.</p>
                          ) : (
                            event.items.map((item) => (
                              <div
                                key={item.transactionItemId}
                                className="flex flex-wrap items-center justify-between gap-2 text-xs"
                              >
                                <span className="text-foreground">
                                  {item.toolName} - {item.assetCode}
                                </span>
                                <Badge variant="outline" className="border-border/60 bg-background">
                                  {returnConditionLabel[item.returnCondition]}
                                </Badge>
                              </div>
                            ))
                          )}
                        </div>
                        {event.note && (
                          <p className="mt-2 text-xs text-muted-foreground">Catatan event: {event.note}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {canApprove && selectedBorrowing.status === "pending" && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      Approval kedua (oleh user berbeda) akan mengubah status menjadi <span className="font-medium text-foreground">Menunggu Serah Terima</span>.
                    </p>
                    {(approveState || rejectState) && (
                      <div className="grid gap-2">
                        {approveState && (
                          <div
                            className={`rounded-lg border px-3 py-2 text-sm ${
                              approveState.ok
                                ? "border-success/20 bg-success/5 text-success-foreground"
                                : "border-destructive/20 bg-destructive/5 text-destructive"
                            }`}
                          >
                            {approveState.message}
                          </div>
                        )}
                        {rejectState && (
                          <div
                            className={`rounded-lg border px-3 py-2 text-sm ${
                              rejectState.ok
                                ? "border-success/20 bg-success/5 text-success-foreground"
                                : "border-destructive/20 bg-destructive/5 text-destructive"
                            }`}
                          >
                            {rejectState.message}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <form action={approveAction} className="flex flex-col gap-2">
                        <input type="hidden" name="transactionId" value={selectedBorrowing.id} />
                        <Label htmlFor="approvalNote">Catatan Approval (opsional)</Label>
                        <Textarea
                          id="approvalNote"
                          name="note"
                          value={approvalNote}
                          onChange={(e) => setApprovalNote(e.target.value)}
                          placeholder="Contoh: disetujui untuk praktikum minggu ini"
                          maxLength={500}
                        />
                        <Button type="submit" className="w-full" disabled={approvePending}>
                          <CheckCircle2 className="size-4" />
                          {approvePending ? "Memproses..." : "Setujui"}
                        </Button>
                      </form>
                      <form action={rejectAction} className="flex flex-col gap-2">
                        <input type="hidden" name="transactionId" value={selectedBorrowing.id} />
                        <Label htmlFor="rejectNote">Alasan Penolakan (opsional)</Label>
                        <Textarea
                          id="rejectNote"
                          name="note"
                          value={rejectNote}
                          onChange={(e) => setRejectNote(e.target.value)}
                          placeholder="Contoh: alat tidak tersedia pada jadwal diminta"
                          maxLength={500}
                        />
                        <Button type="submit" variant="destructive" className="w-full" disabled={rejectPending}>
                          <XCircle className="size-4" />
                          {rejectPending ? "Memproses..." : "Tolak"}
                        </Button>
                      </form>
                    </div>
                  </div>
                </>
              )}

              {canHandover && selectedBorrowing.status === "approved_waiting_handover" && (
                <>
                  <Separator />
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-muted-foreground">
                      Serah terima akan mengaktifkan transaksi, mengisi due date, mengubah status alat menjadi dipinjam, dan mengurangi stok bahan.
                    </p>
                    {handoverState && (
                      <div className={`rounded-lg border px-3 py-2 text-sm ${handoverState.ok ? "border-success/20 bg-success/5 text-success-foreground" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
                        {handoverState.message}
                      </div>
                    )}
                    <form action={handoverAction} className="grid gap-3">
                      <input type="hidden" name="transactionId" value={selectedBorrowing.id} />
                      <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
                        <div className="grid gap-2">
                          <Label htmlFor="handoverDueDate">Due Date</Label>
                          <Input id="handoverDueDate" name="dueDate" type="date" required />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="handoverNote">Catatan Serah Terima (opsional)</Label>
                          <Textarea
                            id="handoverNote"
                            name="note"
                            value={handoverNote}
                            onChange={(e) => setHandoverNote(e.target.value)}
                            maxLength={500}
                            placeholder="Contoh: diserahkan lengkap sesuai pengajuan"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button type="submit" disabled={handoverPending}>
                          {handoverPending ? "Memproses..." : "Proses Serah Terima"}
                        </Button>
                      </div>
                    </form>
                  </div>
                </>
              )}

              {canHandover &&
                (selectedBorrowing.status === "active" ||
                  selectedBorrowing.status === "overdue" ||
                  selectedBorrowing.status === "partially_returned") && (
                  <>
                    <Separator />
                    <div className="flex flex-col gap-3">
                      <p className="text-sm text-muted-foreground">
                        Pengembalian parsial: proses satu alat per submit. Status transaksi berubah otomatis menjadi kembali sebagian atau dikembalikan.
                      </p>
                      {returnState && (
                        <div className={`rounded-lg border px-3 py-2 text-sm ${returnState.ok ? "border-success/20 bg-success/5 text-success-foreground" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
                          {returnState.message}
                        </div>
                      )}
                      {returnableToolItems.length === 0 ? (
                        <div className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                          Semua alat pada transaksi ini sudah dikembalikan.
                        </div>
                      ) : (
                        <form action={returnAction} className="grid gap-3">
                          <input type="hidden" name="transactionId" value={selectedBorrowing.id} />
                          <div className="grid gap-3 sm:grid-cols-[1.3fr_1fr]">
                            <div className="grid gap-2">
                              <Label htmlFor="returnTransactionItemId">Alat Dikembalikan</Label>
                              <Select name="transactionItemId" required>
                                <SelectTrigger id="returnTransactionItemId">
                                  <SelectValue placeholder="Pilih alat" />
                                </SelectTrigger>
                                <SelectContent>
                                  {returnableToolItems.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                      {item.name}{item.assetCode ? ` - ${item.assetCode}` : ""}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="grid gap-2">
                              <Label htmlFor="returnCondition">Kondisi Kembali</Label>
                              <Select name="returnCondition" defaultValue="baik">
                                <SelectTrigger id="returnCondition">
                                  <SelectValue placeholder="Kondisi" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="baik">Baik</SelectItem>
                                  <SelectItem value="maintenance">Perlu Maintenance</SelectItem>
                                  <SelectItem value="damaged">Rusak</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="returnNote">Catatan Pengembalian (opsional)</Label>
                            <Textarea
                              id="returnNote"
                              name="note"
                              value={returnNote}
                              onChange={(e) => setReturnNote(e.target.value)}
                              maxLength={500}
                              placeholder="Contoh: ada goresan ringan pada bodi"
                            />
                          </div>
                          <div className="flex justify-end">
                            <Button type="submit" disabled={returnPending}>
                              {returnPending ? "Memproses..." : "Terima Kembali"}
                            </Button>
                          </div>
                        </form>
                      )}
                    </div>
                  </>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
