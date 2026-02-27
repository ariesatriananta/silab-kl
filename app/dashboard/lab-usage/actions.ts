"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import { labSchedules, labUsageAttendances, labUsageLogs, userLabAssignments } from "@/lib/db/schema"
import { writeSecurityAuditLog } from "@/lib/security/audit"

type ActionResult = { ok: boolean; message: string }

const scheduleSchema = z.object({
  labId: z.string().uuid(),
  courseName: z.string().min(3).max(200),
  groupName: z.string().min(1).max(100),
  instructorName: z.string().min(3).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  capacity: z.coerce.number().int().min(1).max(500),
  enrolledCount: z.coerce.number().int().min(0).max(500),
})

const scheduleUpdateSchema = scheduleSchema.extend({
  scheduleId: z.string().uuid(),
})

const scheduleDeleteSchema = z.object({
  scheduleId: z.string().uuid(),
})

const usageLogSchema = z.object({
  labId: z.string().uuid(),
  scheduleId: z.string().uuid().optional().or(z.literal("")).or(z.literal("none")),
  courseName: z.string().min(3).max(200),
  groupName: z.string().min(1).max(100),
  studentCount: z.coerce.number().int().min(1).max(500),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  note: z.string().max(500).optional(),
  attendanceText: z.string().max(20000).optional(),
})

function parseAttendanceLines(text: string | undefined) {
  if (!text?.trim()) return []
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  return lines.map((line) => {
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

function parseWibDateTime(date: string, time: string) {
  const value = new Date(`${date}T${time}:00+07:00`)
  if (Number.isNaN(value.getTime())) throw new Error("Format tanggal/jam tidak valid.")
  return value
}

async function ensureNonMahasiswaAndLabAccess(labId: string) {
  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) return { error: "Sesi tidak valid." as const }
  if (session.user.role === "mahasiswa") return { error: "Akses ditolak." as const }
  if (session.user.role === "dosen") return { error: "Dosen tidak memiliki akses operasional penggunaan lab." as const }

  if (session.user.role === "petugas_plp") {
    const assignment = await db.query.userLabAssignments.findFirst({
      where: and(eq(userLabAssignments.userId, session.user.id), eq(userLabAssignments.labId, labId)),
      columns: { userId: true },
    })
    if (!assignment) return { error: "Anda tidak memiliki akses ke lab ini." as const }
  }

  return { session }
}

export async function createLabScheduleAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = scheduleSchema.safeParse({
    labId: formData.get("labId"),
    courseName: formData.get("courseName"),
    groupName: formData.get("groupName"),
    instructorName: formData.get("instructorName"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    capacity: formData.get("capacity"),
    enrolledCount: formData.get("enrolledCount") || 0,
  })
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." }

  const auth = await ensureNonMahasiswaAndLabAccess(parsed.data.labId)
  if ("error" in auth) return { ok: false, message: auth.error ?? "Akses ditolak." }

  let startAt: Date
  let endAt: Date
  try {
    startAt = parseWibDateTime(parsed.data.date, parsed.data.startTime)
    endAt = parseWibDateTime(parsed.data.date, parsed.data.endTime)
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Tanggal/jam tidak valid." }
  }
  if (endAt <= startAt) return { ok: false, message: "Jam selesai harus lebih besar dari jam mulai." }
  if (parsed.data.enrolledCount > parsed.data.capacity) {
    return { ok: false, message: "Jumlah peserta terdaftar tidak boleh melebihi kapasitas." }
  }

  await db.insert(labSchedules).values({
    labId: parsed.data.labId,
    courseName: parsed.data.courseName.trim(),
    groupName: parsed.data.groupName.trim(),
    instructorName: parsed.data.instructorName.trim(),
    scheduledStartAt: startAt,
    scheduledEndAt: endAt,
    capacity: parsed.data.capacity,
    enrolledCount: parsed.data.enrolledCount,
    createdByUserId: auth.session.user.id,
  })

  await writeSecurityAuditLog({
    category: "lab_usage",
    action: "create_schedule",
    outcome: "success",
    userId: auth.session.user.id,
    actorRole: auth.session.user.role,
    targetType: "lab",
    targetId: parsed.data.labId,
  })

  revalidatePath("/dashboard/lab-usage")
  return { ok: true, message: "Jadwal lab berhasil ditambahkan." }
}

export async function updateLabScheduleAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = scheduleUpdateSchema.safeParse({
    scheduleId: formData.get("scheduleId"),
    labId: formData.get("labId"),
    courseName: formData.get("courseName"),
    groupName: formData.get("groupName"),
    instructorName: formData.get("instructorName"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    capacity: formData.get("capacity"),
    enrolledCount: formData.get("enrolledCount") || 0,
  })
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." }

  const auth = await ensureNonMahasiswaAndLabAccess(parsed.data.labId)
  if ("error" in auth) return { ok: false, message: auth.error ?? "Akses ditolak." }

  const existing = await db.query.labSchedules.findFirst({
    where: eq(labSchedules.id, parsed.data.scheduleId),
    columns: { id: true, labId: true },
  })
  if (!existing) return { ok: false, message: "Jadwal tidak ditemukan." }

  if (auth.session.user.role === "petugas_plp" && existing.labId !== parsed.data.labId) {
    return { ok: false, message: "Perubahan lab tidak diizinkan untuk jadwal ini." }
  }

  let startAt: Date
  let endAt: Date
  try {
    startAt = parseWibDateTime(parsed.data.date, parsed.data.startTime)
    endAt = parseWibDateTime(parsed.data.date, parsed.data.endTime)
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Tanggal/jam tidak valid." }
  }
  if (endAt <= startAt) return { ok: false, message: "Jam selesai harus lebih besar dari jam mulai." }
  if (parsed.data.enrolledCount > parsed.data.capacity) {
    return { ok: false, message: "Jumlah peserta terdaftar tidak boleh melebihi kapasitas." }
  }

  await db
    .update(labSchedules)
    .set({
      labId: parsed.data.labId,
      courseName: parsed.data.courseName.trim(),
      groupName: parsed.data.groupName.trim(),
      instructorName: parsed.data.instructorName.trim(),
      scheduledStartAt: startAt,
      scheduledEndAt: endAt,
      capacity: parsed.data.capacity,
      enrolledCount: parsed.data.enrolledCount,
      updatedAt: new Date(),
    })
    .where(eq(labSchedules.id, parsed.data.scheduleId))

  await writeSecurityAuditLog({
    category: "lab_usage",
    action: "update_schedule",
    outcome: "success",
    userId: auth.session.user.id,
    actorRole: auth.session.user.role,
    targetType: "lab_schedule",
    targetId: parsed.data.scheduleId,
  })

  revalidatePath("/dashboard/lab-usage")
  return { ok: true, message: "Jadwal lab berhasil diperbarui." }
}

export async function deleteLabScheduleAction(formData: FormData) {
  await deleteLabScheduleWithFeedbackAction(null, formData)
}

export async function deleteLabScheduleWithFeedbackAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = scheduleDeleteSchema.safeParse({ scheduleId: formData.get("scheduleId") })
  if (!parsed.success) return { ok: false, message: "Data penghapusan tidak valid." }

  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role || session.user.role === "mahasiswa") {
    return { ok: false, message: "Akses ditolak." }
  }
  if (session.user.role === "dosen") {
    return { ok: false, message: "Dosen tidak memiliki akses operasional penggunaan lab." }
  }

  const schedule = await db.query.labSchedules.findFirst({
    where: eq(labSchedules.id, parsed.data.scheduleId),
    columns: { id: true, labId: true },
  })
  if (!schedule) return { ok: false, message: "Jadwal tidak ditemukan." }

  const auth = await ensureNonMahasiswaAndLabAccess(schedule.labId)
  if ("error" in auth) return { ok: false, message: auth.error ?? "Akses ditolak." }

  await db.delete(labSchedules).where(eq(labSchedules.id, parsed.data.scheduleId))
  await writeSecurityAuditLog({
    category: "lab_usage",
    action: "delete_schedule",
    outcome: "success",
    userId: auth.session.user.id,
    actorRole: auth.session.user.role,
    targetType: "lab_schedule",
    targetId: parsed.data.scheduleId,
  })
  revalidatePath("/dashboard/lab-usage")
  return { ok: true, message: "Jadwal lab berhasil dihapus." }
}

export async function createLabUsageLogAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = usageLogSchema.safeParse({
    labId: formData.get("labId"),
    scheduleId: formData.get("scheduleId"),
    courseName: formData.get("courseName"),
    groupName: formData.get("groupName"),
    studentCount: formData.get("studentCount"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    note: formData.get("note")?.toString() || undefined,
    attendanceText: formData.get("attendanceText")?.toString() || undefined,
  })
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." }

  const auth = await ensureNonMahasiswaAndLabAccess(parsed.data.labId)
  if ("error" in auth) return { ok: false, message: auth.error ?? "Akses ditolak." }

  let startedAt: Date
  let endedAt: Date
  try {
    startedAt = parseWibDateTime(parsed.data.date, parsed.data.startTime)
    endedAt = parseWibDateTime(parsed.data.date, parsed.data.endTime)
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Tanggal/jam tidak valid." }
  }
  if (endedAt <= startedAt) return { ok: false, message: "Jam selesai harus lebih besar dari jam mulai." }

  const attendanceRows = parseAttendanceLines(parsed.data.attendanceText)
  if (attendanceRows.length > 0 && attendanceRows.length !== parsed.data.studentCount) {
    return { ok: false, message: "Jumlah baris absensi harus sama dengan jumlah mahasiswa." }
  }

  await db.transaction(async (tx) => {
    const [usage] = await tx
      .insert(labUsageLogs)
      .values({
        labId: parsed.data.labId,
        scheduleId: !parsed.data.scheduleId || parsed.data.scheduleId === "none" ? null : parsed.data.scheduleId,
        courseName: parsed.data.courseName.trim(),
        groupName: parsed.data.groupName.trim(),
        studentCount: parsed.data.studentCount,
        startedAt,
        endedAt,
        createdByUserId: auth.session.user.id,
        note: parsed.data.note?.trim() || null,
      })
      .returning({ id: labUsageLogs.id })

    if (!usage) throw new Error("Gagal menyimpan riwayat penggunaan lab.")

    if (attendanceRows.length > 0) {
      await tx.insert(labUsageAttendances).values(
        attendanceRows.map((row) => ({
          usageLogId: usage.id,
          attendeeName: row.attendeeName,
          attendeeNim: row.attendeeNim,
        })),
      )
    }
  })

  await writeSecurityAuditLog({
    category: "lab_usage",
    action: "create_usage_log",
    outcome: "success",
    userId: auth.session.user.id,
    actorRole: auth.session.user.role,
    targetType: "lab",
    targetId: parsed.data.labId,
    metadata: { studentCount: parsed.data.studentCount, attendanceRows: attendanceRows.length },
  })

  revalidatePath("/dashboard/lab-usage")
  return { ok: true, message: "Riwayat penggunaan lab berhasil dicatat." }
}

export type LabUsageActionResult = ActionResult
