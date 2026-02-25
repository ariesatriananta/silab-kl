"use client"

import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Eye, Package, Plus, TrendingDown, XCircle } from "lucide-react"

import {
  approveMaterialRequestWithFeedbackAction,
  createConsumableMasterAction,
  createMaterialRequestAction,
  deactivateConsumableMasterAction,
  fulfillMaterialRequestWithFeedbackAction,
  rejectMaterialRequestWithFeedbackAction,
  updateConsumableMasterAction,
  type ConsumableMasterActionResult,
  type MaterialRequestActionResult,
} from "@/app/dashboard/consumables/actions"
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
import { Progress } from "@/components/ui/progress"
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
import { useToast } from "@/hooks/use-toast"

export type ConsumableStockRow = {
  id: string
  labId: string
  code: string
  name: string
  unit: string
  stock: number
  minStock: number
  category: string
  lab: string
}

export type MaterialRequestRow = {
  id: string
  code: string
  labId: string
  requestorUserId: string
  requestor: string
  lab: string
  items: string
  date: string
  status: "pending" | "approved" | "fulfilled" | "rejected" | "cancelled"
  note: string | null
  lines: Array<{
    consumableId: string
    name: string
    unit: string
    qtyRequested: number
    qtyFulfilled: number
  }>
}

export type ConsumableCreateLabOption = { id: string; name: string }
export type ConsumableCreateItemOption = {
  id: string
  labId: string
  label: string
  stockQty: number
  unit: string
}

const requestStatusConfig: Record<MaterialRequestRow["status"], { label: string; className: string }> = {
  pending: { label: "Menunggu", className: "bg-warning/10 text-warning-foreground border-warning/20" },
  approved: { label: "Disetujui", className: "bg-primary/10 text-primary border-primary/20" },
  fulfilled: { label: "Terpenuhi", className: "bg-success/10 text-success-foreground border-success/20" },
  rejected: { label: "Ditolak", className: "bg-destructive/10 text-destructive border-destructive/20" },
  cancelled: { label: "Dibatalkan", className: "bg-muted text-muted-foreground border-border" },
}

export function ConsumablesPageClient({
  role,
  currentUserId,
  consumables,
  materialRequests,
  masterLabs,
  createOptions,
}: {
  role: "admin" | "mahasiswa" | "petugas_plp"
  currentUserId: string
  consumables: ConsumableStockRow[]
  materialRequests: MaterialRequestRow[]
  masterLabs: ConsumableCreateLabOption[]
  createOptions: {
    labs: ConsumableCreateLabOption[]
    items: ConsumableCreateItemOption[]
  }
}) {
  const [createOpen, setCreateOpen] = useState(false)
  const [createMasterOpen, setCreateMasterOpen] = useState(false)
  const [editingConsumable, setEditingConsumable] = useState<ConsumableStockRow | null>(null)
  const [deactivatingConsumable, setDeactivatingConsumable] = useState<ConsumableStockRow | null>(null)
  const [selectedLabId, setSelectedLabId] = useState(createOptions.labs[0]?.id ?? "")
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({})
  const [requestNote, setRequestNote] = useState("")
  const [selectedRequest, setSelectedRequest] = useState<MaterialRequestRow | null>(null)
  const [processingRequest, setProcessingRequest] = useState<MaterialRequestRow | null>(null)
  const [processActionType, setProcessActionType] = useState<"approve" | "reject" | "fulfill">("approve")
  const [processNote, setProcessNote] = useState("")

  const [createState, createAction, createPending] = useActionState(
    createMaterialRequestAction,
    null as MaterialRequestActionResult | null,
  )
  const [createMasterState, createMasterAction, createMasterPending] = useActionState(
    createConsumableMasterAction,
    null as ConsumableMasterActionResult | null,
  )
  const [updateMasterState, updateMasterAction, updateMasterPending] = useActionState(
    updateConsumableMasterAction,
    null as ConsumableMasterActionResult | null,
  )
  const [deactivateMasterState, deactivateMasterAction, deactivateMasterPending] = useActionState(
    deactivateConsumableMasterAction,
    null as ConsumableMasterActionResult | null,
  )
  const [approveState, approveAction, approvePending] = useActionState(
    approveMaterialRequestWithFeedbackAction,
    null as MaterialRequestActionResult | null,
  )
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectMaterialRequestWithFeedbackAction,
    null as MaterialRequestActionResult | null,
  )
  const [fulfillState, fulfillAction, fulfillPending] = useActionState(
    fulfillMaterialRequestWithFeedbackAction,
    null as MaterialRequestActionResult | null,
  )

  const { toast } = useToast()
  const toastKeys = useRef<string[]>([])

  const canProcess = role === "admin" || role === "petugas_plp"
  const lowStockItems = consumables.filter((c) => c.stock <= c.minStock)
  const createItemsForLab = useMemo(
    () => createOptions.items.filter((item) => item.labId === selectedLabId),
    [createOptions.items, selectedLabId],
  )
  const itemsPayload = useMemo(
    () =>
      JSON.stringify({
        items: Object.entries(qtyMap)
          .filter(([, qty]) => qty > 0)
          .map(([consumableItemId, qty]) => ({ consumableItemId, qty })),
      }),
    [qtyMap],
  )

  useEffect(() => {
    const states = [
      createState ? { key: `create:${createState.ok}:${createState.message}`, title: "Permintaan Bahan", ...createState } : null,
      approveState ? { key: `approve:${approveState.ok}:${approveState.message}`, title: "Permintaan Bahan", ...approveState } : null,
      rejectState ? { key: `reject:${rejectState.ok}:${rejectState.message}`, title: "Permintaan Bahan", ...rejectState } : null,
      fulfillState ? { key: `fulfill:${fulfillState.ok}:${fulfillState.message}`, title: "Permintaan Bahan", ...fulfillState } : null,
      createMasterState ? { key: `master-create:${createMasterState.ok}:${createMasterState.message}`, title: "Master Bahan", ...createMasterState } : null,
      updateMasterState ? { key: `master-update:${updateMasterState.ok}:${updateMasterState.message}`, title: "Master Bahan", ...updateMasterState } : null,
      deactivateMasterState ? { key: `master-deactivate:${deactivateMasterState.ok}:${deactivateMasterState.message}`, title: "Master Bahan", ...deactivateMasterState } : null,
    ].filter(Boolean) as Array<{ key: string; title: string; ok: boolean; message: string }>
    for (const s of states) {
      if (toastKeys.current.includes(s.key)) continue
      toastKeys.current.push(s.key)
      toast({
        title: s.title,
        description: s.message,
        variant: s.ok ? "default" : "destructive",
      })
    }
  }, [approveState, createMasterState, createState, deactivateMasterState, fulfillState, rejectState, toast, updateMasterState])

  useEffect(() => {
    if (createState?.ok) {
      queueMicrotask(() => {
        setCreateOpen(false)
        setQtyMap({})
        setRequestNote("")
      })
    }
  }, [createState])

  useEffect(() => {
    if (createMasterState?.ok) {
      queueMicrotask(() => setCreateMasterOpen(false))
    }
  }, [createMasterState])

  useEffect(() => {
    if (updateMasterState?.ok) {
      queueMicrotask(() => setEditingConsumable(null))
    }
  }, [updateMasterState])

  useEffect(() => {
    if (deactivateMasterState?.ok) {
      queueMicrotask(() => {
        setDeactivatingConsumable(null)
        setEditingConsumable(null)
      })
    }
  }, [deactivateMasterState])

  useEffect(() => {
    const activeResult =
      processActionType === "approve" ? approveState : processActionType === "reject" ? rejectState : fulfillState
    if (activeResult?.ok) {
      queueMicrotask(() => {
        setProcessingRequest(null)
        setProcessNote("")
      })
    }
  }, [approveState, fulfillState, processActionType, rejectState])

  const setQty = (id: string, qty: number) => {
    setQtyMap((prev) => ({
      ...prev,
      [id]: Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0,
    }))
  }

  const handleLabChange = (labId: string) => {
    setSelectedLabId(labId)
    setQtyMap({})
  }

  const openProcessDialog = (req: MaterialRequestRow, action: "approve" | "reject" | "fulfill") => {
    setProcessingRequest(req)
    setProcessActionType(action)
    setProcessNote("")
  }

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {lowStockItems.length > 0 && (
        <Card className="border-warning/20 bg-warning/5 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="size-5 shrink-0 text-warning-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Peringatan Stok Rendah</p>
              <p className="text-xs text-muted-foreground">
                {lowStockItems.length} bahan di bawah stok minimum: {lowStockItems.map((i) => i.name).join(", ")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        {canProcess && (
          <Dialog open={createMasterOpen} onOpenChange={setCreateMasterOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="size-4" />
                Tambah Master Bahan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Tambah Master Bahan</DialogTitle>
                <DialogDescription>Tambahkan bahan baru, stok awal, dan stok minimum.</DialogDescription>
              </DialogHeader>
              <form action={createMasterAction} className="grid gap-3">
                {createMasterState && (
                  <div className={`rounded-lg border px-3 py-2 text-sm ${createMasterState.ok ? "border-success/20 bg-success/5 text-success-foreground" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
                    {createMasterState.message}
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Laboratorium</Label>
                    <Select name="labId" defaultValue={masterLabs[0]?.id}>
                      <SelectTrigger><SelectValue placeholder="Pilih lab" /></SelectTrigger>
                      <SelectContent>
                        {masterLabs.map((lab) => <SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="masterCode">Kode Bahan</Label>
                    <Input id="masterCode" name="code" required />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="masterName">Nama Bahan</Label>
                    <Input id="masterName" name="name" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="masterCategory">Kategori</Label>
                    <Input id="masterCategory" name="category" required />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="grid gap-2">
                    <Label htmlFor="masterUnit">Satuan</Label>
                    <Input id="masterUnit" name="unit" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="masterStock">Stok Awal</Label>
                    <Input id="masterStock" name="stockQty" type="number" min={0} defaultValue={0} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="masterMinStock">Stok Minimum</Label>
                    <Input id="masterMinStock" name="minStockQty" type="number" min={0} defaultValue={0} required />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setCreateMasterOpen(false)}>Batal</Button>
                  <Button type="submit" disabled={createMasterPending}>
                    {createMasterPending ? "Menyimpan..." : "Simpan Bahan"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              Buat Permintaan Bahan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Buat Permintaan Bahan</DialogTitle>
              <DialogDescription>
                Pilih laboratorium dan isi qty bahan yang diminta (&gt; 0).
              </DialogDescription>
            </DialogHeader>
            <form action={createAction} className="grid gap-4">
              {createState && (
                <div className={`rounded-lg border px-3 py-2 text-sm ${createState.ok ? "border-success/20 bg-success/5 text-success-foreground" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
                  {createState.message}
                </div>
              )}
              <div className="grid gap-2">
                <Label>Laboratorium</Label>
                <Select name="labId" value={selectedLabId} onValueChange={handleLabChange}>
                  <SelectTrigger>
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
                <Label>Item Bahan</Label>
                <div className="max-h-64 space-y-2 overflow-auto rounded-md border border-border p-3">
                  {createItemsForLab.length === 0 && (
                    <p className="text-sm text-muted-foreground">Tidak ada bahan tersedia untuk lab ini.</p>
                  )}
                  {createItemsForLab.map((item) => (
                    <div key={item.id} className="grid grid-cols-[1fr_90px] items-center gap-3">
                      <p className="text-sm text-foreground">{item.label}</p>
                      <Input
                        type="number"
                        min={0}
                        value={qtyMap[item.id] ?? 0}
                        onChange={(e) => setQty(item.id, Number(e.target.value))}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="materialRequestNote">Catatan (opsional)</Label>
                <Textarea
                  id="materialRequestNote"
                  name="note"
                  value={requestNote}
                  onChange={(e) => setRequestNote(e.target.value)}
                  maxLength={500}
                />
              </div>
              <input type="hidden" name="itemsPayload" value={itemsPayload} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={createPending}>
                  {createPending ? "Mengirim..." : "Kirim Permintaan"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="stock" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="stock">Stok Bahan</TabsTrigger>
          <TabsTrigger value="requests">Permintaan</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="mt-0 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {consumables.map((item) => {
              const isLow = item.stock <= item.minStock
              const denominator = Math.max(item.minStock * 3, 1)
              const stockPercentage = Math.min((item.stock / denominator) * 100, 100)

              return (
                <Card key={item.id} className={`border-border/50 bg-card shadow-sm ${isLow ? "border-warning/30" : ""}`}>
                  <CardContent className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`flex size-9 items-center justify-center rounded-lg ${isLow ? "bg-warning/10" : "bg-secondary"}`}>
                          {isLow ? (
                            <TrendingDown className="size-4 text-warning-foreground" />
                          ) : (
                            <Package className="size-4 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-card-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.category} - {item.lab}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Stok: {item.stock} {item.unit}</span>
                        <span className="text-muted-foreground">Min: {item.minStock}</span>
                      </div>
                      <Progress value={stockPercentage} className={`h-2 ${isLow ? "[&>div]:bg-warning" : ""}`} />
                    </div>
                    <p className="text-xs text-muted-foreground">Kode: {item.code}</p>
                    {canProcess && (
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEditingConsumable(item)}>
                          Edit Bahan
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => setDeactivatingConsumable(item)}
                        >
                          Nonaktifkan
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="requests" className="mt-0">
          <Card className="border-border/50 bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-card-foreground">Permintaan Bahan</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">ID</TableHead>
                      <TableHead className="font-semibold">Pemohon</TableHead>
                      <TableHead className="font-semibold">Lab</TableHead>
                      <TableHead className="font-semibold">Item</TableHead>
                      <TableHead className="font-semibold">Tanggal</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="text-right font-semibold">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialRequests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                          Belum ada permintaan bahan.
                        </TableCell>
                      </TableRow>
                    )}
                    {materialRequests.map((req) => {
                      const status = requestStatusConfig[req.status]
                      return (
                        <TableRow key={req.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs text-muted-foreground">{req.code}</TableCell>
                          <TableCell className="font-medium text-foreground">
                            {req.requestor}
                            {req.requestorUserId === currentUserId && (
                              <span className="ml-1 text-xs text-muted-foreground">(Anda)</span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{req.lab}</TableCell>
                          <TableCell className="max-w-[320px] truncate text-muted-foreground">{req.items}</TableCell>
                          <TableCell className="text-muted-foreground">{req.date}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={status.className}>
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="size-8" onClick={() => setSelectedRequest(req)}>
                                <Eye className="size-4" />
                              </Button>
                              {canProcess && req.status === "pending" && (
                                <>
                                  <Button variant="ghost" size="icon" className="size-8 text-success-foreground" onClick={() => openProcessDialog(req, "approve")}>
                                    <CheckCircle2 className="size-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => openProcessDialog(req, "reject")}>
                                    <XCircle className="size-4" />
                                  </Button>
                                </>
                              )}
                              {canProcess && req.status === "approved" && (
                                <>
                                  <Button variant="outline" size="sm" onClick={() => openProcessDialog(req, "fulfill")}>
                                    Penuhi
                                  </Button>
                                  <Button variant="ghost" size="icon" className="size-8 text-destructive" onClick={() => openProcessDialog(req, "reject")}>
                                    <XCircle className="size-4" />
                                  </Button>
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
        </TabsContent>
      </Tabs>

      <Dialog open={!!processingRequest} onOpenChange={(open) => !open && setProcessingRequest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {processActionType === "approve" && "Setujui Permintaan Bahan"}
              {processActionType === "reject" && "Tolak Permintaan Bahan"}
              {processActionType === "fulfill" && "Penuhi Permintaan Bahan"}
            </DialogTitle>
            <DialogDescription>
              {processingRequest
                ? `${processingRequest.code} - ${processingRequest.requestor} (${processingRequest.lab})`
                : "Proses permintaan bahan"}
            </DialogDescription>
          </DialogHeader>
          {processingRequest && (
            <>
              <div className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {processingRequest.items}
                {processingRequest.note ? ` | Catatan: ${processingRequest.note}` : ""}
              </div>
              <form
                action={
                  processActionType === "approve"
                    ? approveAction
                    : processActionType === "reject"
                      ? rejectAction
                      : fulfillAction
                }
                className="grid gap-3"
              >
                {((processActionType === "approve" && approveState) ||
                  (processActionType === "reject" && rejectState) ||
                  (processActionType === "fulfill" && fulfillState)) && (
                  <div
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      (
                        processActionType === "approve"
                          ? approveState
                          : processActionType === "reject"
                            ? rejectState
                            : fulfillState
                      )?.ok
                        ? "border-success/20 bg-success/5 text-success-foreground"
                        : "border-destructive/20 bg-destructive/5 text-destructive"
                    }`}
                  >
                    {(
                      processActionType === "approve"
                        ? approveState
                        : processActionType === "reject"
                          ? rejectState
                          : fulfillState
                    )?.message}
                  </div>
                )}
                <input type="hidden" name="requestId" value={processingRequest.id} />
                <div className="grid gap-2">
                  <Label htmlFor="processRequestNote">Catatan (opsional)</Label>
                  <Textarea
                    id="processRequestNote"
                    name="note"
                    value={processNote}
                    onChange={(e) => setProcessNote(e.target.value)}
                    maxLength={500}
                    placeholder={
                      processActionType === "approve"
                        ? "Contoh: disetujui untuk praktikum minggu ini"
                        : processActionType === "fulfill"
                          ? "Contoh: diserahkan lengkap"
                          : "Contoh: stok sedang kosong"
                    }
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setProcessingRequest(null)}>
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    variant={processActionType === "reject" ? "destructive" : "default"}
                    disabled={
                      (processActionType === "approve" && approvePending) ||
                      (processActionType === "reject" && rejectPending) ||
                      (processActionType === "fulfill" && fulfillPending)
                    }
                  >
                    {processActionType === "approve" && (approvePending ? "Memproses..." : "Setujui")}
                    {processActionType === "reject" && (rejectPending ? "Memproses..." : "Tolak")}
                    {processActionType === "fulfill" && (fulfillPending ? "Memproses..." : "Penuhi")}
                  </Button>
                </div>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Detail Permintaan Bahan</DialogTitle>
            <DialogDescription>
              {selectedRequest ? `${selectedRequest.code} - ${selectedRequest.requestor}` : "Informasi permintaan bahan"}
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="grid gap-4">
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-muted-foreground">Kode</p>
                  <p className="font-mono text-foreground">{selectedRequest.code}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant="outline" className={requestStatusConfig[selectedRequest.status].className}>
                    {requestStatusConfig[selectedRequest.status].label}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Pemohon</p>
                  <p className="text-foreground">{selectedRequest.requestor}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Laboratorium</p>
                  <p className="text-foreground">{selectedRequest.lab}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tanggal</p>
                  <p className="text-foreground">{selectedRequest.date}</p>
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm text-muted-foreground">Item Diminta</p>
                <div className="rounded-lg border border-border/50 bg-muted/40">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-border/50 px-3 py-2 text-xs text-muted-foreground">
                    <span>Nama Item</span>
                    <span className="text-right">Diminta</span>
                    <span className="text-right">Terpenuhi</span>
                  </div>
                  <div className="flex flex-col">
                    {selectedRequest.lines.length === 0 && (
                      <div className="px-3 py-2 text-sm text-muted-foreground">Detail item belum tersedia.</div>
                    )}
                    {selectedRequest.lines.map((line) => (
                      <div
                        key={`${selectedRequest.id}-${line.consumableId}`}
                        className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 py-2 text-sm"
                      >
                        <span className="text-foreground">{line.name}</span>
                        <span className="text-right text-muted-foreground">
                          {line.qtyRequested} {line.unit}
                        </span>
                        <span className="text-right text-muted-foreground">
                          {line.qtyFulfilled} {line.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {selectedRequest.note && (
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">Catatan</p>
                  <div className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-sm text-foreground">
                    {selectedRequest.note}
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                  Tutup
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingConsumable} onOpenChange={(open) => !open && setEditingConsumable(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Master Bahan</DialogTitle>
            <DialogDescription>Koreksi stok, ubah stok minimum, atau edit data master bahan.</DialogDescription>
          </DialogHeader>
          {editingConsumable && (
            <form action={updateMasterAction} className="grid gap-3">
              {updateMasterState && (
                <div className={`rounded-lg border px-3 py-2 text-sm ${updateMasterState.ok ? "border-success/20 bg-success/5 text-success-foreground" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
                  {updateMasterState.message}
                </div>
              )}
              <input type="hidden" name="consumableId" value={editingConsumable.id} />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Laboratorium</Label>
                  <Select name="labId" defaultValue={editingConsumable.labId}>
                    <SelectTrigger><SelectValue placeholder="Pilih lab" /></SelectTrigger>
                    <SelectContent>
                      {masterLabs.map((lab) => <SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Kode Bahan</Label>
                  <Input name="code" defaultValue={editingConsumable.code} required />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Nama Bahan</Label>
                  <Input name="name" defaultValue={editingConsumable.name} required />
                </div>
                <div className="grid gap-2">
                  <Label>Kategori</Label>
                  <Input name="category" defaultValue={editingConsumable.category} required />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-2">
                  <Label>Satuan</Label>
                  <Input name="unit" defaultValue={editingConsumable.unit} required />
                </div>
                <div className="grid gap-2">
                  <Label>Koreksi Stok Saat Ini</Label>
                  <Input name="stockQty" type="number" min={0} defaultValue={editingConsumable.stock} required />
                </div>
                <div className="grid gap-2">
                  <Label>Stok Minimum</Label>
                  <Input name="minStockQty" type="number" min={0} defaultValue={editingConsumable.minStock} required />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingConsumable(null)}>Batal</Button>
                <Button type="submit" disabled={updateMasterPending}>
                  {updateMasterPending ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deactivatingConsumable} onOpenChange={(open) => !open && setDeactivatingConsumable(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nonaktifkan Master Bahan</DialogTitle>
            <DialogDescription>
              {deactivatingConsumable
                ? `Bahan "${deactivatingConsumable.name}" akan disembunyikan dari daftar aktif dan form permintaan.`
                : "Konfirmasi nonaktifkan bahan."}
            </DialogDescription>
          </DialogHeader>
          <form action={deactivateMasterAction} className="grid gap-3">
            {deactivateMasterState && (
              <div className={`rounded-lg border px-3 py-2 text-sm ${deactivateMasterState.ok ? "border-success/20 bg-success/5 text-success-foreground" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
                {deactivateMasterState.message}
              </div>
            )}
            <input type="hidden" name="consumableId" value={deactivatingConsumable?.id ?? ""} />
            <div className="rounded-lg border border-border/50 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Proteksi aktif: bahan tidak dapat dinonaktifkan jika sudah pernah direferensikan transaksi/permintaan.
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDeactivatingConsumable(null)}>
                Batal
              </Button>
              <Button type="submit" variant="destructive" disabled={deactivateMasterPending || !deactivatingConsumable}>
                {deactivateMasterPending ? "Memproses..." : "Nonaktifkan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
