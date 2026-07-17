import { NextResponse } from "next/server"
import * as XLSX from "xlsx"

import { getServerAuthSession } from "@/lib/auth/server"
import { getBorrowingReportData, getBorrowingReportFilters } from "@/lib/reports/borrowing-report"

export const dynamic = "force-dynamic"

function fmtDateTime(value: Date | null) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value)
}

export async function GET(request: Request) {
  const session = await getServerAuthSession()
  if (!session?.user?.id || (session.user.role !== "admin" && session.user.role !== "petugas_plp")) {
    return NextResponse.json({ message: "Akses ditolak." }, { status: 403 })
  }

  const params = Object.fromEntries(new URL(request.url).searchParams.entries())
  const report = await getBorrowingReportData({
    role: session.user.role,
    userId: session.user.id,
    filters: getBorrowingReportFilters(params),
  })

  const workbook = XLSX.utils.book_new()
  const loanSheet = XLSX.utils.json_to_sheet(
    report.loans.map((row, index) => ({
      No: index + 1,
      "Kode Peminjaman": row.code,
      Laboratorium: row.labName,
      Mahasiswa: row.borrower,
      NIM: row.nim ?? "-",
      Prodi: row.studyProgram,
      "Mata Kuliah": row.courseName,
      Materi: row.materialTopic,
      Semester: row.semesterLabel,
      Kelompok: row.groupName,
      Dosen: row.advisorLecturerName ?? "-",
      Keperluan: row.purpose,
      Status: row.status,
      "Rencana Pakai": fmtDateTime(row.plannedBorrowAt),
      "Rencana Kembali": fmtDateTime(row.plannedReturnAt),
      "Nama Alat": row.toolName,
      "Kode Aset": row.assetCode,
    })),
  )
  const usageSheet = XLSX.utils.json_to_sheet(
    report.consumableUsage.map((row, index) => ({
      No: index + 1,
      "Kode Peminjaman": row.code,
      Laboratorium: row.labName,
      Mahasiswa: row.borrower,
      NIM: row.nim ?? "-",
      Prodi: row.studyProgram,
      "Mata Kuliah": row.courseName,
      Materi: row.materialTopic,
      Semester: row.semesterLabel,
      Kelompok: row.groupName,
      Keperluan: row.purpose,
      Status: row.status,
      "Rencana Pakai": fmtDateTime(row.plannedBorrowAt),
      "Rencana Kembali": fmtDateTime(row.plannedReturnAt),
      "Tanggal Serah Terima": fmtDateTime(row.handedOverAt),
      "Kode Bahan": row.consumableCode,
      "Nama Bahan": row.consumableName,
      Jumlah: row.qtyIssued,
      Satuan: row.unit,
    })),
  )
  loanSheet["!cols"] = Array.from({ length: 17 }, () => ({ wch: 20 }))
  usageSheet["!cols"] = Array.from({ length: 19 }, () => ({ wch: 20 }))
  XLSX.utils.book_append_sheet(workbook, loanSheet, "Peminjaman")
  XLSX.utils.book_append_sheet(workbook, usageSheet, "Penggunaan Bahan")

  const bytes = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" })
  const filename = `rekap-peminjaman-dan-penggunaan-bahan-${new Date().toISOString().slice(0, 10)}.xlsx`
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
    },
  })
}
