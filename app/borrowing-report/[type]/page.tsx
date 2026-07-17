import Link from "next/link"
import { notFound, redirect } from "next/navigation"

import { getServerAuthSession } from "@/lib/auth/server"
import { getBorrowingReportData, getBorrowingReportFilters } from "@/lib/reports/borrowing-report"
import { BorrowingReportAutoPrint, BorrowingReportPrintButton } from "../print-button"

function fmtDateTime(value: Date | null) {
  if (!value) return "-"
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(value)
}

export default async function BorrowingReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ type }, rawSearchParams] = await Promise.all([params, searchParams])
  if (type !== "peminjaman" && type !== "penggunaan-bahan") notFound()

  const session = await getServerAuthSession()
  if (!session?.user?.id || (session.user.role !== "admin" && session.user.role !== "petugas_plp")) {
    redirect("/dashboard/borrowing")
  }

  const report = await getBorrowingReportData({
    role: session.user.role,
    userId: session.user.id,
    filters: getBorrowingReportFilters(rawSearchParams),
  })
  const isLoans = type === "peminjaman"
  const title = isLoans ? "Rekap Peminjaman Alat" : "Rekap Penggunaan Bahan"
  const total = isLoans ? report.loans.length : report.consumableUsage.length

  return (
    <main className="min-h-screen bg-muted/20 text-black print:bg-white">
      <BorrowingReportAutoPrint />
      <div className="mx-auto max-w-7xl p-4 sm:p-6 print:max-w-none print:p-0">
        <div className="mb-4 flex items-center justify-between rounded-xl border border-border/60 bg-background px-4 py-3 shadow-sm print:hidden">
          <Link href="/dashboard/borrowing" className="text-sm font-medium text-foreground underline-offset-4 hover:underline">
            Kembali ke Peminjaman
          </Link>
          <BorrowingReportPrintButton />
        </div>

        <section className="bg-white p-6 shadow-sm print:p-0 print:shadow-none">
          <header className="border-b-2 border-black pb-3">
            <h1 className="text-center text-lg font-bold uppercase">{title}</h1>
            <p className="mt-1 text-center text-sm">SILAB-KL — Jurusan Kesehatan Lingkungan</p>
            <div className="mt-3 flex justify-between text-xs">
              <span>Periode rencana pakai/kembali: {report.periodLabel}</span>
              <span>Total baris: {total}</span>
            </div>
          </header>

          {isLoans ? (
            <table className="mt-4 w-full border-collapse text-[10px]">
              <thead>
                <tr>
                  {[
                    "No",
                    "Kode",
                    "Lab",
                    "Mahasiswa",
                    "Prodi / Mata Kuliah",
                    "Rencana Pakai",
                    "Rencana Kembali",
                    "Alat / Kode Aset",
                    "Status",
                  ].map((label) => (
                    <th key={label} className="border border-black px-2 py-1 text-left">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.loans.length === 0 ? (
                  <tr><td colSpan={9} className="border border-black px-2 py-3 text-center">Tidak ada data peminjaman.</td></tr>
                ) : report.loans.map((row, index) => (
                  <tr key={`${row.code}-${row.assetCode}`}>
                    <td className="border border-black px-2 py-1 text-center">{index + 1}</td>
                    <td className="border border-black px-2 py-1">{row.code}</td>
                    <td className="border border-black px-2 py-1">{row.labName}</td>
                    <td className="border border-black px-2 py-1">{row.borrower}<br />{row.nim ?? "-"}</td>
                    <td className="border border-black px-2 py-1">{row.studyProgram}<br />{row.courseName}</td>
                    <td className="border border-black px-2 py-1">{fmtDateTime(row.plannedBorrowAt)}</td>
                    <td className="border border-black px-2 py-1">{fmtDateTime(row.plannedReturnAt)}</td>
                    <td className="border border-black px-2 py-1">{row.toolName}<br />{row.assetCode}</td>
                    <td className="border border-black px-2 py-1">{row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="mt-4 w-full border-collapse text-[10px]">
              <thead>
                <tr>
                  {[
                    "No",
                    "Kode",
                    "Lab",
                    "Mahasiswa",
                    "Prodi / Mata Kuliah",
                    "Rencana Pakai",
                    "Rencana Kembali",
                    "Bahan",
                    "Jumlah",
                  ].map((label) => (
                    <th key={label} className="border border-black px-2 py-1 text-left">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.consumableUsage.length === 0 ? (
                  <tr><td colSpan={9} className="border border-black px-2 py-3 text-center">Tidak ada data penggunaan bahan.</td></tr>
                ) : report.consumableUsage.map((row, index) => (
                  <tr key={`${row.code}-${row.consumableCode}-${index}`}>
                    <td className="border border-black px-2 py-1 text-center">{index + 1}</td>
                    <td className="border border-black px-2 py-1">{row.code}</td>
                    <td className="border border-black px-2 py-1">{row.labName}</td>
                    <td className="border border-black px-2 py-1">{row.borrower}<br />{row.nim ?? "-"}</td>
                    <td className="border border-black px-2 py-1">{row.studyProgram}<br />{row.courseName}</td>
                    <td className="border border-black px-2 py-1">{fmtDateTime(row.plannedBorrowAt)}</td>
                    <td className="border border-black px-2 py-1">{fmtDateTime(row.plannedReturnAt)}</td>
                    <td className="border border-black px-2 py-1">{row.consumableName}<br />{row.consumableCode}</td>
                    <td className="border border-black px-2 py-1 text-center">{row.qtyIssued} {row.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-4 text-right text-[10px]">Dicetak: {fmtDateTime(report.generatedAt)}</p>
        </section>
      </div>
    </main>
  )
}
