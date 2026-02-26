"use client"

export function BorrowingProofPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-muted/40"
    >
      Cetak
    </button>
  )
}
