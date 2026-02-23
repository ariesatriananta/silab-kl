"use client"

import { useState } from "react"
import { studentTools } from "@/lib/mock-data"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, QrCode, Wrench, ArrowRight } from "lucide-react"

export default function StudentToolsPage() {
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")

  const categories = Array.from(new Set(studentTools.map((t) => t.category)))

  const filtered = studentTools.filter((tool) => {
    const matchesSearch = tool.name.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = categoryFilter === "all" || tool.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Scan QR CTA */}
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardContent className="flex flex-col items-center gap-3 p-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
              <QrCode className="size-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Scan QR Code Alat</p>
              <p className="text-xs text-muted-foreground">Pindai kode QR pada alat untuk melihat detail dan meminjam.</p>
            </div>
          </div>
          <Button className="w-full sm:w-auto">
            <QrCode className="size-4" />
            Scan QR
          </Button>
        </CardContent>
      </Card>

      {/* Search & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari alat laboratorium..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-44 bg-card">
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>{cat}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((tool) => {
          const isAvailable = tool.available > 0
          return (
            <Card key={tool.id} className="group border-border/50 bg-card shadow-sm hover:shadow-md transition-all">
              <CardContent className="flex flex-col gap-4 p-0">
                {/* Image placeholder */}
                <div className="flex h-40 items-center justify-center rounded-t-xl bg-muted">
                  <Wrench className="size-12 text-muted-foreground/30" />
                </div>
                <div className="flex flex-col gap-3 px-5 pb-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-card-foreground leading-tight">{tool.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{tool.lab}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {tool.category}
                    </Badge>
                  </div>
                  {/* Availability */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`size-2 rounded-full ${isAvailable ? "bg-success" : "bg-destructive"}`} />
                      <span className={`text-xs font-medium ${isAvailable ? "text-success-foreground" : "text-destructive"}`}>
                        {isAvailable ? `${tool.available} tersedia` : "Tidak tersedia"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {tool.available}/{tool.total} unit
                    </span>
                  </div>
                  {/* Action */}
                  <Button
                    className="w-full"
                    disabled={!isAvailable}
                    variant={isAvailable ? "default" : "secondary"}
                  >
                    {isAvailable ? (
                      <span className="flex items-center gap-2">
                        Pinjam Sekarang
                        <ArrowRight className="size-4" />
                      </span>
                    ) : (
                      "Tidak Tersedia"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Wrench className="size-12 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Tidak ada alat yang ditemukan.</p>
        </div>
      )}
    </div>
  )
}
