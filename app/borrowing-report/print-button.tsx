"use client"

import { useEffect } from "react"

export function BorrowingReportAutoPrint() {
  useEffect(() => {
    const timer = window.setTimeout(() => window.print(), 250)
    return () => window.clearTimeout(timer)
  }, [])

  return null
}

export function BorrowingReportPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted/40"
    >
      Cetak / Simpan PDF
    </button>
  )
}
