"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { AlertTriangle, CheckCircle2, Eye, Pencil, Plus, Printer, QrCode, Search, Trash2, Wrench } from "lucide-react"
import QRCode from "qrcode"

import {
  createToolMasterAction,
  deactivateToolAssetAction,
  updateToolAssetAction,
  type ToolMasterActionResult,
} from "@/app/dashboard/tools/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { useToast } from "@/hooks/use-toast"

export type ToolRow = {
  assetId: string
  modelId: string
  assetCode: string
  inventoryCode: string | null
  qrCodeValue: string
  status: "available" | "borrowed" | "maintenance" | "damaged" | "inactive"
  condition: "baik" | "maintenance" | "damaged"
  assetNotes: string | null
  isActive: boolean
  modelCode: string
  name: string
  brand: string | null
  category: string
  locationDetail: string | null
  imageUrl: string | null
  description: string | null
  labId: string
  lab: string
}

export type ToolCreateLabOption = { id: string; name: string }
export type ToolAssetEventRow = {
  id: string
  toolAssetId: string
  eventType: "created" | "condition_update" | "maintenance_update" | "status_update" | "return_update" | "note_update"
  conditionBefore: "baik" | "maintenance" | "damaged" | null
  conditionAfter: "baik" | "maintenance" | "damaged" | null
  statusBefore: "available" | "borrowed" | "maintenance" | "damaged" | "inactive" | null
  statusAfter: "available" | "borrowed" | "maintenance" | "damaged" | "inactive" | null
  note: string | null
  actorName: string
  createdAtIso: string
}

const statusConfig: Record<ToolRow["status"], { label: string; className: string }> = {
  available: { label: "Tersedia", className: "bg-success/10 text-success-foreground border-success/20" },
  borrowed: { label: "Dipinjam", className: "bg-primary/10 text-primary border-primary/20" },
  maintenance: { label: "Maintenance", className: "bg-warning/10 text-warning-foreground border-warning/20" },
  damaged: { label: "Rusak", className: "bg-destructive/10 text-destructive border-destructive/20" },
  inactive: { label: "Nonaktif", className: "bg-muted text-muted-foreground border-border" },
}

function dt(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso))
}

function eventLabel(t: ToolAssetEventRow["eventType"]) {
  const map: Record<ToolAssetEventRow["eventType"], string> = {
    created: "Pembuatan Unit",
    condition_update: "Perubahan Kondisi",
    maintenance_update: "Update Maintenance",
    status_update: "Perubahan Status",
    return_update: "Pengembalian",
    note_update: "Perubahan Catatan",
  }
  return map[t]
}

async function buildQrDataUrl(value: string) {
  return QRCode.toDataURL(value, {
    width: 256,
    margin: 1,
    errorCorrectionLevel: "M",
  })
}

async function printQr(tool: ToolRow, qrDataUrl?: string | null) {
  const dataUrl = qrDataUrl ?? (await buildQrDataUrl(tool.qrCodeValue))
  const w = window.open("", "_blank", "width=600,height=700")
  if (!w) return
  w.document.write(`<html><body style="font-family:Arial;padding:24px">
    <h3 style="margin:0 0 8px">Label QR Alat</h3>
    <p style="margin:0"><b>${tool.assetCode}</b> - ${tool.name}</p>
    <p style="margin:4px 0 12px;color:#555">${tool.lab}</p>
    <div style="border:1px solid #bbb;border-radius:10px;padding:12px;display:flex;justify-content:center;margin:12px 0">
      <img src="${dataUrl}" alt="QR ${tool.assetCode}" style="width:220px;height:220px" />
    </div>
    <p style="font-family:monospace;font-size:11px;word-break:break-all">${tool.qrCodeValue}</p>
    <p style="font-size:12px;color:#666">Scanner QR belum diaktifkan. QR digunakan untuk cetak identifikasi unit.</p>
    <script>window.onload=()=>window.print()</script>
  </body></html>`)
  w.document.close()
}

export function ToolsPageClient({
  role,
  data,
  masterLabs,
  events,
  filterLabs,
  filterCategories,
  kpi,
  pagination,
  initialFilters,
}: {
  role: "admin" | "petugas_plp"
  data: ToolRow[]
  masterLabs: ToolCreateLabOption[]
  events: ToolAssetEventRow[]
  filterLabs: string[]
  filterCategories: string[]
  kpi: { totalUnits: number; available: number; borrowed: number; issue: number }
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number }
  initialFilters: { q: string; lab: string; category: string }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPendingNavigation, startNavigation] = useTransition()

  const [search, setSearch] = useState(initialFilters.q)
  const [labFilter, setLabFilter] = useState(initialFilters.lab)
  const [categoryFilter, setCategoryFilter] = useState(initialFilters.category)
  const [showAdd, setShowAdd] = useState(false)
  const [showQr, setShowQr] = useState<ToolRow | null>(null)
  const [qrPreviewDataUrl, setQrPreviewDataUrl] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState<ToolRow | null>(null)
  const [editing, setEditing] = useState<ToolRow | null>(null)
  const [deactivating, setDeactivating] = useState<ToolRow | null>(null)
  const [createLabId, setCreateLabId] = useState(masterLabs[0]?.id ?? "")
  const [createCond, setCreateCond] = useState<ToolRow["condition"]>("baik")
  const [editLabId, setEditLabId] = useState("")
  const [editStatus, setEditStatus] = useState<ToolRow["status"]>("available")
  const [editCond, setEditCond] = useState<ToolRow["condition"]>("baik")

  const [createState, createAction, createPending] = useActionState(createToolMasterAction, null as ToolMasterActionResult | null)
  const [updateState, updateAction, updatePending] = useActionState(updateToolAssetAction, null as ToolMasterActionResult | null)
  const [deactivateState, deactivateAction, deactivatePending] = useActionState(
    deactivateToolAssetAction,
    null as ToolMasterActionResult | null,
  )

  const { toast } = useToast()
  const toastKeys = useRef<string[]>([])
  const canManage = role === "admin" || role === "petugas_plp"

  const eventMap = useMemo(() => {
    const map = new Map<string, ToolAssetEventRow[]>()
    for (const e of events) {
      const arr = map.get(e.toolAssetId) ?? []
      arr.push(e)
      map.set(e.toolAssetId, arr)
    }
    return map
  }, [events])

  useEffect(() => {
    queueMicrotask(() => {
      setSearch(initialFilters.q)
      setLabFilter(initialFilters.lab)
      setCategoryFilter(initialFilters.category)
    })
  }, [initialFilters.q, initialFilters.lab, initialFilters.category])

  const applyFiltersToUrl = (next?: Partial<{ q: string; lab: string; category: string; page: number }>) => {
    const params = new URLSearchParams(searchParams.toString())
    const q = (next?.q ?? search).trim()
    const lab = next?.lab ?? labFilter
    const category = next?.category ?? categoryFilter
    const page = next?.page ?? 1

    if (q) params.set("q", q)
    else params.delete("q")
    if (lab && lab !== "all") params.set("lab", lab)
    else params.delete("lab")
    if (category && category !== "all") params.set("category", category)
    else params.delete("category")
    if (page > 1) params.set("page", String(page))
    else params.delete("page")

    const target = params.toString() ? `${pathname}?${params.toString()}` : pathname
    startNavigation(() => {
      router.replace(target, { scroll: false })
    })
  }

  useEffect(() => {
    const states = [
      createState ? ["c", createState] : null,
      updateState ? ["u", updateState] : null,
      deactivateState ? ["d", deactivateState] : null,
    ].filter(Boolean) as Array<[string, ToolMasterActionResult]>
    for (const [k, s] of states) {
      const key = `${k}:${s.ok}:${s.message}`
      if (toastKeys.current.includes(key)) continue
      toastKeys.current.push(key)
      toast({ title: "Master Alat", description: s.message, variant: s.ok ? "default" : "destructive" })
    }
  }, [createState, updateState, deactivateState, toast])

  useEffect(() => {
    if (createState?.ok) queueMicrotask(() => setShowAdd(false))
  }, [createState])
  useEffect(() => {
    if (updateState?.ok) queueMicrotask(() => setEditing(null))
  }, [updateState])
  useEffect(() => {
    if (deactivateState?.ok) queueMicrotask(() => {
      setDeactivating(null)
      setEditing(null)
    })
  }, [deactivateState])
  useEffect(() => {
    let alive = true
    if (!showQr) return
    void buildQrDataUrl(showQr.qrCodeValue)
      .then((url) => {
        if (alive) setQrPreviewDataUrl(url)
      })
      .catch(() => {
        if (alive) setQrPreviewDataUrl(null)
      })
    return () => {
      alive = false
    }
  }, [showQr])
  useEffect(() => {
    let alive = true
    if (!showDetail) return
    void buildQrDataUrl(showDetail.qrCodeValue)
      .then((url) => {
        if (alive) setQrPreviewDataUrl(url)
      })
      .catch(() => {
        if (alive) setQrPreviewDataUrl(null)
      })
    return () => {
      alive = false
    }
  }, [showDetail])
  const detailEvents = showDetail ? eventMap.get(showDetail.assetId) ?? [] : []

  return (
    <div className="min-w-0 overflow-x-hidden flex flex-col gap-6 p-4 lg:p-6">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Master Data Alat</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kelola master alat dan unit fisik, status/kondisi, serta QR code identifikasi per unit.
            </p>
          </div>
          {canManage && (
            <div className="rounded-xl border border-border/50 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
              Gunakan <span className="font-medium text-foreground">Tambah Alat</span> untuk membuat model alat sekaligus unit.
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="border-border/50 bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <Wrench className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Unit</p>
              <p className="text-base font-semibold text-foreground">{kpi.totalUnits}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-success/10">
              <CheckCircle2 className="size-4 text-success-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Tersedia</p>
              <p className="text-base font-semibold text-foreground">{kpi.available}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10">
              <QrCode className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dipinjam</p>
              <p className="text-base font-semibold text-foreground">{kpi.borrowed}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-warning/10">
              <AlertTriangle className="size-4 text-warning-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Perlu Perhatian</p>
              <p className="text-base font-semibold text-foreground">{kpi.issue}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 bg-card shadow-sm">
        <CardContent className="p-4">
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault()
              applyFiltersToUrl({ page: 1 })
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Cari nama alat / kode unit / kode model"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={labFilter} onValueChange={setLabFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Lab" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Lab</SelectItem>
                {filterLabs.map((lab) => <SelectItem key={lab} value={lab}>{lab}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {filterCategories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button type="submit" variant="outline" disabled={isPendingNavigation}>
              {isPendingNavigation ? "Memuat..." : "Terapkan"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isPendingNavigation}
              onClick={() => {
                setSearch("")
                setLabFilter("all")
                setCategoryFilter("all")
                applyFiltersToUrl({ q: "", lab: "all", category: "all", page: 1 })
              }}
            >
              Reset
            </Button>
            {canManage && <Dialog open={showAdd} onOpenChange={setShowAdd}>
              <DialogTrigger asChild>
                <Button><Plus className="size-4" />Tambah Alat</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Tambah Master Alat + Unit</DialogTitle>
                  <DialogDescription>Lokasi disimpan per model, QR value otomatis per unit.</DialogDescription>
                </DialogHeader>
                <form action={createAction} className="grid gap-3">
                  {createState && <p className={`rounded-xl border px-3 py-2 text-sm ${createState.ok ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"}`}>{createState.message}</p>}
                  <div className="grid gap-4 rounded-xl border border-border/50 bg-muted/10 p-4">
                    <p className="text-sm font-medium text-foreground">Data Model Alat</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Laboratorium</Label>
                      <Select name="labId" value={createLabId} onValueChange={setCreateLabId}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Pilih lab" /></SelectTrigger>
                        <SelectContent>{masterLabs.map((lab) => <SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2"><Label>Kode Model</Label><Input name="modelCode" required /></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2"><Label>Nama Alat</Label><Input name="name" required /></div>
                    <div className="grid gap-2"><Label>Merk</Label><Input name="brand" /></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2"><Label>Kategori</Label><Input name="category" required /></div>
                    <div className="grid gap-2"><Label>Lokasi Detail (per model)</Label><Input name="locationDetail" /></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2"><Label>Foto (URL)</Label><Input name="imageUrl" /></div>
                    <div className="grid gap-2"><Label>Prefix Kode Inventaris</Label><Input name="inventoryCodePrefix" /></div>
                  </div>
                  <div className="grid gap-2"><Label>Deskripsi</Label><Textarea name="description" maxLength={2000} /></div>
                  </div>

                  <div className="grid gap-4 rounded-xl border border-border/50 bg-muted/10 p-4">
                    <p className="text-sm font-medium text-foreground">Pembuatan Unit Awal</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="grid gap-2"><Label>Jumlah Unit</Label><Input name="unitCount" type="number" min={1} max={200} defaultValue={1} required /></div>
                      <div className="grid gap-2">
                        <Label>Kondisi Awal</Label>
                        <Select name="initialCondition" value={createCond} onValueChange={(v) => setCreateCond(v as ToolRow["condition"])}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="baik">Baik</SelectItem>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="damaged">Rusak</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Sistem akan membuat QR value otomatis untuk tiap unit yang dibuat.
                    </p>
                  </div>

                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Batal</Button>
                    <Button type="submit" disabled={createPending}>{createPending ? "Menyimpan..." : "Simpan"}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>}
          </form>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Daftar Unit Alat ({pagination.totalItems})</CardTitle>
            <div className="text-xs text-muted-foreground">
              Halaman {pagination.page} dari {pagination.totalPages} • {pagination.totalItems} data
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <div className="px-6 pb-2 text-xs text-muted-foreground">
            Geser tabel ke samping pada layar kecil untuk melihat seluruh kolom dan tombol aksi.
          </div>
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Kode Unit</TableHead><TableHead>Nama</TableHead><TableHead>Merk</TableHead><TableHead>Kategori</TableHead>
                  <TableHead>Lab</TableHead><TableHead>Lokasi</TableHead><TableHead>Status</TableHead><TableHead>Kondisi</TableHead><TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="py-6">
                      <Empty className="border border-border/50 bg-muted/20 py-8">
                        <EmptyHeader>
                          <EmptyMedia variant="icon">
                            <Wrench className="size-5" />
                          </EmptyMedia>
                          <EmptyTitle className="text-base">Unit alat tidak ditemukan</EmptyTitle>
                          <EmptyDescription>
                            Ubah filter pencarian, atau tambahkan alat baru jika inventaris belum terdaftar.
                          </EmptyDescription>
                        </EmptyHeader>
                        {canManage && (
                          <EmptyContent>
                            <Button size="sm" onClick={() => setShowAdd(true)}>
                              <Plus className="size-4" />
                              Tambah Alat
                            </Button>
                          </EmptyContent>
                        )}
                      </Empty>
                    </TableCell>
                  </TableRow>
                )}
                {data.map((tool) => (
                  <TableRow key={tool.assetId}>
                    <TableCell className="font-mono text-xs">{tool.assetCode}</TableCell>
                    <TableCell><div className="flex flex-col"><span>{tool.name}</span><span className="text-xs text-muted-foreground">{tool.modelCode}</span></div></TableCell>
                    <TableCell>{tool.brand || "-"}</TableCell>
                    <TableCell>{tool.category}</TableCell>
                    <TableCell>{tool.lab}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{tool.locationDetail || "-"}</TableCell>
                    <TableCell><Badge variant="outline" className={statusConfig[tool.status].className}>{statusConfig[tool.status].label}</Badge></TableCell>
                    <TableCell className="capitalize">{tool.condition}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => setShowDetail(tool)} aria-label="Detail alat">
                          <Eye className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => setShowQr(tool)}><QrCode className="size-4" /></Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => {
                            setEditLabId(tool.labId)
                            setEditStatus(tool.status)
                            setEditCond(tool.condition)
                            setEditing(tool)
                          }}
                        >
                          <Pencil className="size-4" />
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
              Menampilkan {(pagination.page - 1) * pagination.pageSize + (data.length > 0 ? 1 : 0)}-
              {(pagination.page - 1) * pagination.pageSize + data.length} dari {pagination.totalItems} unit.
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1 || isPendingNavigation}
                onClick={() => applyFiltersToUrl({ page: pagination.page - 1 })}
              >
                Sebelumnya
              </Button>
              <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
                {pagination.page}/{pagination.totalPages}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages || isPendingNavigation}
                onClick={() => applyFiltersToUrl({ page: pagination.page + 1 })}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!showQr} onOpenChange={(o) => {
        if (!o) {
          setShowQr(null)
          if (!showDetail) setQrPreviewDataUrl(null)
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto border-border/60 bg-card/95 shadow-xl">
          <DialogHeader>
            <DialogTitle>QR Code Alat</DialogTitle>
            <DialogDescription>Fokus QR cetak untuk identifikasi unit (scanner belum diaktifkan).</DialogDescription>
          </DialogHeader>
          {showQr && <div className="grid gap-3">
            <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card to-muted/20 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{showQr.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{showQr.assetCode} • {showQr.lab}</p>
                </div>
                <Badge variant="outline" className="rounded-full border-border/60 bg-background/80 text-xs">
                  Unit
                </Badge>
              </div>
              <div className="mt-3 flex h-44 items-center justify-center rounded-lg border border-border/50 bg-background/80">
                {qrPreviewDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrPreviewDataUrl} alt={`QR ${showQr.assetCode}`} className="h-36 w-36 rounded-md" />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <QrCode className="mx-auto mb-2 size-12" />
                    <p className="text-xs">Memuat QR...</p>
                  </div>
                )}
              </div>
              <div className="mt-3 rounded-lg border border-border/50 bg-background/80 px-3 py-2">
                <p className="text-[11px] font-medium text-muted-foreground">QR Value</p>
                <p className="mt-1 break-all font-mono text-[11px] text-foreground/90">{showQr.qrCodeValue}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-background/60 px-3 py-2">
              <p className="text-xs text-muted-foreground">Cetak label QR untuk ditempel pada unit alat.</p>
              <div className="flex gap-2">
              <Button variant="outline" onClick={() => {
                setShowQr(null)
                setQrPreviewDataUrl(null)
              }}>Tutup</Button>
              <Button onClick={() => void printQr(showQr, qrPreviewDataUrl)}><Printer className="size-4" />Cetak QR</Button>
              </div>
            </div>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!showDetail} onOpenChange={(o) => {
        if (!o) {
          setShowDetail(null)
          if (!showQr) setQrPreviewDataUrl(null)
        }
      }}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Alat & Unit</DialogTitle>
            <DialogDescription>
              Informasi unit alat, data model, dan histori kondisi/maintenance.
            </DialogDescription>
          </DialogHeader>
          {showDetail && (
            <div className="grid gap-5">
              <div className="grid gap-4">
                <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-foreground">Ringkasan Unit</p>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={statusConfig[showDetail.status].className}>
                        {statusConfig[showDetail.status].label}
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-border/50 bg-background text-foreground capitalize">
                        {showDetail.condition}
                      </Badge>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-muted-foreground">Nama Alat</p>
                        <p className="font-medium text-foreground">{showDetail.name}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Laboratorium</p>
                        <p className="text-foreground">{showDetail.lab}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Kode Unit</p>
                        <p className="font-mono text-foreground">{showDetail.assetCode}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Kode Model</p>
                        <p className="font-mono text-foreground">{showDetail.modelCode}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Kode Inventaris</p>
                        <p className="font-mono text-foreground">{showDetail.inventoryCode ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Kategori / Merk</p>
                        <p className="text-foreground">
                          {showDetail.category}
                          {showDetail.brand ? ` - ${showDetail.brand}` : ""}
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground">Lokasi Detail</p>
                        <p className="text-foreground">{showDetail.locationDetail ?? "-"}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground">QR Value</p>
                        <p className="break-all font-mono text-xs text-foreground">{showDetail.qrCodeValue}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground">Catatan Unit</p>
                        <p className="text-foreground">{showDetail.assetNotes ?? "-"}</p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-muted-foreground">Deskripsi Model</p>
                        <p className="text-foreground">{showDetail.description ?? "-"}</p>
                      </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background px-3 py-2">
                    <p className="text-xs text-muted-foreground">Gunakan tombol ini untuk mencetak label QR identifikasi unit.</p>
                    <Button size="sm" variant="outline" onClick={() => void printQr(showDetail, qrPreviewDataUrl)}>
                      <Printer className="size-4" />
                      Cetak QR
                    </Button>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Histori Kondisi & Maintenance</p>
                  <p className="text-xs text-muted-foreground">Menampilkan 20 event terbaru</p>
                </div>
                <div className="grid gap-2">
                  {detailEvents.length === 0 && (
                    <div className="rounded-lg border border-border/50 bg-background px-3 py-3 text-sm text-muted-foreground">
                      Belum ada histori untuk unit ini.
                    </div>
                  )}
                  {detailEvents.slice(0, 20).map((e) => (
                    <div key={e.id} className="rounded-lg border border-border/50 bg-background px-3 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">{eventLabel(e.eventType)}</p>
                        <p className="text-xs text-muted-foreground">{dt(e.createdAtIso)}</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Oleh: {e.actorName}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Kondisi: {e.conditionBefore ?? "-"} {"->"} {e.conditionAfter ?? "-"} | Status: {e.statusBefore ?? "-"} {"->"} {e.statusAfter ?? "-"}
                      </p>
                      {e.note && <p className="mt-2 text-sm text-foreground">{e.note}</p>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="outline" onClick={() => setShowDetail(null)}>Tutup</Button>
                {canManage && (
                  <Button
                    onClick={() => {
                      setEditLabId(showDetail.labId)
                      setEditStatus(showDetail.status)
                      setEditCond(showDetail.condition)
                      setShowDetail(null)
                      setEditing(showDetail)
                    }}
                  >
                    <Pencil className="size-4" />
                    Edit Unit
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Unit Alat</DialogTitle>
            <DialogDescription>Perbarui data model dan unit. Histori kondisi/maintenance tersedia di dialog Detail.</DialogDescription>
          </DialogHeader>
          {editing && <div className="grid gap-5">
            <div className="rounded-xl border border-border/50 bg-gradient-to-br from-card to-muted/20 p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{editing.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {editing.lab} • {editing.category}
                    {editing.brand ? ` • ${editing.brand}` : ""}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Unit: <span className="font-mono text-foreground">{editing.assetCode}</span> • Model:{" "}
                    <span className="font-mono text-foreground">{editing.modelCode}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={statusConfig[editStatus].className}>
                    {statusConfig[editStatus].label}
                  </Badge>
                  <Badge variant="outline" className="rounded-full border-border/50 bg-background text-foreground capitalize">
                    {editCond}
                  </Badge>
                </div>
              </div>
              <div className="mt-3 rounded-lg border border-border/50 bg-background/80 px-3 py-2 text-xs text-muted-foreground">
                Gunakan dialog <span className="font-medium text-foreground">Detail</span> untuk melihat histori kondisi & maintenance unit.
              </div>
            </div>

            <form action={updateAction} className="grid gap-4">
              {updateState && (
                <p
                  className={`rounded-xl border px-3 py-2 text-sm ${
                    updateState.ok ? "border-success/20 bg-success/5 text-success-foreground" : "border-destructive/20 bg-destructive/5 text-destructive"
                  }`}
                >
                  {updateState.message}
                </p>
              )}
              <input type="hidden" name="assetId" value={editing.assetId} />
              <input type="hidden" name="modelId" value={editing.modelId} />

              <div className="grid gap-4 rounded-xl border border-border/50 bg-muted/10 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Data Model</p>
                  <p className="text-xs text-muted-foreground">Informasi yang dipakai bersama oleh unit dalam model ini</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Laboratorium</Label>
                    <Select name="labId" value={editLabId} onValueChange={setEditLabId}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{masterLabs.map((lab) => <SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2"><Label>Kode Model</Label><Input name="modelCode" defaultValue={editing.modelCode} required /></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2"><Label>Nama</Label><Input name="name" defaultValue={editing.name} required /></div>
                  <div className="grid gap-2"><Label>Merk</Label><Input name="brand" defaultValue={editing.brand ?? ""} /></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2"><Label>Kategori</Label><Input name="category" defaultValue={editing.category} required /></div>
                  <div className="grid gap-2"><Label>Lokasi Detail</Label><Input name="locationDetail" defaultValue={editing.locationDetail ?? ""} /></div>
                </div>
                <div className="grid gap-2"><Label>Foto (URL)</Label><Input name="imageUrl" defaultValue={editing.imageUrl ?? ""} /></div>
                <div className="grid gap-2"><Label>Deskripsi</Label><Textarea name="description" defaultValue={editing.description ?? ""} /></div>
              </div>

              <div className="grid gap-4 rounded-xl border border-border/50 bg-muted/10 p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">Data Unit</p>
                  <p className="text-xs text-muted-foreground">Perubahan status/kondisi akan tercatat sebagai event histori</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2"><Label>Kode Unit</Label><Input value={editing.assetCode} disabled /></div>
                  <div className="grid gap-2"><Label>Kode Inventaris</Label><Input name="inventoryCode" defaultValue={editing.inventoryCode ?? ""} /></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Status</Label>
                    <Select name="status" value={editStatus} onValueChange={(v) => setEditStatus(v as ToolRow["status"])}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>{["available","borrowed","maintenance","damaged","inactive"].map((s) => <SelectItem key={s} value={s}>{statusConfig[s as ToolRow["status"]].label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Kondisi</Label>
                    <Select name="condition" value={editCond} onValueChange={(v) => setEditCond(v as ToolRow["condition"])}>
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baik">Baik</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="damaged">Rusak</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2"><Label>Catatan Unit</Label><Textarea name="assetNotes" defaultValue={editing.assetNotes ?? ""} /></div>
                <div className="grid gap-2">
                  <Label>Catatan Histori Event</Label>
                  <Textarea
                    name="eventNote"
                    placeholder="Opsional. Contoh: unit dipindahkan ke lemari B2 / kondisi retak ringan saat pemeriksaan."
                    maxLength={500}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-background p-3 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Button type="button" variant="ghost" className="justify-start text-destructive hover:text-destructive" onClick={() => setDeactivating(editing)}>
                    <Trash2 className="size-4" />
                    Nonaktifkan Unit
                  </Button>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Button type="button" variant="outline" onClick={() => setEditing(null)}>Tutup</Button>
                    <Button type="submit" disabled={updatePending}>{updatePending ? "Menyimpan..." : "Simpan Perubahan"}</Button>
                  </div>
                </div>
              </div>
            </form>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deactivating} onOpenChange={(o) => !o && setDeactivating(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto border-border/60 bg-card/95 shadow-xl">
          <DialogHeader><DialogTitle>Nonaktifkan Unit Alat</DialogTitle><DialogDescription>Unit akan disembunyikan dari listing aktif.</DialogDescription></DialogHeader>
          <form action={deactivateAction} className="grid gap-3">
            {deactivateState && <p className={`rounded border px-3 py-2 text-sm ${deactivateState.ok ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"}`}>{deactivateState.message}</p>}
            <input type="hidden" name="assetId" value={deactivating?.assetId ?? ""} />
            <div className="rounded-lg border border-border/50 bg-muted/10 px-3 py-2 text-sm text-muted-foreground">
              Proteksi aktif: unit tidak bisa dinonaktifkan jika sedang dipinjam atau sudah pernah direferensikan transaksi.
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDeactivating(null)}>Batal</Button>
              <Button type="submit" variant="destructive" disabled={deactivatePending || !deactivating}>{deactivatePending ? "Memproses..." : "Nonaktifkan"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
