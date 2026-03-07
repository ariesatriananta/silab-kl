import Image from "next/image"
import Link from "next/link"
import { and, eq } from "drizzle-orm"
import { notFound, redirect } from "next/navigation"

import { BorrowingProofPrintButton } from "@/app/borrowing-proof/[id]/print-button"
import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import { labRoomBookingRequests, labUsageAttendances, labUsageLogs, labs, users } from "@/lib/db/schema"

function fmtDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date)
}

function fmtTime(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(date)
}

export default async function LabUsageProofPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) redirect("/")
  if (session.user.role === "dosen") redirect("/dashboard")

  const { id } = await params

  const usage = await db
    .select({
      usageId: labUsageLogs.id,
      labName: labs.name,
      courseName: labUsageLogs.courseName,
      groupName: labUsageLogs.groupName,
      studentCount: labUsageLogs.studentCount,
      startedAt: labUsageLogs.startedAt,
      endedAt: labUsageLogs.endedAt,
      note: labUsageLogs.note,
      bookingId: labRoomBookingRequests.id,
      requesterUserId: labRoomBookingRequests.requesterUserId,
      studyProgram: labRoomBookingRequests.studyProgram,
      semesterClassLabel: labRoomBookingRequests.semesterClassLabel,
      materialTopic: labRoomBookingRequests.materialTopic,
      advisorLecturerName: labRoomBookingRequests.advisorLecturerName,
      approvedAt: labRoomBookingRequests.approvedAt,
      approverName: users.fullName,
      approverNip: users.nip,
    })
    .from(labUsageLogs)
    .innerJoin(labs, eq(labs.id, labUsageLogs.labId))
    .leftJoin(labRoomBookingRequests, eq(labRoomBookingRequests.usageLogId, labUsageLogs.id))
    .leftJoin(users, eq(users.id, labRoomBookingRequests.approvedByUserId))
    .where(eq(labUsageLogs.id, id))

  const row = usage[0]
  if (!row) notFound()

  if (session.user.role === "mahasiswa" && row.requesterUserId !== session.user.id) {
    notFound()
  }

  const attendanceRows = await db
    .select({
      attendeeName: labUsageAttendances.attendeeName,
      attendeeNim: labUsageAttendances.attendeeNim,
    })
    .from(labUsageAttendances)
    .where(eq(labUsageAttendances.usageLogId, id))

  const attendees = attendanceRows.length > 0 ? attendanceRows : []

  return (
    <div className="min-h-screen bg-muted/20 text-black print:bg-white">
      <div className="mx-auto max-w-5xl p-4 sm:p-6 print:max-w-4xl print:p-0">
        <div className="mb-4 flex items-center justify-between rounded-xl border border-border/60 bg-background px-4 py-3 shadow-sm print:hidden">
          <Link href="/dashboard/student-lab-schedule" className="text-sm font-medium text-foreground hover:underline">
            Kembali ke Booking Lab
          </Link>
          <BorrowingProofPrintButton />
        </div>

        <div className="mx-auto rounded-2xl border border-black bg-white p-6 shadow-sm print:rounded-none print:border-none print:p-6 print:shadow-none">
          <header className="border-b border-black pb-4">
            <div className="flex items-start justify-between gap-6">
              <div className="flex items-center gap-4">
                <Image src="/logo.png" alt="Kemenkes" width={180} height={64} className="h-auto w-[180px]" priority />
              </div>
              <div className="text-right">
                <p className="text-md font-semibold leading-tight">LABORATORIUM</p>
                <p className="text-md font-semibold leading-tight">JURUSAN KESEHATAN LINGKUNGAN</p>
                <p className="mt-1 text-sm">Jl. Raya Menur 118 A Surabaya</p>
              </div>
            </div>
          </header>

          <section className="mt-3">
            <h1 className="text-center text-md font-semibold tracking-wide">DAFTAR PENGGUNAAN RUANG LABORATORIUM</h1>
          </section>

          <section className="mt-2 rounded-xl border border-black/30 px-4 py-2 text-sm">
            <div className="grid grid-cols-2 gap-x-10 gap-y-2">
              <div className="grid grid-cols-[120px_14px_1fr] items-start gap-y-0">
                <span>Hari / Tanggal</span>
                <span>:</span>
                <span>{fmtDate(row.startedAt)}</span>
                <span>Waktu</span>
                <span>:</span>
                <span>
                  {fmtTime(row.startedAt)} - {fmtTime(row.endedAt)}
                </span>
                <span>Mata Kuliah</span>
                <span>:</span>
                <span>{row.courseName}</span>
                <span>Ruang Lab</span>
                <span>:</span>
                <span>{row.labName}</span>
              </div>
              <div className="grid grid-cols-[140px_14px_1fr] items-start gap-y-0">
                <span>Materi</span>
                <span>:</span>
                <span>{row.materialTopic}</span>
                <span>Kelompok</span>
                <span>:</span>
                <span>{row.groupName}</span>
                <span>Prodi</span>
                <span>:</span>
                <span>{row.studyProgram}</span>
                <span>Semester - Kelas</span>
                <span>:</span>
                <span>{row.semesterClassLabel}</span>
                <span>Pembimbing</span>
                <span>:</span>
                <span>{row.advisorLecturerName}</span>
              </div>
            </div>
          </section>

          <section className="mt-4">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className="border border-black px-2 py-1 text-center w-5">No.</th>
                  <th className="border border-black px-2 py-1 text-left">Nama Mahasiswa</th>
                  <th className="border border-black px-2 py-1 text-center">Tanda Tangan</th>
                  <th className="border border-black px-2 py-1 text-left w-20">Ket</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.max(20, attendees.length || row.studentCount) }).map((_, index) => {
                  const attendee = attendees[index]
                  const signNumber = index + 1
                  const isOdd = signNumber % 2 === 1
                  return (
                    <tr key={`attendee-${index}`}>
                      <td className="border border-black px-2 text-center">{index + 1}</td>
                      <td className="border border-black px-2 ">{attendee?.attendeeName ?? ""}</td>
                      <td className="border border-black px-2 ">
                        <div className="relative min-h-6 px-4">
                          <div className="absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-black" />
                          <div className={`relative flex min-h-6 items-start ${isOdd ? "justify-start" : "justify-end"}`}>
                            <span>{signNumber <= 20 ? signNumber : ""}</span>
                          </div>
                        </div>
                      </td>
                      <td className="border border-black px-2 " />
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          <section className="mt-10 grid grid-cols-2 gap-10 text-center text-sm">
            <div className="flex flex-col">
              <p>Mengetahui,</p>
              <p>Koordinator Lab & Workshop</p>
              <div className="mt-16 border-b border-black" />
              <p className="mt-2 font-medium">{row.approverName ?? "-"}</p>
              <p className="text-xs">{row.approverNip ? `NIP. ${row.approverNip}` : ""}</p>
            </div>
            <div className="flex flex-col">
              <p>Pembimbing</p>
              <p className="invisible">spacer</p>
              <div className="mt-16 border-b border-black" />
              <p className="mt-2 font-medium">{row.advisorLecturerName}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
