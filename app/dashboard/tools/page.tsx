"use client"

import { useState } from "react"
import { tools } from "@/lib/mock-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Search, Plus, QrCode, Pencil } from "lucide-react"

const statusConfig = {
  available: { label: "Tersedia", className: "bg-success/10 text-success-foreground border-success/20" },
  borrowed: { label: "Dipinjam", className: "bg-primary/10 text-primary border-primary/20" },
  maintenance: { label: "Maintenance", className: "bg-warning/10 text-warning-foreground border-warning/20" },
  damaged: { label: "Rusak", className: "bg-destructive/10 text-destructive border-destructive/20" },
}

export default function ToolsPage() {
  const [search, setSearch] = useState("")
  const [labFilter, setLabFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showQrDialog, setShowQrDialog] = useState<string | null>(null)

  const labs = Array.from(new Set(tools.map((t) => t.lab)))
  const categories = Array.from(new Set(tools.map((t) => t.category)))

  const filtered = tools.filter((tool) => {
    const matchesSearch = tool.name.toLowerCase().includes(search.toLowerCase()) || tool.id.toLowerCase().includes(search.toLowerCase())
    const matchesLab = labFilter === "all" || tool.lab === labFilter
    const matchesCategory = categoryFilter === "all" || tool.category === categoryFilter
    return matchesSearch && matchesLab && matchesCategory
  })

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Filters */}
      <Card className="border-border/50 bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari alat berdasarkan nama atau ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-background"
              />
            </div>
            <Select value={labFilter} onValueChange={setLabFilter}>
              <SelectTrigger className="w-full sm:w-48 bg-background">
                <SelectValue placeholder="Filter Lab" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Lab</SelectItem>
                {labs.map((lab) => (
                  <SelectItem key={lab} value={lab}>{lab}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-40 bg-background">
                <SelectValue placeholder="Kategori" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Kategori</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto">
                  <Plus className="size-4" />
                  Tambah Alat
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Tambah Alat Baru</DialogTitle>
                  <DialogDescription>Masukkan detail alat laboratorium baru.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-4">
                  <div className="flex flex-col gap-2">
                    <Label>Nama Alat</Label>
                    <Input placeholder="Nama alat" className="bg-background" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label>Kategori</Label>
                      <Select>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Pilih" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Laboratorium</Label>
                      <Select>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Pilih" />
                        </SelectTrigger>
                        <SelectContent>
                          {labs.map((lab) => (
                            <SelectItem key={lab} value={lab}>{lab}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Kondisi</Label>
                    <Input placeholder="Baik" className="bg-background" />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowAddDialog(false)}>Batal</Button>
                  <Button onClick={() => setShowAddDialog(false)}>Simpan</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="border-border/50 bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-card-foreground">
            Daftar Alat ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="font-semibold">ID</TableHead>
                  <TableHead className="font-semibold">Nama Alat</TableHead>
                  <TableHead className="font-semibold">Kategori</TableHead>
                  <TableHead className="font-semibold">Laboratorium</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Kondisi</TableHead>
                  <TableHead className="text-right font-semibold">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tool) => {
                  const status = statusConfig[tool.status]
                  return (
                    <TableRow key={tool.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs text-muted-foreground">{tool.id}</TableCell>
                      <TableCell className="font-medium text-foreground">{tool.name}</TableCell>
                      <TableCell className="text-muted-foreground">{tool.category}</TableCell>
                      <TableCell className="text-muted-foreground">{tool.lab}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{tool.condition}</TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => setShowQrDialog(tool.qrCode)}
                            aria-label="Lihat QR Code"
                          >
                            <QrCode className="size-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="size-8" aria-label="Edit alat">
                            <Pencil className="size-4" />
                          </Button>
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

      {/* QR Code Dialog */}
      <Dialog open={!!showQrDialog} onOpenChange={() => setShowQrDialog(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>QR Code Alat</DialogTitle>
            <DialogDescription>Scan QR code ini untuk identifikasi alat.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex size-48 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <QrCode className="size-16" />
                <span className="text-xs font-mono">{showQrDialog}</span>
              </div>
            </div>
            <Button variant="outline" className="w-full">Download QR Code</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
