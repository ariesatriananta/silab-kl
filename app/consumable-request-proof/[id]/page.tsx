import Image from "next/image"
import Link from "next/link"
import { and, asc, eq } from "drizzle-orm"
import { notFound, redirect } from "next/navigation"

import { BorrowingProofPrintButton } from "@/app/borrowing-proof/[id]/print-button"
import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import {
  borrowingTransactionItems,
  borrowingTransactions,
  consumableItems,
  labs,
  userLabAssignments,
  users,
} from "@/lib/db/schema"

type Role = "admin" | "mahasiswa" | "petugas_plp" | "dosen"

function isValidDateValue(date: unknown): date is Date {
  return date instanceof Date && !Number.isNaN(date.getTime())
}

function fmtDate(date: Date | null) {
  if (!isValidDateValue(date)) return "-"
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(date)
}

export default async function ConsumableRequestProofPage({
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
      purpose: borrowingTransactions.purpose,
      studyProgram: borrowingTransactions.studyProgram,
      courseName: borrowingTransactions.courseName,
      materialTopic: borrowingTransactions.materialTopic,
      semesterLabel: borrowingTransactions.semesterLabel,
      groupName: borrowingTransactions.groupName,
      requestedAt: borrowingTransactions.requestedAt,
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

  const items = await db
    .select({
      id: borrowingTransactionItems.id,
      qty: borrowingTransactionItems.qtyRequested,
      consumableName: consumableItems.name,
      consumableUnit: consumableItems.unit,
    })
    .from(borrowingTransactionItems)
    .innerJoin(consumableItems, eq(consumableItems.id, borrowingTransactionItems.consumableItemId))
    .where(
      and(
        eq(borrowingTransactionItems.transactionId, row.id),
        eq(borrowingTransactionItems.itemType, "consumable"),
      ),
    )
    .orderBy(asc(borrowingTransactionItems.createdAt))

  if (items.length === 0) notFound()

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
                <p className="text-[13px] font-bold uppercase">Jurusan Kesehatan Lingkungan Surabaya</p>
              </div>
            </div>
          </header>

          <h1 className="mt-5 text-md text-center font-bold uppercase">Permintaan Bahan Habis Pakai</h1>

          <section className="mt-4 rounded-2xl border border-black/30 px-4 py-3 text-sm">
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td className="w-1/2 align-top pr-5">
                    <div className="space-y-1">
                      <div className="flex">
                        <span className="w-32 font-semibold">Mata Kuliah</span>
                        <span className="w-4">:</span>
                        <span>{row.courseName}</span>
                      </div>
                      <div className="flex">
                        <span className="w-32 font-semibold">Materi</span>
                        <span className="w-4">:</span>
                        <span>{row.materialTopic}</span>
                      </div>
                      <div className="flex">
                        <span className="w-32 font-semibold">Prodi</span>
                        <span className="w-4">:</span>
                        <span>{row.studyProgram}</span>
                      </div>
                    </div>
                  </td>
                  <td className="w-1/2 align-top pl-5">
                    <div className="space-y-1">
                      <div className="flex">
                        <span className="w-36 font-semibold">Semester</span>
                        <span className="w-4">:</span>
                        <span>{row.semesterLabel}</span>
                      </div>
                      <div className="flex">
                        <span className="w-36 font-semibold">Kelompok</span>
                        <span className="w-4">:</span>
                        <span>{row.groupName}</span>
                      </div>
                      <div className="flex">
                        <span className="w-36 font-semibold">Lab</span>
                        <span className="w-4">:</span>
                        <span>{row.labName}</span>
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
                  <th className="border border-black px-2 py-1 text-center w-10">No</th>
                  <th className="border border-black px-2 py-1 text-center">Nama Bahan</th>
                  <th className="border border-black px-2 py-1 text-center w-36">
                    <div className="leading-tight">
                      <div>PENGGUNAAN</div>
                      <div className="text-[10px]">QTY (gr / ml)</div>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => (
                  <tr key={item.id}>
                    <td className="border border-black px-2 py-1 text-center">{idx + 1}</td>
                    <td className="border border-black px-2 py-1">{item.consumableName}</td>
                    <td className="border border-black px-2 py-1 text-center">
                      {item.qty} {item.consumableUnit ?? ""}
                    </td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, 14 - items.length) }).map((_, idx) => (
                  <tr key={`blank-${idx}`}>
                    <td className="border border-black px-2 py-1">&nbsp;</td>
                    <td className="border border-black px-2 py-1">&nbsp;</td>
                    <td className="border border-black px-2 py-1">&nbsp;</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mt-12 text-sm">
            <div className="flex justify-end">
              <div className="w-64 text-center">
                <p className="text-left">Surabaya, {fmtDate(row.requestedAt)}</p>
                <p className="mt-2">Yang Menggunakan,</p>
                <div className="mt-16 border-b border-black" />
                <p className="mt-2 font-medium">{row.requesterName}</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
