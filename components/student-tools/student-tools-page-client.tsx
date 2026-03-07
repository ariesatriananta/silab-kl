"use client"

import Link from "next/link"
import { useDeferredValue, useEffect, useState, useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, ArrowRight, Search, Wrench } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type StudentToolCatalogRow = {
  id: string
  modelId: string
  labId: string
  name: string
  image?: string | null
  available: number
  total: number
  lab: string
  category: string
}

export type StudentToolCatalogFilters = {
  search: string
  category: string
  filteredAvailableCount: number
  filteredTotalUnits: number
  filteredTotalModels: number
}

export type StudentToolCatalogPagination = {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  showingFrom: number
  showingTo: number
}

export function StudentToolsPageClient({
  data,
  categories,
  filters,
  pagination,
}: {
  data: StudentToolCatalogRow[]
  categories: string[]
  filters: StudentToolCatalogFilters
  pagination: StudentToolCatalogPagination
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [search, setSearch] = useState(filters.search)
  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    setSearch(filters.search)
  }, [filters.search])

  useEffect(() => {
    const nextSearch = deferredSearch.trim()
    const currentSearch = searchParams.get("search") ?? ""
    if (nextSearch === currentSearch) return

    const handle = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (nextSearch) params.set("search", nextSearch)
      else params.delete("search")
      params.delete("page")

      startTransition(() => {
        router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, {
          scroll: false,
        })
      })
    }, 300)

    return () => clearTimeout(handle)
  }, [deferredSearch, pathname, router, searchParams])

  function updateQuery(updater: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString())
    updater(params)
    startTransition(() => {
      router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, {
        scroll: false,
      })
    })
  }

  function resetFilters() {
    setSearch("")
    startTransition(() => {
      router.replace(pathname, { scroll: false })
    })
  }

  return (
    <div className="min-w-0 overflow-x-hidden flex flex-col gap-6 p-4 lg:p-6">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-5 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Katalog Alat Laboratorium</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Cari alat yang tersedia, lalu ajukan peminjaman langsung dari katalog.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:w-[320px]">
              <div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
                <p className="text-xs text-muted-foreground">Model Tersedia</p>
                <p className="text-lg font-semibold text-foreground">{filters.filteredAvailableCount}</p>
              </div>
              <div className="rounded-lg border border-border/50 bg-background/70 px-3 py-2">
                <p className="text-xs text-muted-foreground">Total Unit</p>
                <p className="text-lg font-semibold text-foreground">{filters.filteredTotalUnits}</p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 rounded-xl border border-border/50 bg-background/60 p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Langkah Cepat
              </p>
              <p className="mt-1 text-sm text-foreground">
                1. Cari alat berdasarkan nama/kategori.
                <br />
                2. Klik <span className="font-medium">Pinjam Sekarang</span> jika tersedia.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Info Status
              </p>
              <p className="mt-1 text-sm text-foreground">
                <span className="font-medium">{filters.filteredAvailableCount}</span> model tersedia dari{" "}
                <span className="font-medium">{filters.filteredTotalModels}</span> hasil filter saat ini.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pengajuan akan masuk ke alur approval petugas sebelum serah terima.
              </p>
            </div>
          </div>
        </div>
      </div>

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
        <Select
          value={filters.category}
          onValueChange={(value) =>
            updateQuery((params) => {
              if (value === "all") params.delete("category")
              else params.set("category", value)
              params.delete("page")
            })
          }
        >
          <SelectTrigger className="w-full sm:w-52 bg-card">
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 rounded-xl border border-border/50 bg-card/70 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Arti Status
          </p>
          <p className="mt-1 text-sm text-foreground">
            <span className="font-medium">Tersedia</span> berarti ada unit yang bisa diajukan sekarang.
          </p>
          <p className="mt-1 text-sm text-foreground">
            <span className="font-medium">Tidak tersedia</span> berarti semua unit sedang dipakai / belum siap.
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Setelah Klik Pinjam
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Anda akan diarahkan ke form pengajuan. Pengajuan perlu approval petugas sebelum alat diserahkan.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/70 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-muted-foreground">
            Menampilkan <span className="font-medium text-foreground">{pagination.showingFrom}</span>
            {" - "}
            <span className="font-medium text-foreground">{pagination.showingTo}</span> dari{" "}
            <span className="font-medium text-foreground">{pagination.totalItems}</span> model alat
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Data katalog sekarang sudah dibatasi per halaman agar tetap ringan saat data banyak.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          {filters.category === "all" ? "Semua kategori" : `Kategori: ${filters.category}`}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.map((tool) => {
          const isAvailable = tool.available > 0
          return (
            <Card
              key={tool.id}
              className="group border-border/50 bg-card shadow-sm transition-all hover:shadow-md"
            >
              <CardContent className="flex flex-col gap-4 p-0">
                <div className="flex h-40 items-center justify-center rounded-t-xl bg-muted">
                  <Wrench className="size-12 text-muted-foreground/30" />
                </div>
                <div className="flex flex-col gap-3 px-5 pb-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="leading-tight text-sm font-semibold text-card-foreground">
                        {tool.name}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">{tool.lab}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {tool.category}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`size-2 rounded-full ${isAvailable ? "bg-success" : "bg-destructive"}`}
                      />
                      <span
                        className={`text-xs font-medium ${isAvailable ? "text-success-foreground" : "text-destructive"}`}
                      >
                        {isAvailable ? `${tool.available} tersedia` : "Tidak tersedia"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {tool.available}/{tool.total} unit
                    </span>
                  </div>

                  {isAvailable ? (
                    <Button className="w-full" asChild>
                      <Link
                        href={`/dashboard/borrowing?openCreate=1&labId=${encodeURIComponent(tool.labId)}&toolModelCode=${encodeURIComponent(tool.id)}`}
                        className="flex items-center justify-center gap-2"
                      >
                        Pinjam Sekarang
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  ) : (
                    <Button className="w-full" disabled variant="secondary">
                      Tidak Tersedia
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Halaman <span className="font-medium text-foreground">{pagination.page}</span> dari{" "}
            <span className="font-medium text-foreground">{pagination.totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1 || isPending}
              onClick={() =>
                updateQuery((params) => {
                  const nextPage = Math.max(1, pagination.page - 1)
                  if (nextPage <= 1) params.delete("page")
                  else params.set("page", String(nextPage))
                })
              }
            >
              <ArrowLeft className="size-4" />
              Sebelumnya
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages || isPending}
              onClick={() =>
                updateQuery((params) => {
                  params.set("page", String(pagination.page + 1))
                })
              }
            >
              Berikutnya
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {pagination.totalItems === 0 && (
        <Empty className="border border-border/50 bg-muted/20 py-10">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Wrench className="size-5" />
            </EmptyMedia>
            <EmptyTitle className="text-base">Alat tidak ditemukan</EmptyTitle>
            <EmptyDescription>
              Coba ubah kata kunci atau reset kategori. Pastikan ejaan nama alat sesuai saat mencari.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
              Reset Filter
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </div>
  )
}
