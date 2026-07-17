import { NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { getServerAuthSession } from "@/lib/auth/server"
import { getLabUsageReportData, getLabUsageReportFilters } from "@/lib/reports/lab-usage-report"
export const dynamic = "force-dynamic"
const fmt = (v: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(v)
export async function GET(request: Request) {
  const session = await getServerAuthSession()
  if (!session?.user?.id || (session.user.role !== "admin" && session.user.role !== "petugas_plp")) return NextResponse.json({ message: "Akses ditolak." }, { status: 403 })
  const report = await getLabUsageReportData({ role: session.user.role, userId: session.user.id, filters: getLabUsageReportFilters(Object.fromEntries(new URL(request.url).searchParams.entries())) })
  const usageById = new Map(report.usage.map((x) => [x.id, x]))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.usage.map((x, i) => ({ No: i + 1, Laboratorium: x.labName, "Mata Kuliah/Kegiatan": x.courseName, Kelompok: x.groupName, Peserta: x.studentCount, Mulai: fmt(x.startedAt), Selesai: fmt(x.endedAt), Catatan: x.note ?? "-" }))), "Penggunaan Ruangan")
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(report.attendance.map((x, i) => { const u = usageById.get(x.usageLogId); return { No: i + 1, Laboratorium: u?.labName ?? "-", "Mata Kuliah/Kegiatan": u?.courseName ?? "-", Kelompok: u?.groupName ?? "-", Mulai: u ? fmt(u.startedAt) : "-", Selesai: u ? fmt(u.endedAt) : "-", NIM: x.attendeeNim ?? "-", Nama: x.attendeeName } })), "Presensi")
  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
  return new NextResponse(bytes, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=rekap-penggunaan-ruangan-dan-presensi.xlsx" } })
}
