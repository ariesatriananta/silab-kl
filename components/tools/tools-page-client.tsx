"use client"

import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import { Pencil, Plus, Printer, QrCode, Search, Trash2 } from "lucide-react"
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
}: {
  role: "admin" | "petugas_plp"
  data: ToolRow[]
  masterLabs: ToolCreateLabOption[]
  events: ToolAssetEventRow[]
}) {
  const [search, setSearch] = useState("")
  const [labFilter, setLabFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [showAdd, setShowAdd] = useState(false)
  const [showQr, setShowQr] = useState<ToolRow | null>(null)
  const [qrPreviewDataUrl, setQrPreviewDataUrl] = useState<string | null>(null)
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

  const labs = Array.from(new Set(data.map((d) => d.lab)))
  const categories = Array.from(new Set(data.map((d) => d.category)))

  const eventMap = useMemo(() => {
    const map = new Map<string, ToolAssetEventRow[]>()
    for (const e of events) {
      const arr = map.get(e.toolAssetId) ?? []
      arr.push(e)
      map.set(e.toolAssetId, arr)
    }
    return map
  }, [events])

  const filtered = data.filter((t) => {
    const q = search.toLowerCase()
    return (
      (labFilter === "all" || t.lab === labFilter) &&
      (categoryFilter === "all" || t.category === categoryFilter) &&
      (t.name.toLowerCase().includes(q) ||
        t.assetCode.toLowerCase().includes(q) ||
        t.modelCode.toLowerCase().includes(q) ||
        (t.inventoryCode ?? "").toLowerCase().includes(q))
    )
  })

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
  const editingEvents = editing ? eventMap.get(editing.assetId) ?? [] : []

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <Card className="border-border/50 bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
                {labs.map((lab) => <SelectItem key={lab} value={lab}>{lab}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Kategori" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
            {canManage && <Dialog open={showAdd} onOpenChange={setShowAdd}>
              <DialogTrigger asChild>
                <Button><Plus className="size-4" />Tambah Alat</Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Tambah Master Alat + Unit</DialogTitle>
                  <DialogDescription>Lokasi disimpan per model, QR value otomatis per unit.</DialogDescription>
                </DialogHeader>
                <form action={createAction} className="grid gap-3">
                  {createState && <p className={`rounded border px-3 py-2 text-sm ${createState.ok ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"}`}>{createState.message}</p>}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Laboratorium</Label>
                      <Select name="labId" value={createLabId} onValueChange={setCreateLabId}>
                        <SelectTrigger><SelectValue placeholder="Pilih lab" /></SelectTrigger>
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
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-2 sm:col-span-2"><Label>Foto (URL)</Label><Input name="imageUrl" /></div>
                    <div className="grid gap-2"><Label>Jumlah Unit</Label><Input name="unitCount" type="number" min={1} max={200} defaultValue={1} required /></div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-2"><Label>Prefix Kode Inventaris</Label><Input name="inventoryCodePrefix" /></div>
                    <div className="grid gap-2">
                      <Label>Kondisi Awal</Label>
                      <Select name="initialCondition" value={createCond} onValueChange={(v) => setCreateCond(v as ToolRow["condition"])}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="baik">Baik</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="damaged">Rusak</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-2"><Label>Deskripsi</Label><Textarea name="description" maxLength={2000} /></div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Batal</Button>
                    <Button type="submit" disabled={createPending}>{createPending ? "Menyimpan..." : "Simpan"}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base">Daftar Unit Alat ({filtered.length})</CardTitle></CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Kode Unit</TableHead><TableHead>Nama</TableHead><TableHead>Merk</TableHead><TableHead>Kategori</TableHead>
                  <TableHead>Lab</TableHead><TableHead>Lokasi</TableHead><TableHead>Status</TableHead><TableHead>Kondisi</TableHead><TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Tidak ada data.</TableCell></TableRow>}
                {filtered.map((tool) => (
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
        </CardContent>
      </Card>

      <Dialog open={!!showQr} onOpenChange={(o) => {
        if (!o) {
          setShowQr(null)
          setQrPreviewDataUrl(null)
        }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>QR Code Alat</DialogTitle><DialogDescription>Fokus QR cetak (scanner belum diaktifkan).</DialogDescription></DialogHeader>
          {showQr && <div className="grid gap-3">
            <div className="rounded-lg border p-3">
              <p className="font-medium">{showQr.name}</p>
              <p className="text-xs text-muted-foreground">{showQr.assetCode} - {showQr.lab}</p>
              <div className="mt-3 flex h-40 items-center justify-center rounded-md border-2 border-dashed">
                {qrPreviewDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrPreviewDataUrl} alt={`QR ${showQr.assetCode}`} className="h-32 w-32" />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <QrCode className="mx-auto mb-2 size-12" />
                    <p className="text-xs">Memuat QR...</p>
                  </div>
                )}
              </div>
              <p className="mt-2 max-w-[220px] break-all font-mono text-[11px] text-muted-foreground">{showQr.qrCodeValue}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setShowQr(null)
                setQrPreviewDataUrl(null)
              }}>Tutup</Button>
              <Button onClick={() => void printQr(showQr, qrPreviewDataUrl)}><Printer className="size-4" />Cetak QR</Button>
            </div>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Unit Alat</DialogTitle>
            <DialogDescription>Termasuk update master (model) + histori kondisi/maintenance per unit.</DialogDescription>
          </DialogHeader>
          {editing && <div className="grid gap-5">
            <form action={updateAction} className="grid gap-4">
              {updateState && <p className={`rounded border px-3 py-2 text-sm ${updateState.ok ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"}`}>{updateState.message}</p>}
              <input type="hidden" name="assetId" value={editing.assetId} />
              <input type="hidden" name="modelId" value={editing.modelId} />
              <div className="grid gap-4 rounded-lg border p-4">
                <p className="text-sm font-medium">Data Model</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Laboratorium</Label>
                    <Select name="labId" value={editLabId} onValueChange={setEditLabId}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
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
              <div className="grid gap-4 rounded-lg border p-4">
                <p className="text-sm font-medium">Data Unit</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2"><Label>Kode Unit</Label><Input value={editing.assetCode} disabled /></div>
                  <div className="grid gap-2"><Label>Kode Inventaris</Label><Input name="inventoryCode" defaultValue={editing.inventoryCode ?? ""} /></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Status</Label>
                    <Select name="status" value={editStatus} onValueChange={(v) => setEditStatus(v as ToolRow["status"])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{["available","borrowed","maintenance","damaged","inactive"].map((s) => <SelectItem key={s} value={s}>{statusConfig[s as ToolRow["status"]].label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Kondisi</Label>
                    <Select name="condition" value={editCond} onValueChange={(v) => setEditCond(v as ToolRow["condition"])}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="baik">Baik</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="damaged">Rusak</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2"><Label>Catatan Unit</Label><Textarea name="assetNotes" defaultValue={editing.assetNotes ?? ""} /></div>
                <div className="grid gap-2"><Label>Catatan Histori Event</Label><Textarea name="eventNote" placeholder="Opsional" maxLength={500} /></div>
              </div>
              <div className="flex justify-between gap-2">
                <Button type="button" variant="ghost" className="text-destructive" onClick={() => setDeactivating(editing)}>
                  <Trash2 className="size-4" />Nonaktifkan Unit
                </Button>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditing(null)}>Tutup</Button>
                  <Button type="submit" disabled={updatePending}>{updatePending ? "Menyimpan..." : "Simpan"}</Button>
                </div>
              </div>
            </form>
            <div className="grid gap-2 rounded-lg border p-4">
              <p className="text-sm font-medium">Histori Kondisi & Maintenance</p>
              {editingEvents.length === 0 && <p className="text-sm text-muted-foreground">Belum ada histori.</p>}
              {editingEvents.slice(0, 20).map((e) => (
                <div key={e.id} className="rounded border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">{eventLabel(e.eventType)}</p>
                    <p className="text-xs text-muted-foreground">{dt(e.createdAtIso)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">Oleh: {e.actorName}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Kondisi: {e.conditionBefore ?? "-"} {"->"} {e.conditionAfter ?? "-"} | Status: {e.statusBefore ?? "-"} {"->"} {e.statusAfter ?? "-"}
                  </p>
                  {e.note && <p className="mt-1 text-sm">{e.note}</p>}
                </div>
              ))}
            </div>
          </div>}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deactivating} onOpenChange={(o) => !o && setDeactivating(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nonaktifkan Unit Alat</DialogTitle><DialogDescription>Unit akan disembunyikan dari listing aktif.</DialogDescription></DialogHeader>
          <form action={deactivateAction} className="grid gap-3">
            {deactivateState && <p className={`rounded border px-3 py-2 text-sm ${deactivateState.ok ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"}`}>{deactivateState.message}</p>}
            <input type="hidden" name="assetId" value={deactivating?.assetId ?? ""} />
            <div className="text-sm text-muted-foreground">Proteksi: tidak bisa nonaktif jika sedang dipinjam atau sudah pernah direferensikan transaksi.</div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDeactivating(null)}>Batal</Button>
              <Button type="submit" variant="destructive" disabled={deactivatePending || !deactivating}>{deactivatePending ? "Memproses..." : "Nonaktifkan"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
