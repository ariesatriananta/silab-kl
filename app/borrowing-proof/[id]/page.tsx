import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { and, asc, eq } from "drizzle-orm"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import {
  borrowingApprovals,
  borrowingTransactionItems,
  borrowingTransactions,
  consumableItems,
  labs,
  toolAssets,
  toolModels,
  userLabAssignments,
  users,
} from "@/lib/db/schema"
import { BorrowingProofPrintButton } from "./print-button"

function fmtDate(date: Date | null) {
  if (!date) return "-"
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(date)
}

function fmtDateTime(date: Date | null) {
  if (!date) return "-"
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date)
}

type Role = "admin" | "mahasiswa" | "petugas_plp" | "dosen"

export default async function BorrowingProofPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) redirect("/")

  const role = session.user.role as Role
  const userId = session.user.id

  const tx = await db
    .select({
      id: borrowingTransactions.id,
      code: borrowingTransactions.code,
      labId: borrowingTransactions.labId,
      requesterUserId: borrowingTransactions.requesterUserId,
      status: borrowingTransactions.status,
      purpose: borrowingTransactions.purpose,
      courseName: borrowingTransactions.courseName,
      materialTopic: borrowingTransactions.materialTopic,
      semesterLabel: borrowingTransactions.semesterLabel,
      groupName: borrowingTransactions.groupName,
      advisorLecturerName: borrowingTransactions.advisorLecturerName,
      requestedAt: borrowingTransactions.requestedAt,
      handedOverAt: borrowingTransactions.handedOverAt,
      dueDate: borrowingTransactions.dueDate,
      requesterName: users.fullName,
      requesterNim: users.nim,
      labName: labs.name,
    })
    .from(borrowingTransactions)
    .innerJoin(users, eq(users.id, borrowingTransactions.requesterUserId))
    .innerJoin(labs, eq(labs.id, borrowingTransactions.labId))
    .where(eq(borrowingTransactions.id, id))
    .limit(1)

  const row = tx[0]
  if (!row) notFound()

  if (role === "mahasiswa" && row.requesterUserId !== userId) redirect("/dashboard/borrowing")
  if (role === "petugas_plp" || role === "dosen") {
    const assignment = await db.query.userLabAssignments.findFirst({
      where: and(eq(userLabAssignments.userId, userId), eq(userLabAssignments.labId, row.labId)),
      columns: { userId: true },
    })
    if (!assignment) redirect("/dashboard/borrowing")
  }

  const [items, approvals] = await Promise.all([
    db
      .select({
        id: borrowingTransactionItems.id,
        itemType: borrowingTransactionItems.itemType,
        qty: borrowingTransactionItems.qtyRequested,
        toolName: toolModels.name,
        assetCode: toolAssets.assetCode,
        consumableName: consumableItems.name,
        consumableUnit: consumableItems.unit,
      })
      .from(borrowingTransactionItems)
      .leftJoin(toolAssets, eq(toolAssets.id, borrowingTransactionItems.toolAssetId))
      .leftJoin(toolModels, eq(toolModels.id, toolAssets.toolModelId))
      .leftJoin(consumableItems, eq(consumableItems.id, borrowingTransactionItems.consumableItemId))
      .where(eq(borrowingTransactionItems.transactionId, row.id))
      .orderBy(asc(borrowingTransactionItems.createdAt)),
    db
      .select({
        decision: borrowingApprovals.decision,
        note: borrowingApprovals.note,
        decidedAt: borrowingApprovals.decidedAt,
        approverName: users.fullName,
      })
      .from(borrowingApprovals)
      .innerJoin(users, eq(users.id, borrowingApprovals.approverUserId))
      .where(eq(borrowingApprovals.transactionId, row.id))
      .orderBy(asc(borrowingApprovals.decidedAt)),
  ])

  const statusLabelMap: Record<string, string> = {
    submitted: "Draft",
    pending_approval: "Menunggu Approval",
    approved_waiting_handover: "Menunggu Serah Terima",
    active: "Aktif",
    partially_returned: "Kembali Sebagian",
    completed: "Dikembalikan",
    cancelled: "Dibatalkan",
    rejected: "Ditolak",
  }

  return (
    <div className="min-h-screen bg-muted/20 text-black print:bg-white">
      <div className="mx-auto max-w-5xl p-4 sm:p-6 print:max-w-4xl print:p-0">
        <div className="mb-4 flex items-center justify-between rounded-xl border border-border/60 bg-background px-4 py-3 shadow-sm print:hidden">
          <Link href="/dashboard/borrowing" className="text-sm font-medium text-foreground underline-offset-4 hover:underline">
            Kembali ke Peminjaman
          </Link>
          <BorrowingProofPrintButton />
        </div>

        <div className="mx-auto rounded-2xl border border-black bg-white p-6 shadow-sm print:rounded-none print:border-none print:p-6 print:shadow-none">
          <header className="border-b border-black pb-4 text-center">
            <p className="text-sm font-semibold">LABORATORIUM JURUSAN KESEHATAN LINGKUNGAN</p>
            <p className="text-xs">Kemenkes Poltekkes Surabaya</p>
            <h1 className="mt-3 text-lg font-bold">LEMBAR PEMINJAMAN ALAT LABORATORIUM</h1>
          </header>

          <section className="mt-4 grid grid-cols-1 gap-2 rounded-lg border border-black/40 p-3 text-sm md:grid-cols-2 print:rounded-none print:border-none print:p-0">
            <div><span className="font-semibold">Kode Transaksi:</span> {row.code}</div>
            <div><span className="font-semibold">Status:</span> {statusLabelMap[row.status] ?? row.status}</div>
            <div><span className="font-semibold">Laboratorium:</span> {row.labName}</div>
            <div><span className="font-semibold">Tanggal Pengajuan:</span> {fmtDate(row.requestedAt)}</div>
            <div><span className="font-semibold">Peminjam:</span> {row.requesterName}</div>
            <div><span className="font-semibold">NIM:</span> {row.requesterNim ?? "-"}</div>
            <div><span className="font-semibold">Mata Kuliah:</span> {row.courseName}</div>
            <div><span className="font-semibold">Materi:</span> {row.materialTopic}</div>
            <div><span className="font-semibold">Semester:</span> {row.semesterLabel}</div>
            <div><span className="font-semibold">Kelompok:</span> {row.groupName}</div>
            <div className="md:col-span-2"><span className="font-semibold">Dosen Pembimbing:</span> {row.advisorLecturerName ?? "-"}</div>
            <div className="md:col-span-2"><span className="font-semibold">Keperluan:</span> {row.purpose}</div>
            <div><span className="font-semibold">Waktu Pinjam:</span> {fmtDateTime(row.handedOverAt)}</div>
            <div><span className="font-semibold">Batas Kembali:</span> {fmtDate(row.dueDate)}</div>
          </section>

          <section className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Rincian Item Peminjaman</h2>
              <span className="text-xs text-neutral-600">Alat + bahan dalam satu transaksi</span>
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-black px-2 py-1 text-left" rowSpan={2}>No</th>
                  <th className="border border-black px-2 py-1 text-left" rowSpan={2}>Nama Alat/Bahan</th>
                  <th className="border border-black px-2 py-1 text-left" rowSpan={2}>Jenis</th>
                  <th className="border border-black px-2 py-1 text-left" rowSpan={2}>Kode Unit</th>
                  <th className="border border-black px-2 py-1 text-right" rowSpan={2}>Jumlah</th>
                  <th className="border border-black px-2 py-1 text-center" colSpan={2}>Waktu</th>
                  <th className="border border-black px-2 py-1 text-center" colSpan={2}>Kondisi</th>
                  <th className="border border-black px-2 py-1 text-left" rowSpan={2}>Paraf Petugas</th>
                </tr>
                <tr>
                  <th className="border border-black px-2 py-1 text-left">Pinjam</th>
                  <th className="border border-black px-2 py-1 text-left">Kembali</th>
                  <th className="border border-black px-2 py-1 text-left">Pinjam</th>
                  <th className="border border-black px-2 py-1 text-left">Kembali</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={10} className="border border-black px-2 py-2 text-center">
                      Tidak ada item.
                    </td>
                  </tr>
                )}
                {items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="border border-black px-2 py-1">{idx + 1}</td>
                    <td className="border border-black px-2 py-1">
                      {item.itemType === "tool_asset" ? (item.toolName ?? "Alat") : (item.consumableName ?? "Bahan")}
                    </td>
                    <td className="border border-black px-2 py-1">
                      {item.itemType === "tool_asset" ? "Alat" : "Bahan"}
                    </td>
                    <td className="border border-black px-2 py-1">
                      {item.itemType === "tool_asset" ? (item.assetCode ?? "-") : "-"}
                    </td>
                    <td className="border border-black px-2 py-1 text-right">
                      {item.qty} {item.itemType === "consumable" ? item.consumableUnit ?? "" : "unit"}
                    </td>
                    <td className="border border-black px-2 py-1 text-xs">{idx === 0 ? fmtDateTime(row.handedOverAt) : ""}</td>
                    <td className="border border-black px-2 py-1 text-xs">{idx === 0 ? fmtDate(row.dueDate) : ""}</td>
                    <td className="border border-black px-2 py-1 text-xs">(*)</td>
                    <td className="border border-black px-2 py-1 text-xs">(*)</td>
                    <td className="border border-black px-2 py-1">&nbsp;</td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, 12 - items.length) }).map((_, idx) => (
                  <tr key={`blank-${idx}`}>
                    <td className="border border-black px-2 py-1">&nbsp;</td>
                    <td className="border border-black px-2 py-1">&nbsp;</td>
                    <td className="border border-black px-2 py-1">&nbsp;</td>
                    <td className="border border-black px-2 py-1">&nbsp;</td>
                    <td className="border border-black px-2 py-1">&nbsp;</td>
                    <td className="border border-black px-2 py-1">&nbsp;</td>
                    <td className="border border-black px-2 py-1">&nbsp;</td>
                    <td className="border border-black px-2 py-1">&nbsp;</td>
                    <td className="border border-black px-2 py-1">&nbsp;</td>
                    <td className="border border-black px-2 py-1">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 rounded border border-black/30 px-2 py-1 text-xs print:rounded-none print:border-none print:px-0 print:py-0">
              Ket: (*) diisi petugas lab. Kolom kondisi/paraf disediakan sebagai bukti serah-terima/pengembalian manual saat dibutuhkan.
            </p>
          </section>

          <section className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Riwayat Approval</h2>
              <span className="text-xs text-neutral-600">{approvals.length} keputusan</span>
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="border border-black px-2 py-1 text-left">No</th>
                  <th className="border border-black px-2 py-1 text-left">Petugas</th>
                  <th className="border border-black px-2 py-1 text-left">Keputusan</th>
                  <th className="border border-black px-2 py-1 text-left">Waktu</th>
                  <th className="border border-black px-2 py-1 text-left">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {approvals.length === 0 && (
                  <tr>
                    <td colSpan={5} className="border border-black px-2 py-2 text-center">
                      Belum ada approval.
                    </td>
                  </tr>
                )}
                {approvals.map((a, idx) => (
                  <tr key={`${a.approverName}-${idx}`}>
                    <td className="border border-black px-2 py-1">{idx + 1}</td>
                    <td className="border border-black px-2 py-1">{a.approverName}</td>
                    <td className="border border-black px-2 py-1">
                      {a.decision === "approved" ? "Disetujui" : "Ditolak"}
                    </td>
                    <td className="border border-black px-2 py-1">{fmtDateTime(a.decidedAt)}</td>
                    <td className="border border-black px-2 py-1">{a.note ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mt-8 grid grid-cols-2 gap-8 text-sm">
            <div className="text-center">
              <p>Mengetahui,</p>
              <p>Dosen Pembimbing</p>
              <div className="mt-16 border-t border-black pt-1" />
            </div>
            <div className="text-center">
              <p>Surabaya, {fmtDate(new Date())}</p>
              <p>Peminjam / Mahasiswa</p>
              <div className="mt-16 border-t border-black pt-1">{row.requesterName}</div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
