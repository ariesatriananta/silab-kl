"use server"

import { revalidatePath } from "next/cache"
import { and, eq, gt, inArray, lt, ne, or } from "drizzle-orm"
import { z } from "zod"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import {
  labRoomBookingRequests,
  labSchedules,
  labUsageAttendances,
  labUsageLogs,
  labs,
  users,
} from "@/lib/db/schema"

export type StudentLabBookingActionResult = { ok: boolean; message: string }

const createBookingSchema = z.object({
  labId: z.string().uuid(),
  courseName: z.string().trim().min(3, "Mata kuliah minimal 3 karakter.").max(200),
  materialTopic: z.string().trim().min(3, "Materi minimal 3 karakter.").max(200),
  studyProgram: z.enum(["Sanitasi", "Sanitasi Lingkungan"]),
  semesterClassLabel: z.string().trim().min(1, "Semester - kelas wajib diisi.").max(100),
  groupName: z.string().trim().min(1, "Kelompok wajib diisi.").max(100),
  advisorLecturerName: z.string().trim().min(3, "Dosen pembimbing minimal 3 karakter.").max(200),
  plannedStartAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Waktu mulai wajib diisi."),
  plannedEndAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Waktu selesai wajib diisi."),
  note: z.string().max(500).optional(),
})

const cancelBookingSchema = z.object({
  requestId: z.string().uuid(),
})

const createUsageSchema = z.object({
  requestId: z.string().uuid(),
  note: z.string().max(500).optional(),
  attendanceText: z.string().min(1, "Daftar peserta wajib diisi.").max(20000),
})

function parseDateTimeLocalWib(value: string) {
  const parsed = new Date(`${value}:00+07:00`)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Format tanggal dan waktu tidak valid.")
  }
  return parsed
}

function fmtDateTime(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date)
}

function generateLabBookingCode() {
  const timestamp = Date.now().toString().slice(-10)
  const random = Math.floor(Math.random() * 9000 + 1000)
  return `LBR-${timestamp}-${random}`
}

function parseAttendanceLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const normalized = line.replace(/^\d+[.)]\s*/, "").trim()
      const nimNameMatch = normalized.match(/^([A-Za-z0-9\/.-]{4,})\s*[-,:|]\s*(.+)$/)
      if (nimNameMatch) {
        return {
          attendeeNim: nimNameMatch[1].trim(),
          attendeeName: nimNameMatch[2].trim(),
        }
      }
      return {
        attendeeNim: null,
        attendeeName: normalized,
      }
    })
}

async function ensureMahasiswaSession() {
  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) {
    return { error: "Sesi tidak valid. Silakan login ulang." as const }
  }
  if (session.user.role !== "mahasiswa") {
    return { error: "Hanya mahasiswa yang dapat mengajukan booking ruang." as const }
  }
  return { session }
}

async function findScheduleOverlap(labId: string, startAt: Date, endAt: Date) {
  return db.query.labSchedules.findFirst({
    where: and(
      eq(labSchedules.labId, labId),
      lt(labSchedules.scheduledStartAt, endAt),
      gt(labSchedules.scheduledEndAt, startAt),
    ),
    columns: {
      id: true,
      courseName: true,
      groupName: true,
      scheduledStartAt: true,
      scheduledEndAt: true,
    },
  })
}

async function findBookingOverlap(labId: string, startAt: Date, endAt: Date, excludeRequestId?: string) {
  const filters = [
    eq(labRoomBookingRequests.labId, labId),
    inArray(labRoomBookingRequests.status, ["pending", "approved"]),
    lt(labRoomBookingRequests.plannedStartAt, endAt),
    gt(labRoomBookingRequests.plannedEndAt, startAt),
  ]
  if (excludeRequestId) {
    filters.push(ne(labRoomBookingRequests.id, excludeRequestId))
  }

  return db.query.labRoomBookingRequests.findFirst({
    where: and(...filters),
    columns: {
      id: true,
      code: true,
      courseName: true,
      groupName: true,
      status: true,
      plannedStartAt: true,
      plannedEndAt: true,
    },
  })
}

export async function createStudentLabBookingAction(
  _prev: StudentLabBookingActionResult | null,
  formData: FormData,
): Promise<StudentLabBookingActionResult> {
  const auth = await ensureMahasiswaSession()
  if ("error" in auth) return { ok: false, message: auth.error ?? "Akses ditolak." }

  const parsed = createBookingSchema.safeParse({
    labId: formData.get("labId"),
    courseName: formData.get("courseName"),
    materialTopic: formData.get("materialTopic"),
    studyProgram: formData.get("studyProgram"),
    semesterClassLabel: formData.get("semesterClassLabel"),
    groupName: formData.get("groupName"),
    advisorLecturerName: formData.get("advisorLecturerName"),
    plannedStartAt: formData.get("plannedStartAt"),
    plannedEndAt: formData.get("plannedEndAt"),
    note: formData.get("note")?.toString() || undefined,
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data booking tidak valid." }
  }

  let plannedStartAt: Date
  let plannedEndAt: Date
  try {
    plannedStartAt = parseDateTimeLocalWib(parsed.data.plannedStartAt)
    plannedEndAt = parseDateTimeLocalWib(parsed.data.plannedEndAt)
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Format tanggal/jam tidak valid." }
  }

  if (plannedEndAt <= plannedStartAt) {
    return { ok: false, message: "Waktu selesai harus lebih besar dari waktu mulai." }
  }

  if (plannedStartAt.getTime() <= Date.now()) {
    return { ok: false, message: "Waktu mulai booking harus di masa depan." }
  }

  const [lab, requester, scheduleOverlap, bookingOverlap] = await Promise.all([
    db.query.labs.findFirst({
      where: and(eq(labs.id, parsed.data.labId), eq(labs.isActive, true)),
      columns: { id: true, name: true },
    }),
    db.query.users.findFirst({
      where: and(eq(users.id, auth.session.user.id), eq(users.isActive, true)),
      columns: { id: true, fullName: true, nim: true },
    }),
    findScheduleOverlap(parsed.data.labId, plannedStartAt, plannedEndAt),
    findBookingOverlap(parsed.data.labId, plannedStartAt, plannedEndAt),
  ])

  if (!lab) return { ok: false, message: "Laboratorium tidak ditemukan atau nonaktif." }
  if (!requester) return { ok: false, message: "Data mahasiswa tidak ditemukan." }

  if (scheduleOverlap) {
    return {
      ok: false,
      message: `Slot bentrok dengan jadwal final "${scheduleOverlap.courseName} - ${scheduleOverlap.groupName}" (${fmtDateTime(scheduleOverlap.scheduledStartAt)} - ${fmtDateTime(scheduleOverlap.scheduledEndAt)}).`,
    }
  }

  if (bookingOverlap) {
    return {
      ok: false,
      message: `Slot sudah diblok oleh pengajuan ${bookingOverlap.status === "pending" ? "menunggu approval" : "yang sudah disetujui"} "${bookingOverlap.courseName} - ${bookingOverlap.groupName}" (${fmtDateTime(bookingOverlap.plannedStartAt)} - ${fmtDateTime(bookingOverlap.plannedEndAt)}).`,
    }
  }

  await db.insert(labRoomBookingRequests).values({
    code: generateLabBookingCode(),
    labId: parsed.data.labId,
    requesterUserId: auth.session.user.id,
    status: "pending",
    courseName: parsed.data.courseName,
    materialTopic: parsed.data.materialTopic,
    studyProgram: parsed.data.studyProgram,
    semesterClassLabel: parsed.data.semesterClassLabel,
    groupName: parsed.data.groupName,
    advisorLecturerName: parsed.data.advisorLecturerName,
    plannedStartAt,
    plannedEndAt,
    note: parsed.data.note?.trim() || null,
  })

  revalidatePath("/dashboard/student-lab-schedule")
  revalidatePath("/dashboard/lab-usage")
  return { ok: true, message: "Pengajuan booking ruang berhasil dikirim dan menunggu approval Petugas PLP." }
}

export async function cancelStudentLabBookingAction(
  _prev: StudentLabBookingActionResult | null,
  formData: FormData,
): Promise<StudentLabBookingActionResult> {
  const auth = await ensureMahasiswaSession()
  if ("error" in auth) return { ok: false, message: auth.error ?? "Akses ditolak." }

  const parsed = cancelBookingSchema.safeParse({
    requestId: formData.get("requestId"),
  })
  if (!parsed.success) return { ok: false, message: "Data pembatalan tidak valid." }

  const request = await db.query.labRoomBookingRequests.findFirst({
    where: eq(labRoomBookingRequests.id, parsed.data.requestId),
    columns: {
      id: true,
      requesterUserId: true,
      status: true,
      plannedStartAt: true,
      scheduleId: true,
      usageLogId: true,
    },
  })

  if (!request || request.requesterUserId !== auth.session.user.id) {
    return { ok: false, message: "Booking tidak ditemukan." }
  }

  if (request.status === "rejected" || request.status === "cancelled") {
    return { ok: false, message: "Booking ini sudah tidak aktif." }
  }

  if (request.usageLogId) {
    return { ok: false, message: "Booking tidak bisa dibatalkan karena penggunaan lab sudah tercatat." }
  }

  if (request.plannedStartAt.getTime() <= Date.now()) {
    return { ok: false, message: "Booking tidak bisa dibatalkan karena sesi sudah dimulai atau sudah lewat." }
  }

  if (request.scheduleId) {
    await db.delete(labSchedules).where(eq(labSchedules.id, request.scheduleId))
  }

  try {
    await db
      .update(labRoomBookingRequests)
      .set({
        status: "cancelled",
        cancelReason: "Dibatalkan oleh mahasiswa",
        cancelledByUserId: auth.session.user.id,
        cancelledAt: new Date(),
        updatedAt: new Date(),
        scheduleId: null,
      })
      .where(eq(labRoomBookingRequests.id, request.id))
  } catch {
    return { ok: false, message: "Pembatalan gagal disimpan. Coba ulangi lagi." }
  }

  revalidatePath("/dashboard/student-lab-schedule")
  revalidatePath("/dashboard/lab-usage")
  return { ok: true, message: "Booking ruang berhasil dibatalkan." }
}

export async function createStudentLabUsageAction(
  _prev: StudentLabBookingActionResult | null,
  formData: FormData,
): Promise<StudentLabBookingActionResult> {
  const auth = await ensureMahasiswaSession()
  if ("error" in auth) return { ok: false, message: auth.error ?? "Akses ditolak." }

  const parsed = createUsageSchema.safeParse({
    requestId: formData.get("requestId"),
    note: formData.get("note")?.toString() || undefined,
    attendanceText: formData.get("attendanceText")?.toString() || "",
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data penggunaan lab tidak valid." }
  }

  const attendanceRows = parseAttendanceLines(parsed.data.attendanceText)
  if (attendanceRows.length === 0) {
    return { ok: false, message: "Daftar peserta wajib diisi minimal 1 nama." }
  }

  const request = await db.query.labRoomBookingRequests.findFirst({
    where: eq(labRoomBookingRequests.id, parsed.data.requestId),
    columns: {
      id: true,
      requesterUserId: true,
      status: true,
      scheduleId: true,
      usageLogId: true,
      labId: true,
      courseName: true,
      groupName: true,
      plannedStartAt: true,
      plannedEndAt: true,
    },
  })

  if (!request || request.requesterUserId !== auth.session.user.id) {
    return { ok: false, message: "Booking ruang tidak ditemukan." }
  }
  if (request.status !== "approved") {
    return { ok: false, message: "Penggunaan lab hanya bisa diisi setelah booking disetujui." }
  }
  if (!request.scheduleId) {
    return { ok: false, message: "Jadwal final belum terbentuk untuk booking ini." }
  }
  if (request.usageLogId) {
    return { ok: false, message: "Penggunaan lab untuk booking ini sudah pernah disimpan." }
  }

  const insertedUsage = await db
    .insert(labUsageLogs)
    .values({
      labId: request.labId,
      scheduleId: request.scheduleId,
      courseName: request.courseName,
      groupName: request.groupName,
      studentCount: attendanceRows.length,
      startedAt: request.plannedStartAt,
      endedAt: request.plannedEndAt,
      createdByUserId: auth.session.user.id,
      note: parsed.data.note?.trim() || null,
    })
    .returning({ id: labUsageLogs.id })

  const usage = insertedUsage[0]
  if (!usage) {
    return { ok: false, message: "Gagal menyimpan penggunaan lab." }
  }

  try {
    await db.insert(labUsageAttendances).values(
      attendanceRows.map((row) => ({
        usageLogId: usage.id,
        attendeeName: row.attendeeName,
        attendeeNim: row.attendeeNim,
      })),
    )

    await db
      .update(labRoomBookingRequests)
      .set({
        usageLogId: usage.id,
        updatedAt: new Date(),
      })
      .where(eq(labRoomBookingRequests.id, request.id))
  } catch {
    await db.delete(labUsageAttendances).where(eq(labUsageAttendances.usageLogId, usage.id))
    await db.delete(labUsageLogs).where(eq(labUsageLogs.id, usage.id))
    return { ok: false, message: "Gagal menyimpan penggunaan lab. Perubahan dibatalkan, silakan coba lagi." }
  }

  revalidatePath("/dashboard/student-lab-schedule")
  revalidatePath("/dashboard/lab-usage")
  revalidatePath(`/lab-usage-proof/${usage.id}`)

  return { ok: true, message: "Penggunaan lab berhasil disimpan. Lembar pemakaian sekarang bisa dicetak." }
}
