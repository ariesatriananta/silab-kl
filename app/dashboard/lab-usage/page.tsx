import { labSchedules, usageHistory } from "@/lib/mock-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarDays, Clock, Users, GraduationCap } from "lucide-react"

export default function LabUsagePage() {
  return (
    <div className="flex flex-col gap-6 p-4 lg:p-6">
      <Tabs defaultValue="schedule" className="flex flex-col gap-4">
        <TabsList className="w-fit">
          <TabsTrigger value="schedule">Jadwal Lab</TabsTrigger>
          <TabsTrigger value="history">Riwayat</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="mt-0">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {labSchedules.map((schedule) => {
              const isFull = schedule.enrolled >= schedule.capacity
              return (
                <Card key={schedule.id} className="border-border/50 bg-card shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="flex flex-col gap-4 p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-1">
                        <h3 className="text-sm font-semibold text-card-foreground">{schedule.course}</h3>
                        <p className="text-xs text-muted-foreground">{schedule.lab}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={isFull
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : "bg-success/10 text-success-foreground border-success/20"
                        }
                      >
                        {isFull ? "Penuh" : "Tersedia"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="size-4 shrink-0" />
                        <span>{schedule.date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="size-4 shrink-0" />
                        <span>{schedule.time}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <GraduationCap className="size-4 shrink-0" />
                        <span>{schedule.group}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="size-4 shrink-0" />
                        <span>{schedule.enrolled}/{schedule.capacity} mhs</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                      <span className="text-xs text-muted-foreground">Dosen Pengampu</span>
                      <span className="text-xs font-medium text-foreground">{schedule.instructor}</span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-0">
          <Card className="border-border/50 bg-card shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-card-foreground">Riwayat Penggunaan Lab</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold">ID</TableHead>
                      <TableHead className="font-semibold">Laboratorium</TableHead>
                      <TableHead className="font-semibold">Tanggal</TableHead>
                      <TableHead className="font-semibold">Mata Kuliah</TableHead>
                      <TableHead className="font-semibold">Kelompok</TableHead>
                      <TableHead className="font-semibold">Jumlah Mhs</TableHead>
                      <TableHead className="font-semibold">Durasi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {usageHistory.map((usage) => (
                      <TableRow key={usage.id} className="hover:bg-muted/30">
                        <TableCell className="font-mono text-xs text-muted-foreground">{usage.id}</TableCell>
                        <TableCell className="font-medium text-foreground">{usage.lab}</TableCell>
                        <TableCell className="text-muted-foreground">{usage.date}</TableCell>
                        <TableCell className="text-muted-foreground">{usage.course}</TableCell>
                        <TableCell className="text-muted-foreground">{usage.group}</TableCell>
                        <TableCell className="text-muted-foreground">{usage.students}</TableCell>
                        <TableCell className="text-muted-foreground">{usage.duration}</TableCell>
                      </TableRow>
                    ))}
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
