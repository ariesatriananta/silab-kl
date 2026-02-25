"use client"

export function BorrowingProofPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded border px-3 py-1.5 text-sm"
    >
      Cetak
    </button>
  )
}

