import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import JSZip from "jszip"
import { NextResponse } from "next/server"
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib"

import { getServerAuthSession } from "@/lib/auth/server"
import {
  BORROWING_PROOF_BULK_LIMIT,
  getConsumableRequestProofBulkData,
  type ConsumableRequestProofBulkTransaction,
} from "@/lib/reports/borrowing-proof-bulk"
import { getBorrowingReportFilters, type ReportRole } from "@/lib/reports/borrowing-report"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function fmtDate(date: Date | null) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(date)
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
  return value.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
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

function drawTextRow(
  page: PDFPage,
  x: number,
  y: number,
  label: string,
  value: string,
  fonts: { regular: PDFFont; bold: PDFFont },
  labelWidth = 82,
) {
  drawText(page, label, x, y, { font: fonts.bold, size: 8, maxWidth: labelWidth })
  drawText(page, ":", x + labelWidth, y, { font: fonts.regular, size: 8 })
  drawText(page, value || "-", x + labelWidth + 10, y, { font: fonts.regular, size: 8, maxWidth: 160 })
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

async function renderConsumableRequestPdf(row: ConsumableRequestProofBulkTransaction) {
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
      const scaled = logo.scaleToFit(180, 50)
      page.drawImage(logo, { x: margin, y: pt(page, 30 + scaled.height), width: scaled.width, height: scaled.height })
    }
    drawText(page, "Laboratorium", 374, 38, { font: bold, size: 9, maxWidth: 170, align: "right" })
    drawText(page, "Jurusan Kesehatan Lingkungan Surabaya", 314, 53, {
      font: bold,
      size: 9,
      maxWidth: 230,
      align: "right",
    })
    drawLine(page, margin, 88, pageSize[0] - margin, 88)
    drawText(page, "PERMINTAAN BAHAN HABIS PAKAI", margin, 112, {
      font: bold,
      size: 12,
      maxWidth: contentWidth,
      align: "center",
    })
    drawText(page, `Kode Transaksi: ${row.code}`, margin, 130, {
      font: regular,
      size: 8,
      maxWidth: contentWidth,
      align: "center",
    })
    return page
  }

  const drawInfoBox = (page: PDFPage) => {
    drawRect(page, margin, 154, contentWidth, 64)
    drawTextRow(page, margin + 14, 169, "Mata Kuliah", row.courseName, fonts, 86)
    drawTextRow(page, margin + 14, 187, "Materi", row.materialTopic, fonts, 86)
    drawTextRow(page, margin + 14, 205, "Prodi", row.studyProgram, fonts, 86)
    drawTextRow(page, 326, 169, "Semester", row.semesterLabel, fonts, 62)
    drawTextRow(page, 326, 187, "Kelompok", row.groupName, fonts, 62)
    drawTextRow(page, 326, 205, "Lab", row.labName, fonts, 62)
  }

  const tableX = margin
  const widths = [34, 354, 138]
  const rowHeight = 20
  const drawTableHeader = (page: PDFPage, y: number) => {
    let x = tableX
    drawCell(page, "No", x, y, widths[0]!, 28, bold, { align: "center", size: 7 }); x += widths[0]!
    drawCell(page, "Nama Bahan", x, y, widths[1]!, 28, bold, { align: "center", size: 7 }); x += widths[1]!
    drawCell(page, "PENGGUNAAN QTY (gr / ml)", x, y, widths[2]!, 28, bold, { align: "center", size: 7 })
    return y + 28
  }

  const rows = row.items.length > 14 ? row.items : [...row.items, ...Array.from({ length: 14 - row.items.length }, (_, index) => ({
    id: `blank-${index}`,
    consumableName: "",
    consumableUnit: "",
    qty: 0,
  }))]

  let page = addPage()
  drawInfoBox(page)
  let y = drawTableHeader(page, 242)

  for (const [index, item] of rows.entries()) {
    if (y + rowHeight > 704) {
      page = addPage()
      y = drawTableHeader(page, 150)
    }
    let x = tableX
    drawCell(page, item.consumableName ? String(index + 1) : "", x, y, widths[0]!, rowHeight, regular, { align: "center", size: 7 }); x += widths[0]!
    drawCell(page, item.consumableName, x, y, widths[1]!, rowHeight, regular, { size: 7 }); x += widths[1]!
    drawCell(page, item.consumableName ? `${item.qty} ${item.consumableUnit ?? ""}` : "", x, y, widths[2]!, rowHeight, regular, {
      align: "center",
      size: 7,
    })
    y += rowHeight
  }

  if (y + 120 > 800) {
    page = addPage()
    y = 150
  }

  const signatureY = Math.max(y + 50, 650)
  drawText(page, `Surabaya, ${fmtDate(row.requestedAt)}`, 390, signatureY, { font: regular, size: 9, maxWidth: 150 })
  drawText(page, "Yang Menggunakan,", 390, signatureY + 20, { font: regular, size: 9, maxWidth: 150, align: "center" })
  drawLine(page, 390, signatureY + 92, 540, signatureY + 92)
  drawText(page, row.requesterName, 390, signatureY + 108, { font: bold, size: 9, maxWidth: 150, align: "center" })

  return Buffer.from(await pdfDoc.save())
}

function zipFilename() {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, "0")
  return `lembar-permintaan-bahan-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.zip`
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
    const result = await getConsumableRequestProofBulkData({
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
      return NextResponse.json({ message: "Tidak ada transaksi penggunaan bahan sesuai filter aktif." }, { status: 404 })
    }

    const zip = new JSZip()
    for (const row of result.rows) {
      const pdf = await renderConsumableRequestPdf(row)
      zip.file(`${filenameDate(row.requestedAt)}-${sanitizeFilename(row.code)}-permintaan-bahan-habis-pakai.pdf`, pdf)
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
    console.error("consumable request proofs zip export error:", error)
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? `Gagal membuat ZIP lembar permintaan bahan habis pakai: ${error.message}`
            : "Gagal membuat ZIP lembar permintaan bahan habis pakai.",
      },
      { status: 500 },
    )
  }
}
