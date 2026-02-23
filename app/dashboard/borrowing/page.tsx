"use client"

import { useState } from "react"
import { borrowings } from "@/lib/mock-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Eye, CheckCircle2, XCircle, Clock, Package } from "lucide-react"

const statusConfig = {
  active: { label: "Aktif", className: "bg-primary/10 text-primary border-primary/20" },
  overdue: { label: "Terlambat", className: "bg-destructive/10 text-destructive border-destructive/20" },
  returned: { label: "Dikembalikan", className: "bg-success/10 text-success-foreground border-success/20" },
  pending: { label: "Menunggu", className: "bg-warning/10 text-warning-foreground border-warning/20" },
}

type BorrowingItem = typeof borrowings[number]

export default function BorrowingPage() {
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedBorrowing, setSelectedBorrowing] = useState<BorrowingItem | null>(null)

  const filtered = borrowings.filter((b) => statusFilter === "all" || b.status === statusFilter)

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/50 bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-warning/10">
              <Clock className="size-4 text-warning-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pending</p>
              <p className="text-lg font-bold text-card-foreground">{borrowings.filter(b => b.status === "pending").length}</p>
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
              <p className="text-lg font-bold text-card-foreground">{borrowings.filter(b => b.status === "active").length}</p>
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
              <p className="text-lg font-bold text-card-foreground">{borrowings.filter(b => b.status === "overdue").length}</p>
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
              <p className="text-lg font-bold text-card-foreground">{borrowings.filter(b => b.status === "returned").length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 bg-card">
            <SelectValue placeholder="Filter Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Status</SelectItem>
            <SelectItem value="pending">Menunggu</SelectItem>
            <SelectItem value="active">Aktif</SelectItem>
            <SelectItem value="overdue">Terlambat</SelectItem>
            <SelectItem value="returned">Dikembalikan</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Borrowing Table */}
      <Card className="border-border/50 bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-card-foreground">
            Daftar Peminjaman ({filtered.length})
          </CardTitle>
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
                {filtered.map((borrow) => {
                  const status = statusConfig[borrow.status]
                  return (
                    <TableRow key={borrow.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs text-muted-foreground">{borrow.id}</TableCell>
                      <TableCell className="font-medium text-foreground">{borrow.borrower}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{borrow.nim}</TableCell>
                      <TableCell className="text-muted-foreground">{borrow.borrowDate}</TableCell>
                      <TableCell className="text-muted-foreground">{borrow.dueDate}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground max-w-[150px] truncate">{borrow.purpose}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => setSelectedBorrowing(borrow)}
                            aria-label="Lihat detail"
                          >
                            <Eye className="size-4" />
                          </Button>
                          {borrow.status === "pending" && (
                            <>
                              <Button variant="ghost" size="icon" className="size-8 text-success-foreground hover:text-success-foreground" aria-label="Setujui">
                                <CheckCircle2 className="size-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label="Tolak">
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedBorrowing} onOpenChange={() => setSelectedBorrowing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detail Peminjaman {selectedBorrowing?.id}</DialogTitle>
            <DialogDescription>Informasi lengkap peminjaman alat laboratorium.</DialogDescription>
          </DialogHeader>
          {selectedBorrowing && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Peminjam</p>
                  <p className="font-medium text-foreground">{selectedBorrowing.borrower}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">NIM</p>
                  <p className="font-mono text-foreground">{selectedBorrowing.nim}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tanggal Pinjam</p>
                  <p className="text-foreground">{selectedBorrowing.borrowDate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Batas Kembali</p>
                  <p className="text-foreground">{selectedBorrowing.dueDate}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Keperluan</p>
                  <p className="text-foreground">{selectedBorrowing.purpose}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Disetujui Oleh</p>
                  <p className="text-foreground">{selectedBorrowing.approvedBy || "-"}</p>
                </div>
              </div>
              <Separator />
              <div>
                <p className="mb-2 text-sm font-medium text-foreground">Daftar Alat</p>
                <div className="flex flex-col gap-2">
                  {selectedBorrowing.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/50 px-3 py-2">
                      <span className="text-sm text-foreground">{item.tool}</span>
                      <Badge variant="secondary">{item.qty}x</Badge>
                    </div>
                  ))}
                </div>
              </div>
              {selectedBorrowing.status === "pending" && (
                <>
                  <Separator />
                  <div className="flex gap-2">
                    <Button className="flex-1">
                      <CheckCircle2 className="size-4" />
                      Setujui
                    </Button>
                    <Button variant="destructive" className="flex-1">
                      <XCircle className="size-4" />
                      Tolak
                    </Button>
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
