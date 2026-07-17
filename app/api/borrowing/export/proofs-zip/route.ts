import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { NextResponse } from "next/server"
import JSZip from "jszip"
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"

import { getServerAuthSession } from "@/lib/auth/server"
import {
  BORROWING_PROOF_BULK_LIMIT,
  getBorrowingProofBulkData,
  getBulkBorrowAt,
  getBulkReturnAt,
  type BorrowingProofBulkApproval,
  type BorrowingProofBulkTransaction,
} from "@/lib/reports/borrowing-proof-bulk"
import { getBorrowingReportFilters, type ReportRole } from "@/lib/reports/borrowing-report"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function fmtDate(date: Date | null) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(date)
}

function fmtDateTime(date: Date | null) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date)
}

function filenameDate(date: Date | null) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "tanpa-tanggal"
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value ?? "0000"
  const month = parts.find((part) => part.type === "month")?.value ?? "00"
  const day = parts.find((part) => part.type === "day")?.value ?? "00"
  return `${year}-${month}-${day}`
}

function conditionLabel(value: "baik" | "maintenance" | "damaged" | null) {
  if (value === "baik") return "Baik"
  if (value === "maintenance") return "Maintenance"
  if (value === "damaged") return "Rusak"
  return "-"
}

function decisionLabel(decision: "approved" | "rejected" | null | undefined) {
  if (!decision) return "-"
  return decision === "approved" ? "Disetujui" : "Ditolak"
}

function sanitizeFilename(value: string) {
  return value.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
}

function pdfTextLegacy(value: string | null | undefined) {
  return (value || "-")
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (char) => "0123456789"["₀₁₂₃₄₅₆₇₈₉".indexOf(char)] ?? "")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (char) => "0123456789"["⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(char)] ?? "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[≤]/g, "<=")
    .replace(/[≥]/g, ">=")
    .replace(/[µ]/g, "u")
}

function pdfText(value: string | null | undefined) {
  return pdfTextLegacy(value)
    .normalize("NFKD")
    .replace(/[\u2080-\u2089]/g, (char) => String(char.charCodeAt(0) - 0x2080))
    .replace(/[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]/g, (char) => {
      const superscripts = "⁰¹²³⁴⁵⁶⁷⁸⁹"
      const index = superscripts.indexOf(char)
      return index >= 0 ? String(index) : ""
    })
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/µ/g, "u")
    .replace(/[\t\r\n]+/g, " ")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "")
}

function pt(page: PDFPage, yFromTop: number) {
  return page.getHeight() - yFromTop
}

function drawText(page: PDFPage, text: string, x: number, yFromTop: number, options: {
  font: PDFFont
  size?: number
  maxWidth?: number
  align?: "left" | "center" | "right"
}) {
  const size = options.size ?? 9
  const safe = options.maxWidth ? truncateToWidth(text, options.font, size, options.maxWidth) : pdfText(text)
  let drawX = x
  if (options.maxWidth && options.align && options.align !== "left") {
    const width = options.font.widthOfTextAtSize(safe, size)
    if (options.align === "center") drawX = x + Math.max(0, (options.maxWidth - width) / 2)
    if (options.align === "right") drawX = x + Math.max(0, options.maxWidth - width)
  }
  page.drawText(safe, { x: drawX, y: pt(page, yFromTop), size, font: options.font, color: rgb(0, 0, 0) })
}

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number) {
  const safe = pdfText(text)
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) return safe
  let output = safe
  while (output.length > 0 && font.widthOfTextAtSize(`${output}...`, size) > maxWidth) {
    output = output.slice(0, -1)
  }
  return `${output}...`
}

function drawLine(page: PDFPage, x1: number, y1Top: number, x2: number, y2Top: number) {
  page.drawLine({ start: { x: x1, y: pt(page, y1Top) }, end: { x: x2, y: pt(page, y2Top) }, thickness: 1, color: rgb(0, 0, 0) })
}

function drawRect(page: PDFPage, x: number, yTop: number, width: number, height: number) {
  page.drawRectangle({ x, y: pt(page, yTop + height), width, height, borderColor: rgb(0, 0, 0), borderWidth: 1 })
}

function drawTextRow(page: PDFPage, x: number, y: number, label: string, value: string, fonts: { regular: PDFFont; bold: PDFFont }, labelWidth = 92) {
  drawText(page, label, x, y, { font: fonts.bold, size: 9, maxWidth: labelWidth })
  drawText(page, ":", x + labelWidth, y, { font: fonts.regular, size: 9 })
  drawText(page, value || "-", x + labelWidth + 12, y, { font: fonts.regular, size: 9, maxWidth: 160 })
}

function drawCell(page: PDFPage, text: string, x: number, yTop: number, width: number, height: number, font: PDFFont, options?: { size?: number; align?: "left" | "center" | "right" }) {
  const size = options?.size ?? 7
  drawRect(page, x, yTop, width, height)
  const safe = truncateToWidth(text, font, size, width - 8)
  drawText(page, safe, x + 4, yTop + height / 2 + size / 2 - 2, { font, size, maxWidth: width - 8, align: options?.align ?? "left" })
}

function drawSignature(page: PDFPage, x: number, y: number, title1: string, title2: string, name: string, fonts: { regular: PDFFont; bold: PDFFont }, approval?: BorrowingProofBulkApproval) {
  const width = 160
  drawText(page, title1, x, y, { font: fonts.regular, size: 9, maxWidth: width, align: "center" })
  drawText(page, title2, x, y + 12, { font: fonts.regular, size: 9, maxWidth: width, align: "center" })
  drawText(page, decisionLabel(approval?.decision), x, y + 34, {
    font: approval?.decision === "approved" ? fonts.bold : fonts.regular,
    size: 8,
    maxWidth: width,
    align: "center",
  })
  drawText(page, fmtDateTime(approval?.decidedAt ?? null), x, y + 45, { font: fonts.regular, size: 8, maxWidth: width, align: "center" })
  drawText(page, approval?.note ? `(${approval.note})` : "", x, y + 56, { font: fonts.regular, size: 8, maxWidth: width, align: "center" })
  drawLine(page, x + 8, y + 88, x + width - 8, y + 88)
  drawText(page, name || "-", x, y + 101, { font: fonts.regular, size: 9, maxWidth: width, align: "center" })
}

async function renderBorrowingProofPdf(row: BorrowingProofBulkTransaction) {
  const pdfDoc = await PDFDocument.create()
  const pageSize: [number, number] = [595.28, 841.89]
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fonts = { regular, bold }
  const pageMargin = 28
  const contentWidth = pageSize[0] - pageMargin * 2
  const logoPath = path.join(process.cwd(), "public", "logo.png")
  const logo = existsSync(logoPath) ? await pdfDoc.embedPng(readFileSync(logoPath)) : null

  const addPage = () => {
    const page = pdfDoc.addPage(pageSize)
    if (logo) {
      const scaled = logo.scaleToFit(158, 44)
      page.drawImage(logo, { x: pageMargin, y: pt(page, 28 + scaled.height), width: scaled.width, height: scaled.height })
    }
    drawText(page, "Laboratorium", 370, 34, { font: bold, size: 9, maxWidth: 188, align: "right" })
    drawText(page, "Jurusan Kesehatan Lingkungan", 370, 48, { font: bold, size: 9, maxWidth: 188, align: "right" })
    drawText(page, "Jl. Raya Menur 118 A Surabaya", 370, 63, { font: regular, size: 7, maxWidth: 188, align: "right" })
    drawLine(page, pageMargin, 86, pageSize[0] - pageMargin, 86)
    drawText(page, "LEMBAR PEMINJAMAN ALAT LABORATORIUM", pageMargin, 106, {
      font: bold,
      size: 11,
      maxWidth: contentWidth,
      align: "center",
    })
    drawText(page, `Kode Transaksi: ${row.code}`, pageMargin, 123, {
      font: regular,
      size: 8,
      maxWidth: contentWidth,
      align: "center",
    })
    return page
  }

  const drawInfoBox = (page: PDFPage) => {
    drawRect(page, pageMargin, 140, contentWidth, 62)
    drawTextRow(page, pageMargin + 12, 154, "Mata Kuliah", row.courseName, fonts, 82)
    drawTextRow(page, pageMargin + 12, 171, "Prodi", row.studyProgram, fonts, 82)
    drawTextRow(page, pageMargin + 12, 188, "Semester - Kelas", row.semesterLabel, fonts, 82)
    drawTextRow(page, 318, 154, "Materi", row.materialTopic, fonts, 58)
    drawTextRow(page, 318, 171, "Keperluan", row.purpose, fonts, 58)
    drawTextRow(page, 318, 188, "Kelompok", row.groupName, fonts, 58)
  }

  const tableX = pageMargin
  const widths = [20, 154, 38, 70, 70, 46, 50, 60]
  const tableWidth = widths.reduce((total, width) => total + width, 0)
  const h1 = 17
  const h2 = 14
  const rowHeight = 15

  const drawTableHeader = (page: PDFPage, headerY: number) => {
    let x = tableX
    drawCell(page, "No", x, headerY, widths[0]!, h1 + h2, bold, { align: "center", size: 6.2 }); x += widths[0]!
    drawCell(page, "Nama Alat/Bahan", x, headerY, widths[1]!, h1 + h2, bold, { size: 6.2 }); x += widths[1]!
    drawCell(page, "Jml", x, headerY, widths[2]!, h1 + h2, bold, { align: "center", size: 6.2 }); x += widths[2]!
    drawCell(page, "Waktu", x, headerY, widths[3]! + widths[4]!, h1, bold, { align: "center", size: 6.2 })
    drawCell(page, "Mulai", x, headerY + h1, widths[3]!, h2, bold, { align: "center", size: 6.2 }); x += widths[3]!
    drawCell(page, "Selesai", x, headerY + h1, widths[4]!, h2, bold, { align: "center", size: 6.2 }); x += widths[4]!
    drawCell(page, "Kondisi", x, headerY, widths[5]! + widths[6]!, h1, bold, { align: "center", size: 6.2 })
    drawCell(page, "Pinjam", x, headerY + h1, widths[5]!, h2, bold, { align: "center", size: 6.2 }); x += widths[5]!
    drawCell(page, "Kembali", x, headerY + h1, widths[6]!, h2, bold, { align: "center", size: 6.2 }); x += widths[6]!
    drawCell(page, "Paraf", x, headerY, widths[7]!, h1 + h2, bold, { align: "center", size: 6.2 })
    return headerY + h1 + h2
  }

  const displayBorrowAt = getBulkBorrowAt({
    status: row.status,
    plannedBorrowAt: row.plannedBorrowAt,
    handedOverAt: row.handedOverAt,
  })
  const displayReturnAt = getBulkReturnAt({
    status: row.status,
    plannedReturnAt: row.plannedReturnAt,
    latestReturnedAt: row.latestReturnedAt,
  })

  const rows = row.items.length > 10 ? row.items : [...row.items, ...Array.from({ length: 10 - row.items.length }, (_, index) => ({
    id: `blank-${index}`,
    toolName: "",
    assetCode: "",
    qty: 0,
    returnCondition: null,
  }))]

  let page = addPage()
  drawInfoBox(page)
  let y = drawTableHeader(page, 222)
  const firstPageBottom = 675
  const nextPageBottom = 712

  for (const [index, item] of rows.entries()) {
    const bottom = pdfDoc.getPageCount() === 1 ? firstPageBottom : nextPageBottom
    if (y + rowHeight > bottom) {
      page = addPage()
      y = drawTableHeader(page, 144)
    }

    let x = tableX
    drawCell(page, item.toolName ? String(index + 1) : "", x, y, widths[0]!, rowHeight, regular, { align: "center", size: 5.8 }); x += widths[0]!
    drawCell(page, item.toolName, x, y, widths[1]!, rowHeight, regular, { size: 5.8 }); x += widths[1]!
    drawCell(page, item.toolName ? `${item.qty} unit` : "", x, y, widths[2]!, rowHeight, regular, { align: "center", size: 5.8 }); x += widths[2]!
    drawCell(page, item.toolName ? fmtDateTime(displayBorrowAt) : "", x, y, widths[3]!, rowHeight, regular, { align: "center", size: 5.2 }); x += widths[3]!
    drawCell(page, item.toolName ? fmtDateTime(displayReturnAt) : "", x, y, widths[4]!, rowHeight, regular, { align: "center", size: 5.2 }); x += widths[4]!
    drawCell(page, item.toolName ? "Baik" : "", x, y, widths[5]!, rowHeight, regular, { align: "center", size: 5.8 }); x += widths[5]!
    drawCell(page, item.toolName ? conditionLabel(item.returnCondition) : "", x, y, widths[6]!, rowHeight, regular, { align: "center", size: 5.8 }); x += widths[6]!
    drawCell(page, "", x, y, widths[7]!, rowHeight, regular, { align: "center", size: 5.8 })
    y += rowHeight
  }

  if (y + 118 > 800) {
    page = addPage()
    y = 144
  }

  drawText(
    page,
    "Ket: (*) diisi petugas lab. Kolom kondisi/paraf disediakan sebagai bukti serah-terima/pengembalian manual saat dibutuhkan.",
    tableX,
    y + 13,
    { font: regular, size: 6.5, maxWidth: tableWidth },
  )

  const signatureY = Math.max(y + 42, 670)
  drawText(page, `Surabaya, ${fmtDate(new Date())}`, 386, signatureY - 20, { font: bold, size: 8.5, maxWidth: 170, align: "center" })
  const dosenApproval = row.approvals.find((approval) => approval.approverRole === "dosen")
  const plpApproval = row.approvals.find((approval) => approval.approverRole === "petugas_plp")
  const plpApproverName =
    row.approvals.find((approval) => approval.decision === "approved" && approval.approverRole === "petugas_plp")
      ?.approverName ?? "-"
  drawSignature(page, 28, signatureY, "Mengetahui,", "Dosen Pembimbing", row.advisorLecturerName ?? "-", fonts, dosenApproval)
  drawSignature(page, 218, signatureY, "Menyetujui,", "Petugas PLP", plpApproverName, fonts, plpApproval)
  drawSignature(page, 407, signatureY, "Peminjam,", "Mahasiswa", row.requesterName, fonts)

  return Buffer.from(await pdfDoc.save())
}

function zipFilename() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, "0")
  return `lembar-peminjaman-alat-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.zip`
}

export async function GET(request: Request) {
  try {
    const session = await getServerAuthSession()
    if (!session?.user?.id || !session.user.role) {
      return NextResponse.json({ message: "Sesi tidak valid." }, { status: 401 })
    }
    if (session.user.role !== "admin" && session.user.role !== "petugas_plp") {
      return NextResponse.json({ message: "Akses export ditolak." }, { status: 403 })
    }

    const params = Object.fromEntries(new URL(request.url).searchParams.entries())
    const filters = getBorrowingReportFilters(params)
    const result = await getBorrowingProofBulkData({
      role: session.user.role as ReportRole,
      userId: session.user.id,
      filters,
    })

    if (result.truncated) {
      return NextResponse.json(
        {
          message: `Data terlalu banyak. Maksimal ${BORROWING_PROOF_BULK_LIMIT} lembar per ZIP. Persempit filter periode/status terlebih dahulu.`,
        },
        { status: 413 },
      )
    }
    if (result.rows.length === 0) {
      return NextResponse.json({ message: "Tidak ada transaksi peminjaman alat sesuai filter aktif." }, { status: 404 })
    }

    const zip = new JSZip()
    for (const row of result.rows) {
      const pdf = await renderBorrowingProofPdf(row)
      const documentDate = getBulkBorrowAt({
        status: row.status,
        plannedBorrowAt: row.plannedBorrowAt,
        handedOverAt: row.handedOverAt,
      })
      zip.file(`${filenameDate(documentDate)}-${sanitizeFilename(row.code)}-lembar-peminjaman-alat.pdf`, pdf)
    }

    const body = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    })

    return new Response(body, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipFilename()}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("borrowing proofs zip export error:", error)
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? `Gagal membuat ZIP lembar peminjaman alat: ${error.message}`
            : "Gagal membuat ZIP lembar peminjaman alat.",
      },
      { status: 500 },
    )
  }
}
