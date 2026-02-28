"use client"

import { useActionState, useEffect, useMemo, useRef, useState } from "react"
import { CheckCircle2, Settings2 } from "lucide-react"

import {
  saveBorrowingApprovalMatrixAction,
  type ApprovalMatrixActionResult,
} from "@/app/dashboard/approval-matrix/actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"

export type ApprovalMatrixRow = {
  labId: string
  labName: string
  isActive: boolean
  step1ApproverUserId: string | null
  step2ApproverUserId: string | null
  step1ApproverName: string | null
  step2ApproverName: string | null
  dosenAssignedCount: number
  plpAssignedCount: number
  dosenCandidates: Array<{ id: string; name: string; identifier: string | null }>
  plpCandidates: Array<{ id: string; name: string; identifier: string | null }>
}

export function ApprovalMatrixPageClient({ rows }: { rows: ApprovalMatrixRow[] }) {
  const [selected, setSelected] = useState<ApprovalMatrixRow | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [step1ApproverUserId, setStep1ApproverUserId] = useState<string>("")
  const [step2ApproverUserId, setStep2ApproverUserId] = useState<string>("")

  const [state, action, pending] = useActionState(
    saveBorrowingApprovalMatrixAction,
    null as ApprovalMatrixActionResult | null,
  )
  const shown = useRef<string[]>([])
  const { toast } = useToast()

  useEffect(() => {
    if (!state) return
    const key = `${state.ok}:${state.message}`
    if (shown.current.includes(key)) return
    shown.current.push(key)
    toast({
      title: "Approval Matrix",
      description: state.message,
      variant: state.ok ? "default" : "destructive",
    })
    if (state.ok) {
      queueMicrotask(() => setSelected(null))
    }
  }, [state, toast])

  const summary = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((r) => r.isActive).length,
      inactive: rows.filter((r) => !r.isActive).length,
      notReady: rows.filter((r) => !r.step1ApproverUserId || !r.step2ApproverUserId).length,
    }),
    [rows],
  )

  return (
    <div className="min-w-0 overflow-x-hidden flex flex-col gap-6 p-4 lg:p-6">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-foreground">Approval Matrix Peminjaman</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Setiap lab wajib memiliki matrix aktif dengan urutan tetap: tahap 1 Dosen, tahap 2 Petugas PLP.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="border-border/50 bg-card shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Lab</p><p className="mt-1 text-lg font-semibold">{summary.total}</p></CardContent></Card>
        <Card className="border-border/50 bg-card shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Matrix Aktif</p><p className="mt-1 text-lg font-semibold">{summary.active}</p></CardContent></Card>
        <Card className="border-border/50 bg-card shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Matrix Nonaktif</p><p className="mt-1 text-lg font-semibold">{summary.inactive}</p></CardContent></Card>
        <Card className="border-border/50 bg-card shadow-sm"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Lab Belum Siap</p><p className="mt-1 text-lg font-semibold">{summary.notReady}</p></CardContent></Card>
      </div>

      <Card className="border-border/50 bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Daftar Matrix per Lab</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="w-full overflow-x-auto">
            <Table className="min-w-[860px]">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Laboratorium</TableHead>
                  <TableHead>Approver Tahap 1 (Dosen)</TableHead>
                  <TableHead>Approver Tahap 2 (Petugas PLP)</TableHead>
                  <TableHead>Assignment Dosen</TableHead>
                  <TableHead>Assignment PLP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Empty className="border border-border/50 bg-muted/20 py-8">
                        <EmptyHeader>
                          <EmptyMedia variant="icon"><Settings2 className="size-5" /></EmptyMedia>
                          <EmptyTitle className="text-base">Belum ada data lab</EmptyTitle>
                          <EmptyDescription>Tambahkan master lab terlebih dahulu.</EmptyDescription>
                        </EmptyHeader>
                      </Empty>
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((row) => {
                  const ready = Boolean(row.step1ApproverUserId && row.step2ApproverUserId)
                  return (
                    <TableRow key={row.labId} className="hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">{row.labName}</TableCell>
                      <TableCell>{row.step1ApproverName ?? <span className="text-muted-foreground">Belum dipilih</span>}</TableCell>
                      <TableCell>{row.step2ApproverName ?? <span className="text-muted-foreground">Belum dipilih</span>}</TableCell>
                      <TableCell>{row.dosenAssignedCount}</TableCell>
                      <TableCell>{row.plpAssignedCount}</TableCell>
                      <TableCell>
                        {row.isActive ? (
                          <Badge variant="outline" className="rounded-full border-success/20 bg-success/10 text-success-foreground">
                            Aktif
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-full border-border/50 bg-muted/30 text-muted-foreground">
                            Nonaktif
                          </Badge>
                        )}
                        {!ready && (
                          <p className="mt-1 text-xs text-warning-foreground">Perlu assignment Dosen+PLP</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelected(row)
                            setIsActive(row.isActive)
                            setStep1ApproverUserId(row.step1ApproverUserId ?? "")
                            setStep2ApproverUserId(row.step2ApproverUserId ?? "")
                          }}
                        >
                          Atur
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Atur Approval Matrix</DialogTitle>
            <DialogDescription>
              {selected ? selected.labName : "-"} - urutan wajib Dosen lalu Petugas PLP.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <form action={action} className="grid gap-4">
              {state && (
                <div className={`rounded-xl border px-3 py-2 text-sm ${state.ok ? "border-success/20 bg-success/5 text-success-foreground" : "border-destructive/20 bg-destructive/5 text-destructive"}`}>
                  {state.message}
                </div>
              )}
              <input type="hidden" name="labId" value={selected.labId} />
              <input type="hidden" name="isActive" value={String(isActive)} />
              <input type="hidden" name="step1ApproverUserId" value={step1ApproverUserId} />
              <input type="hidden" name="step2ApproverUserId" value={step2ApproverUserId} />

              <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <p className="text-sm font-medium text-foreground">Rute Approval</p>
                <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="secondary">1. Dosen</Badge>
                  <CheckCircle2 className="size-4" />
                  <Badge variant="secondary">2. Petugas PLP</Badge>
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-sm">
                <p className="font-medium text-foreground">Kesiapan Assignment</p>
                <p className="mt-1 text-muted-foreground">Dosen ter-assign: {selected.dosenAssignedCount}</p>
                <p className="text-muted-foreground">Petugas PLP ter-assign: {selected.plpAssignedCount}</p>
              </div>

              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="step1ApproverUserId">Approver-1 (Dosen)</Label>
                  <Select value={step1ApproverUserId} onValueChange={setStep1ApproverUserId}>
                    <SelectTrigger id="step1ApproverUserId" className="w-full">
                      <SelectValue placeholder="Pilih dosen approver" />
                    </SelectTrigger>
                    <SelectContent>
                      {selected.dosenCandidates.length === 0 && (
                        <SelectItem value="__no_dosen__" disabled>
                          Belum ada dosen ter-assign
                        </SelectItem>
                      )}
                      {selected.dosenCandidates.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.name}
                          {candidate.identifier ? ` (${candidate.identifier})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="step2ApproverUserId">Approver-2 (Petugas PLP)</Label>
                  <Select value={step2ApproverUserId} onValueChange={setStep2ApproverUserId}>
                    <SelectTrigger id="step2ApproverUserId" className="w-full">
                      <SelectValue placeholder="Pilih petugas PLP approver" />
                    </SelectTrigger>
                    <SelectContent>
                      {selected.plpCandidates.length === 0 && (
                        <SelectItem value="__no_plp__" disabled>
                          Belum ada petugas PLP ter-assign
                        </SelectItem>
                      )}
                      {selected.plpCandidates.map((candidate) => (
                        <SelectItem key={candidate.id} value={candidate.id}>
                          {candidate.name}
                          {candidate.identifier ? ` (${candidate.identifier})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">Aktifkan Matrix</p>
                  <p className="text-xs text-muted-foreground">Pengajuan pada lab ini hanya boleh berjalan jika matrix aktif.</p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setSelected(null)} disabled={pending}>
                  Batal
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? "Menyimpan..." : "Simpan Matrix"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
