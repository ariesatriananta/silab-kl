import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import JSZip from "jszip"
import { NextResponse } from "next/server"
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"

import { getServerAuthSession } from "@/lib/auth/server"
import {
  getLabUsageProofBulkData,
  getLabUsageReportFilters,
  LAB_USAGE_PROOF_BULK_LIMIT,
  type LabUsageProofBulkRow,
} from "@/lib/reports/lab-usage-report"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function fmtDate(date: Date | null) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(date)
}

function fmtTime(date: Date | null) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
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

function sanitizeFilename(value: string) {
  return value.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase()
}

function pdfText(value: string | null | undefined) {
  return (value || "-")
    .normalize("NFKD")
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

function truncateToWidth(text: string, font: PDFFont, size: number, maxWidth: number) {
  const safe = pdfText(text)
  if (font.widthOfTextAtSize(safe, size) <= maxWidth) return safe
  let output = safe
  while (output.length > 0 && font.widthOfTextAtSize(`${output}...`, size) > maxWidth) {
    output = output.slice(0, -1)
  }
  return `${output}...`
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

function drawLine(page: PDFPage, x1: number, y1Top: number, x2: number, y2Top: number) {
  page.drawLine({
    start: { x: x1, y: pt(page, y1Top) },
    end: { x: x2, y: pt(page, y2Top) },
    thickness: 1,
    color: rgb(0, 0, 0),
  })
}

function drawRect(page: PDFPage, x: number, yTop: number, width: number, height: number) {
  page.drawRectangle({ x, y: pt(page, yTop + height), width, height, borderColor: rgb(0, 0, 0), borderWidth: 1 })
}

function drawCell(
  page: PDFPage,
  text: string,
  x: number,
  yTop: number,
  width: number,
  height: number,
  font: PDFFont,
  options?: { size?: number; align?: "left" | "center" | "right" },
) {
  const size = options?.size ?? 7
  drawRect(page, x, yTop, width, height)
  drawText(page, text, x + 4, yTop + height / 2 + size / 2 - 2, {
    font,
    size,
    maxWidth: width - 8,
    align: options?.align ?? "left",
  })
}

function drawTextRow(page: PDFPage, x: number, y: number, label: string, value: string, fonts: { regular: PDFFont; bold: PDFFont }, labelWidth = 92) {
  drawText(page, label, x, y, { font: fonts.regular, size: 8, maxWidth: labelWidth })
  drawText(page, ":", x + labelWidth, y, { font: fonts.regular, size: 8 })
  drawText(page, value, x + labelWidth + 10, y, { font: fonts.regular, size: 8, maxWidth: 160 })
}

async function renderLabUsageProofPdf(row: LabUsageProofBulkRow) {
  const pdfDoc = await PDFDocument.create()
  const pageSize: [number, number] = [595.28, 841.89]
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fonts = { regular, bold }
  const margin = 34
  const contentWidth = pageSize[0] - margin * 2
  const logoPath = path.join(process.cwd(), "public", "logo.png")
  const logo = existsSync(logoPath) ? await pdfDoc.embedPng(readFileSync(logoPath)) : null

  const addPage = () => {
    const page = pdfDoc.addPage(pageSize)
    if (logo) {
      const scaled = logo.scaleToFit(170, 48)
      page.drawImage(logo, { x: margin, y: pt(page, 28 + scaled.height), width: scaled.width, height: scaled.height })
    }
    drawText(page, "LABORATORIUM", 360, 36, { font: bold, size: 10, maxWidth: 200, align: "right" })
    drawText(page, "JURUSAN KESEHATAN LINGKUNGAN", 360, 52, { font: bold, size: 10, maxWidth: 200, align: "right" })
    drawText(page, "Jl. Raya Menur 118 A Surabaya", 360, 70, { font: regular, size: 8, maxWidth: 200, align: "right" })
    drawLine(page, margin, 96, pageSize[0] - margin, 96)
    drawText(page, "DAFTAR PENGGUNAAN RUANG LABORATORIUM", margin, 118, {
      font: bold,
      size: 11,
      maxWidth: contentWidth,
      align: "center",
    })
    return page
  }

  const drawInfoBox = (page: PDFPage) => {
    drawRect(page, margin, 140, contentWidth, 88)
    drawTextRow(page, margin + 14, 155, "Hari / Tanggal", fmtDate(row.startedAt), fonts, 94)
    drawTextRow(page, margin + 14, 172, "Waktu", `${fmtTime(row.startedAt)} - ${fmtTime(row.endedAt)}`, fonts, 94)
    drawTextRow(page, margin + 14, 189, "Mata Kuliah", row.courseName, fonts, 94)
    drawTextRow(page, margin + 14, 206, "Ruang Lab", row.labName, fonts, 94)
    drawTextRow(page, 322, 155, "Materi", row.materialTopic ?? "-", fonts, 78)
    drawTextRow(page, 322, 172, "Kelompok", row.groupName, fonts, 78)
    drawTextRow(page, 322, 189, "Prodi", row.studyProgram ?? "-", fonts, 78)
    drawTextRow(page, 322, 206, "Semester - Kelas", row.semesterClassLabel ?? "-", fonts, 78)
    drawTextRow(page, 322, 223, "Pembimbing", row.advisorLecturerName ?? "-", fonts, 78)
  }

  const tableX = margin
  const widths = [28, 250, 172, 76]
  const rowHeight = 19
  const drawTableHeader = (page: PDFPage, y: number) => {
    let x = tableX
    drawCell(page, "No.", x, y, widths[0]!, 24, bold, { align: "center", size: 7 }); x += widths[0]!
    drawCell(page, "Nama Mahasiswa", x, y, widths[1]!, 24, bold, { align: "center", size: 7 }); x += widths[1]!
    drawCell(page, "Tanda Tangan", x, y, widths[2]!, 24, bold, { align: "center", size: 7 }); x += widths[2]!
    drawCell(page, "Ket", x, y, widths[3]!, 24, bold, { align: "center", size: 7 })
    return y + 24
  }

  const minRows = Math.max(20, row.attendance.length || row.studentCount)
  const rows = Array.from({ length: minRows }, (_, index) => row.attendance[index] ?? null)
  let page = addPage()
  drawInfoBox(page)
  let y = drawTableHeader(page, 250)

  for (const [index, attendee] of rows.entries()) {
    if (y + rowHeight > 690) {
      page = addPage()
      y = drawTableHeader(page, 142)
    }
    const signNumber = index + 1
    const isOdd = signNumber % 2 === 1
    let x = tableX
    drawCell(page, String(signNumber), x, y, widths[0]!, rowHeight, regular, { align: "center", size: 7 }); x += widths[0]!
    drawCell(page, attendee?.attendeeName ?? "", x, y, widths[1]!, rowHeight, regular, { size: 7 }); x += widths[1]!
    drawRect(page, x, y, widths[2]!, rowHeight)
    drawLine(page, x + widths[2]! / 2, y, x + widths[2]! / 2, y + rowHeight)
    drawText(page, String(signNumber), isOdd ? x + 8 : x + widths[2]! / 2 + 8, y + 12, { font: regular, size: 7, maxWidth: widths[2]! / 2 - 12 })
    x += widths[2]!
    drawCell(page, "", x, y, widths[3]!, rowHeight, regular, { size: 7 })
    y += rowHeight
  }

  if (y + 130 > 800) {
    page = addPage()
    y = 150
  }

  const signatureY = Math.max(y + 38, 650)
  drawText(page, "Mengetahui,", margin, signatureY, { font: regular, size: 9, maxWidth: 220, align: "center" })
  drawText(page, "Koordinator Lab & Workshop", margin, signatureY + 14, { font: regular, size: 9, maxWidth: 220, align: "center" })
  drawLine(page, margin + 24, signatureY + 86, margin + 196, signatureY + 86)
  drawText(page, row.approverName ?? "-", margin, signatureY + 102, { font: bold, size: 9, maxWidth: 220, align: "center" })
  drawText(page, row.approverNip ? `NIP. ${row.approverNip}` : "", margin, signatureY + 116, {
    font: regular,
    size: 8,
    maxWidth: 220,
    align: "center",
  })

  drawText(page, "Pembimbing", 342, signatureY, { font: regular, size: 9, maxWidth: 220, align: "center" })
  drawLine(page, 366, signatureY + 86, 538, signatureY + 86)
  drawText(page, row.advisorLecturerName ?? "-", 342, signatureY + 102, { font: bold, size: 9, maxWidth: 220, align: "center" })

  return Buffer.from(await pdfDoc.save())
}

function zipFilename() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, "0")
  return `dokumen-penggunaan-ruang-lab-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.zip`
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
    const filters = getLabUsageReportFilters(params)
    const result = await getLabUsageProofBulkData({
      role: session.user.role,
      userId: session.user.id,
      filters,
    })

    if (result.truncated) {
      return NextResponse.json(
        {
          message: `Data terlalu banyak. Maksimal ${LAB_USAGE_PROOF_BULK_LIMIT} dokumen per ZIP. Persempit filter periode/lab terlebih dahulu.`,
        },
        { status: 413 },
      )
    }
    if (result.rows.length === 0) {
      return NextResponse.json({ message: "Tidak ada dokumen penggunaan ruang sesuai filter aktif." }, { status: 404 })
    }

    const zip = new JSZip()
    for (const row of result.rows) {
      const pdf = await renderLabUsageProofPdf(row)
      zip.file(
        `${filenameDate(row.startedAt)}-${sanitizeFilename(row.labName)}-${sanitizeFilename(row.usageId.slice(0, 8))}-dokumen-penggunaan-ruang-lab.pdf`,
        pdf,
      )
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
    console.error("lab usage proofs zip export error:", error)
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? `Gagal membuat ZIP dokumen penggunaan ruang lab: ${error.message}`
            : "Gagal membuat ZIP dokumen penggunaan ruang lab.",
      },
      { status: 500 },
    )
  }
}
