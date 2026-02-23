"use client"

import { consumables, materialRequests } from "@/lib/mock-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, Package, TrendingDown } from "lucide-react"

const requestStatusConfig = {
  pending: { label: "Menunggu", className: "bg-warning/10 text-warning-foreground border-warning/20" },
  approved: { label: "Disetujui", className: "bg-primary/10 text-primary border-primary/20" },
  fulfilled: { label: "Terpenuhi", className: "bg-success/10 text-success-foreground border-success/20" },
}

export default function ConsumablesPage() {
  const lowStockItems = consumables.filter((c) => c.stock <= c.minStock)

  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      {/* Low Stock Alert */}
      {lowStockItems.length > 0 && (
        <Card className="border-warning/20 bg-warning/5 shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="size-5 shrink-0 text-warning-foreground" />
            <div>
              <p className="text-sm font-medium text-foreground">Peringatan Stok Rendah</p>
              <p className="text-xs text-muted-foreground">
                {lowStockItems.length} bahan di bawah stok minimum: {lowStockItems.map(i => i.name).join(", ")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="stock" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="stock">Stok Bahan</TabsTrigger>
          <TabsTrigger value="requests">Permintaan</TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="flex flex-col gap-4 mt-0">
          {/* Stock Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {consumables.map((item) => {
              const isLow = item.stock <= item.minStock
              const stockPercentage = Math.min((item.stock / (item.minStock * 3)) * 100, 100)
              return (
                <Card key={item.id} className={`border-border/50 bg-card shadow-sm ${isLow ? "border-warning/30" : ""}`}>
                  <CardContent className="flex flex-col gap-3 p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`flex size-9 items-center justify-center rounded-lg ${isLow ? "bg-warning/10" : "bg-secondary"}`}>
                          {isLow ? <TrendingDown className="size-4 text-warning-foreground" /> : <Package className="size-4 text-muted-foreground" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-card-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.category}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Stok: {item.stock} {item.unit}</span>
                        <span className="text-muted-foreground">Min: {item.minStock}</span>
                      </div>
                      <Progress
                        value={stockPercentage}
                        className={`h-2 ${isLow ? "[&>div]:bg-warning" : ""}`}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Terakhir restock: {item.lastRestocked}
                    </p>
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
                      <TableHead className="font-semibold">Item</TableHead>
                      <TableHead className="font-semibold">Tanggal</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialRequests.map((req) => {
                      const status = requestStatusConfig[req.status]
                      return (
                        <TableRow key={req.id} className="hover:bg-muted/30">
                          <TableCell className="font-mono text-xs text-muted-foreground">{req.id}</TableCell>
                          <TableCell className="font-medium text-foreground">{req.requestor}</TableCell>
                          <TableCell className="text-muted-foreground">{req.items}</TableCell>
                          <TableCell className="text-muted-foreground">{req.date}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={status.className}>
                              {status.label}
                            </Badge>
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
    </div>
  )
}
