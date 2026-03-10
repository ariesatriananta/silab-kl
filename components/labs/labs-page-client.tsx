"use client"

import { useActionState, useEffect, useMemo, useState } from "react"
import { Building2, Boxes, ClipboardList, Plus, Search, TestTube2, ToggleLeft, ToggleRight } from "lucide-react"

import {
  createLabManagementAction,
  deleteLabManagementAction,
  toggleLabActiveAction,
  updateLabManagementAction,
  type LabManagementActionResult,
} from "@/app/dashboard/labs/actions"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { KpiCard } from "@/components/ui/kpi-card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

export type LabManagementRow = {
  id: string
  code: string
  name: string
  description: string | null
  isActive: boolean
  createdAt: string | null
  assignmentCount: number
  toolModelCount: number
  consumableCount: number
}

function LabFormFields({
  mode,
  active,
  setActive,
  defaultValues,
}: {
  mode: "create" | "edit"
  active: boolean
  setActive: (value: boolean) => void
  defaultValues?: Partial<LabManagementRow>
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={`${mode}-lab-code`}>Kode Lab</Label>
          <Input
            id={`${mode}-lab-code`}
            name="code"
            defaultValue={defaultValues?.code ?? ""}
            placeholder="Contoh: LAB-HEMA"
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${mode}-lab-name`}>Nama Laboratorium</Label>
          <Input
            id={`${mode}-lab-name`}
            name="name"
            defaultValue={defaultValues?.name ?? ""}
            placeholder="Contoh: Lab Hematologi"
            required
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${mode}-lab-description`}>Deskripsi (opsional)</Label>
        <Textarea
          id={`${mode}-lab-description`}
          name="description"
          defaultValue={defaultValues?.description ?? ""}
          placeholder="Catatan singkat, cakupan lab, atau informasi tambahan."
          rows={4}
        />
      </div>

      {mode === "edit" ? (
        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/30 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-foreground">Lab Aktif</p>
            <p className="text-xs text-muted-foreground">Lab nonaktif tidak akan muncul pada dropdown operasional.</p>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <input type="hidden" name="isActive" value={String(active)} />
          </div>
        </div>
      ) : null}
    </>
  )
}

export function LabsPageClient({ rows }: { rows: LabManagementRow[] }) {
  const { toast } = useToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [editLab, setEditLab] = useState<LabManagementRow | null>(null)
  const [toggleLab, setToggleLab] = useState<LabManagementRow | null>(null)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [editActive, setEditActive] = useState(true)

  const [createState, createAction, createPending] = useActionState(
    createLabManagementAction,
    null as LabManagementActionResult | null,
  )
  const [updateState, updateAction, updatePending] = useActionState(
    updateLabManagementAction,
    null as LabManagementActionResult | null,
  )
  const [toggleState, toggleAction, togglePending] = useActionState(
    toggleLabActiveAction,
    null as LabManagementActionResult | null,
  )
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteLabManagementAction,
    null as LabManagementActionResult | null,
  )

  useEffect(() => {
    if (!createState) return
    toast({
      title: createState.ok ? "Laboratorium" : "Gagal",
      description: createState.message,
      variant: createState.ok ? "default" : "destructive",
    })
    if (createState.ok) setCreateOpen(false)
  }, [createState, toast])

  useEffect(() => {
    if (!updateState) return
    toast({
      title: updateState.ok ? "Laboratorium" : "Gagal",
      description: updateState.message,
      variant: updateState.ok ? "default" : "destructive",
    })
    if (updateState.ok) setEditLab(null)
  }, [updateState, toast])

  useEffect(() => {
    if (!toggleState) return
    toast({
      title: toggleState.ok ? "Status Laboratorium" : "Gagal",
      description: toggleState.message,
      variant: toggleState.ok ? "default" : "destructive",
    })
    if (toggleState.ok) setToggleLab(null)
  }, [toggleState, toast])

  useEffect(() => {
    if (!deleteState) return
    toast({
      title: deleteState.ok ? "Hapus Laboratorium" : "Gagal",
      description: deleteState.message,
      variant: deleteState.ok ? "default" : "destructive",
    })
    if (deleteState.ok) setToggleLab(null)
  }, [deleteState, toast])

  useEffect(() => {
    if (!editLab) return
    setEditActive(editLab.isActive)
  }, [editLab])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (statusFilter === "active" && !row.isActive) return false
      if (statusFilter === "inactive" && row.isActive) return false
      if (!query) return true
      return (
        row.name.toLowerCase().includes(query) ||
        row.code.toLowerCase().includes(query) ||
        (row.description ?? "").toLowerCase().includes(query)
      )
    })
  }, [rows, search, statusFilter])

  const summary = useMemo(() => {
    const total = rows.length
    const active = rows.filter((row) => row.isActive).length
    const inactive = total - active
    const assignments = rows.reduce((sum, row) => sum + row.assignmentCount, 0)
    return { total, active, inactive, assignments }
  }, [rows])

  const renderStatusBadge = (isActive: boolean) =>
    isActive ? (
      <Badge className="rounded-full border-success/20 bg-success/10 text-success-foreground">Aktif</Badge>
    ) : (
      <Badge variant="outline" className="rounded-full border-border/60 bg-muted/35 text-muted-foreground">
        Nonaktif
      </Badge>
    )

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <Card className="border-border/60 bg-card/95 shadow-sm">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <CardTitle>Kelola Laboratorium</CardTitle>
            <p className="text-sm text-muted-foreground">
              Master laboratorium yang dipakai lintas modul: alat, bahan, booking lab, assignment user, dan approval.
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" />
                Tambah Laboratorium
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>Tambah Laboratorium</DialogTitle>
                <DialogDescription>Tambahkan master lab baru untuk dipakai pada seluruh modul operasional.</DialogDescription>
              </DialogHeader>
              <form action={createAction} className="space-y-4">
                <LabFormFields mode="create" active={true} setActive={() => undefined} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" disabled={createPending}>
                    {createPending ? "Menyimpan..." : "Simpan Laboratorium"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="Total Lab" value={summary.total} icon={Building2} tone="primary" />
        <KpiCard title="Lab Aktif" value={summary.active} icon={ToggleRight} tone="success" />
        <KpiCard title="Lab Nonaktif" value={summary.inactive} icon={ToggleLeft} tone="warning" />
        <KpiCard title="Total Assignment" value={summary.assignments} icon={ClipboardList} />
      </div>

      <Card className="border-border/60 bg-card/95 shadow-sm">
        <CardHeader>
          <CardTitle>Filter Daftar</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="lab-search">Cari nama, kode, atau deskripsi</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="lab-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cari laboratorium..."
                className="pl-9"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Semua status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="inactive">Nonaktif</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 bg-card/95 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Daftar Laboratorium ({filteredRows.length})</CardTitle>
          <p className="text-xs text-muted-foreground">Master ini menjadi sumber dropdown dan referensi di seluruh aplikasi.</p>
        </CardHeader>
        <CardContent>
          {filteredRows.length === 0 ? (
            <Empty className="min-h-[260px]">
              <EmptyHeader>
                <EmptyMedia variant="icon" className="bg-muted/45 text-muted-foreground">
                  <Building2 className="size-5" />
                </EmptyMedia>
                <EmptyTitle>Tidak ada laboratorium yang cocok</EmptyTitle>
                <EmptyDescription>Ubah filter pencarian atau tambahkan lab baru.</EmptyDescription>
              </EmptyHeader>
              <EmptyContent />
            </Empty>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode</TableHead>
                    <TableHead>Nama Lab</TableHead>
                    <TableHead>Deskripsi</TableHead>
                    <TableHead className="text-center">Assignment</TableHead>
                    <TableHead className="text-center">Model Alat</TableHead>
                    <TableHead className="text-center">Bahan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.code}</TableCell>
                      <TableCell>
                        <div className="min-w-[180px]">
                          <p className="font-medium text-foreground">{row.name}</p>
                          <p className="text-xs text-muted-foreground">{row.createdAt ? new Date(row.createdAt).toLocaleDateString("id-ID") : "-"}</p>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[320px] text-sm text-muted-foreground">
                        {row.description?.trim() ? row.description : "Tidak ada deskripsi."}
                      </TableCell>
                      <TableCell className="text-center">{row.assignmentCount}</TableCell>
                      <TableCell className="text-center">{row.toolModelCount}</TableCell>
                      <TableCell className="text-center">{row.consumableCount}</TableCell>
                      <TableCell>{renderStatusBadge(row.isActive)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => setEditLab(row)}>
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={row.isActive ? "outline" : "default"}
                            onClick={() => setToggleLab(row)}
                          >
                            {row.isActive ? "Nonaktifkan" : "Aktifkan"}
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

      <Dialog open={!!editLab} onOpenChange={(open) => !open && setEditLab(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Laboratorium</DialogTitle>
            <DialogDescription>Perbarui identitas lab dan status aktifnya.</DialogDescription>
          </DialogHeader>
          {editLab ? (
            <form action={updateAction} className="space-y-4">
              <input type="hidden" name="labId" value={editLab.id} />
              <LabFormFields mode="edit" active={editActive} setActive={setEditActive} defaultValues={editLab} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditLab(null)}>
                  Batal
                </Button>
                <Button type="submit" disabled={updatePending}>
                  {updatePending ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toggleLab} onOpenChange={(open) => !open && setToggleLab(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toggleLab?.isActive ? "Nonaktifkan laboratorium?" : "Aktifkan laboratorium?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {toggleLab?.isActive
                ? "Lab nonaktif tidak akan muncul pada dropdown operasional, tetapi data historis tetap aman."
                : "Lab aktif akan kembali tersedia pada modul operasional yang memakai master laboratorium."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {toggleLab ? (
            <AlertDialogFooter>
              <form action={deleteAction} className="mr-auto">
                <input type="hidden" name="labId" value={toggleLab.id} />
                <Button type="submit" variant="destructive" disabled={deletePending || togglePending}>
                  {deletePending ? "Menghapus..." : "Hapus Permanen"}
                </Button>
              </form>
              <AlertDialogCancel type="button">Batal</AlertDialogCancel>
              <form action={toggleAction}>
                <input type="hidden" name="labId" value={toggleLab.id} />
                <input type="hidden" name="nextActive" value={String(!toggleLab.isActive)} />
                <Button type="submit" disabled={togglePending || deletePending}>
                  {togglePending ? "Memproses..." : toggleLab.isActive ? "Nonaktifkan" : "Aktifkan"}
                </Button>
              </form>
            </AlertDialogFooter>
          ) : null}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
