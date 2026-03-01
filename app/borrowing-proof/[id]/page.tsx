import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { and, asc, eq } from "drizzle-orm"
import Image from "next/image"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import {
  borrowingApprovals,
  borrowingReturnItems,
  borrowingReturns,
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

  const [items, approvals, returnRows] = await Promise.all([
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
        approverRole: users.role,
      })
      .from(borrowingApprovals)
      .innerJoin(users, eq(users.id, borrowingApprovals.approverUserId))
      .where(eq(borrowingApprovals.transactionId, row.id))
      .orderBy(asc(borrowingApprovals.decidedAt)),
    db
      .select({
        transactionItemId: borrowingReturnItems.transactionItemId,
        returnedAt: borrowingReturns.returnedAt,
        returnCondition: borrowingReturnItems.returnCondition,
      })
      .from(borrowingReturnItems)
      .innerJoin(borrowingReturns, eq(borrowingReturns.id, borrowingReturnItems.returnId))
      .where(eq(borrowingReturns.transactionId, row.id))
      .orderBy(asc(borrowingReturns.returnedAt)),
  ])

  const returnByItemId = new Map<
    string,
    { returnedAt: Date | null; returnCondition: "baik" | "maintenance" | "damaged" }
  >()
  for (const ret of returnRows) {
    returnByItemId.set(ret.transactionItemId, {
      returnedAt: ret.returnedAt,
      returnCondition: ret.returnCondition,
    })
  }

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

  const plpApproverName =
    approvals.find((a) => a.decision === "approved" && a.approverRole === "petugas_plp")?.approverName ?? "-"
  const dosenApproval = approvals.find((a) => a.approverRole === "dosen")
  const plpApproval = approvals.find((a) => a.approverRole === "petugas_plp")

  const decisionLabel = (decision: "approved" | "rejected" | null | undefined) =>
    decision ? (decision === "approved" ? "Disetujui" : "Ditolak") : "-"

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
          <header className="border-b border-black pb-3">
            <div className="grid grid-cols-[1fr_auto] items-start gap-4">
              <div className="pt-1">
                <Image
                  src="/logo.png"
                  alt="Logo Kemenkes Poltekkes Surabaya"
                  width={260}
                  height={72}
                  className="h-auto w-[220px]"
                  priority
                />
              </div>
              <div className="text-right leading-tight mt-2">
                <p className="text-[13px] font-bold uppercase">Laboratorium</p>
                <p className="text-[13px] font-bold uppercase">Jurusan Kesehatan Lingkungan</p>
                <p className="mt-1 text-[12px]">Jl. Raya Menur 118 A Surabaya</p>
              </div>
            </div>
          </header>
          <h1 className="mt-5 text-md font-bold text-center">LEMBAR PEMINJAMAN ALAT LABORATORIUM</h1>
          <section className="mt-4 rounded-2xl border border-black/30 px-4 py-3 text-sm">
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td className="w-1/2 align-top pr-5">
                    <div className="space-y-1">
                      <div className="flex">
                        <span className="w-28 font-semibold">Mata Kuliah</span>
                        <span className="w-4">:</span>
                        <span>{row.courseName}</span>
                      </div>
                      <div className="flex">
                        <span className="w-28 font-semibold">Materi</span>
                        <span className="w-4">:</span>
                        <span>{row.materialTopic}</span>
                      </div>
                      <div className="flex">
                        <span className="w-28 font-semibold">Semester</span>
                        <span className="w-4">:</span>
                        <span>{row.semesterLabel}</span>
                      </div>
                    </div>
                  </td>
                  <td className="w-1/2 align-top pl-5">
                    <div className="space-y-1">
                      <div className="flex">
                        <span className="w-36 font-semibold">Waktu Pengajuan</span>
                        <span className="w-4">:</span>
                        <span>{fmtDateTime(row.requestedAt)}</span>
                      </div>
                      <div className="flex">
                        <span className="w-36 font-semibold">Keperluan</span>
                        <span className="w-4">:</span>
                        <span>{row.purpose}</span>
                      </div>
                      <div className="flex">
                        <span className="w-36 font-semibold">Kelompok</span>
                        <span className="w-4">:</span>
                        <span>{row.groupName}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="mt-5">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border border-black px-2 py-1 text-center w-5" rowSpan={2}>No</th>
                  <th className="border border-black px-2 py-1 text-left" rowSpan={2}>Nama Alat/Bahan</th>
                  <th className="border border-black px-2 py-1 text-center" rowSpan={2}>Jumlah</th>
                  <th className="border border-black px-2 py-1 text-center" colSpan={2}>Waktu</th>
                  <th className="border border-black px-2 py-1 text-center" colSpan={2}>Kondisi</th>
                  <th className="border border-black px-2 py-1 text-center w-15" rowSpan={2}>Paraf Petugas</th>
                </tr>
                <tr>
                  <th className="border border-black px-2 py-1 text-center">Pinjam</th>
                  <th className="border border-black px-2 py-1 text-center">Kembali</th>
                  <th className="border border-black px-2 py-1 text-center">Pinjam</th>
                  <th className="border border-black px-2 py-1 text-center">Kembali</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="border border-black px-2 py-2 text-center">
                      Tidak ada item.
                    </td>
                  </tr>
                )}
                {items.map((item, idx) => {
                  const returnInfo = returnByItemId.get(item.id)
                  return (
                  <tr key={item.id}>
                    <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                    <td className="border border-black px-2 py-1">
                      {item.itemType === "tool_asset" ? (item.toolName ?? "Alat") : (item.consumableName ?? "Bahan")}
                    </td>
                    <td className="border border-black px-2 py-1 text-center">
                      {item.qty} {item.itemType === "consumable" ? item.consumableUnit ?? "" : "unit"}
                    </td>
                    <td className="border border-black px-1 py-1 text-[10px] whitespace-nowrap text-center">
                      {fmtDateTime(row.handedOverAt)}
                    </td>
                    <td className="border border-black px-1 py-1 text-[10px] whitespace-nowrap text-center">
                      {item.itemType === "tool_asset" ? fmtDateTime(returnInfo?.returnedAt ?? null) : "-"}
                    </td>
                    <td className="border border-black px-2 py-1 text-center">Baik</td>
                    <td className="border border-black px-2 py-1 text-center">
                      {item.itemType === "tool_asset"
                        ? returnInfo
                          ? returnInfo.returnCondition === "baik"
                            ? "Baik"
                            : returnInfo.returnCondition === "maintenance"
                              ? "Maintenance"
                              : "Rusak"
                          : "-"
                        : "-"}
                    </td>
                    <td className="border border-black px-2 py-1">&nbsp;</td>
                  </tr>
                )})}
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
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 rounded border border-black/30 px-2 py-1 text-xs print:rounded-none print:border-none print:px-0 print:py-0">
              Ket: (*) diisi petugas lab. Kolom kondisi/paraf disediakan sebagai bukti serah-terima/pengembalian manual saat dibutuhkan.
            </p>
          </section>

          <section className="mt-4 text-sm">
            <div className="mb-4 grid grid-cols-3 font-semibold">
              <div />
              <div />
              <div className="pl-8 text-left">
                <p>Surabaya, {fmtDate(new Date())}</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <div className="space-y-0.5 leading-none">
                <p>Mengetahui,</p>
                <p>Dosen Pembimbing</p>
              </div>
              <div className="mt-2 h-[2.9rem] space-y-0 text-xs leading-none">
                <p
                  className={`text-sm font-bold uppercase ${
                    dosenApproval?.decision === "approved"
                      ? "text-emerald-700"
                      : dosenApproval?.decision === "rejected"
                        ? "text-red-700"
                        : "text-neutral-700"
                  }`}
                >
                  {decisionLabel(dosenApproval?.decision)}
                </p>
                <p>{fmtDateTime(dosenApproval?.decidedAt ?? null)}</p>
                <p className="italic">{dosenApproval?.note ? `(${dosenApproval.note})` : "\u00A0"}</p>
              </div>
              <div className="mt-0.5 border-t border-black pt-0.5">{row.advisorLecturerName ?? "-"}</div>
            </div>
            <div className="text-center">
              <div className="space-y-0.5 leading-none">
                <p>Menyetujui,</p>
                <p>Petugas PLP</p>
              </div>
              <div className="mt-2 h-[2.9rem] space-y-0 text-xs leading-none">
                <p
                  className={`text-sm font-bold uppercase ${
                    plpApproval?.decision === "approved"
                      ? "text-emerald-700"
                      : plpApproval?.decision === "rejected"
                        ? "text-red-700"
                        : "text-neutral-700"
                  }`}
                >
                  {decisionLabel(plpApproval?.decision)}
                </p>
                <p>{fmtDateTime(plpApproval?.decidedAt ?? null)}</p>
                <p className="italic">{plpApproval?.note ? `(${plpApproval.note})` : "\u00A0"}</p>
              </div>
              <div className="mt-0.5 border-t border-black pt-0.5">{plpApproverName}</div>
            </div>
            <div className="text-center">
              <div className="space-y-0.5 leading-none">
                <p>Peminjam,</p>
                <p>Mahasiswa</p>
              </div>
              <div className="mt-2 h-[2.9rem]" />
              <div className="mt-0.5 border-t border-black pt-0.5">{row.requesterName}</div>
            </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
