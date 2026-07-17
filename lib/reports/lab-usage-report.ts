import "server-only"
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { labRoomBookingRequests, labUsageAttendances, labUsageLogs, labs, userLabAssignments, users } from "@/lib/db/schema"

export type LabUsageReportFilters = { labId: string; startDate: string; endDate: string }
export const LAB_USAGE_PROOF_BULK_LIMIT = 50

export type LabUsageProofBulkAttendance = {
  attendeeName: string
  attendeeNim: string | null
}

export type LabUsageProofBulkRow = {
  usageId: string
  labName: string
  courseName: string
  groupName: string
  studentCount: number
  startedAt: Date
  endedAt: Date
  note: string | null
  bookingId: string | null
  studyProgram: string | null
  semesterClassLabel: string | null
  materialTopic: string | null
  advisorLecturerName: string | null
  approvedAt: Date | null
  approverName: string | null
  approverNip: string | null
  attendance: LabUsageProofBulkAttendance[]
}

export function getLabUsageReportFilters(input: Record<string, string | string[] | undefined>): LabUsageReportFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] ?? "" : v ?? "")
  const date = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "")
  return { labId: first(input.labId), startDate: date(first(input.startDate)), endDate: date(first(input.endDate)) }
}
function boundary(value: string, end: boolean) {
  return value ? new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}+07:00`) : undefined
}
export async function getLabUsageReportData(input: { role: "admin" | "petugas_plp"; userId: string; filters: LabUsageReportFilters }) {
  const assigned = input.role === "petugas_plp"
    ? (await db.select({ labId: userLabAssignments.labId }).from(userLabAssignments).where(eq(userLabAssignments.userId, input.userId))).map((x) => x.labId)
    : []
  const start = boundary(input.filters.startDate, false)
  const end = boundary(input.filters.endDate, true)
  const conditions = [
    input.role === "petugas_plp" ? (assigned.length ? inArray(labUsageLogs.labId, assigned) : sql`false`) : undefined,
    input.filters.labId ? eq(labUsageLogs.labId, input.filters.labId) : undefined,
    start ? gte(labUsageLogs.endedAt, start) : undefined,
    end ? lte(labUsageLogs.startedAt, end) : undefined,
  ]
  const where = and(...conditions)
  const usage = await db.select({ id: labUsageLogs.id, labName: labs.name, courseName: labUsageLogs.courseName, groupName: labUsageLogs.groupName, studentCount: labUsageLogs.studentCount, startedAt: labUsageLogs.startedAt, endedAt: labUsageLogs.endedAt, note: labUsageLogs.note })
    .from(labUsageLogs).innerJoin(labs, eq(labs.id, labUsageLogs.labId)).where(where).orderBy(asc(labUsageLogs.startedAt))
  const ids = usage.map((x) => x.id)
  const attendance = ids.length ? await db.select({ usageLogId: labUsageAttendances.usageLogId, attendeeName: labUsageAttendances.attendeeName, attendeeNim: labUsageAttendances.attendeeNim })
    .from(labUsageAttendances).where(inArray(labUsageAttendances.usageLogId, ids)).orderBy(asc(labUsageAttendances.createdAt)) : []
  return { usage, attendance, filters: input.filters, generatedAt: new Date() }
}

export async function getLabUsageProofBulkData(input: {
  role: "admin" | "petugas_plp"
  userId: string
  filters: LabUsageReportFilters
  limit?: number
}) {
  const limit = input.limit ?? LAB_USAGE_PROOF_BULK_LIMIT
  const assigned =
    input.role === "petugas_plp"
      ? (
          await db
            .select({ labId: userLabAssignments.labId })
            .from(userLabAssignments)
            .where(eq(userLabAssignments.userId, input.userId))
        ).map((x) => x.labId)
      : []
  const start = boundary(input.filters.startDate, false)
  const end = boundary(input.filters.endDate, true)
  const conditions = [
    input.role === "petugas_plp" ? (assigned.length ? inArray(labUsageLogs.labId, assigned) : sql`false`) : undefined,
    input.filters.labId ? eq(labUsageLogs.labId, input.filters.labId) : undefined,
    start ? gte(labUsageLogs.endedAt, start) : undefined,
    end ? lte(labUsageLogs.startedAt, end) : undefined,
  ]
  const where = and(...conditions)
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
    .where(where)
    .orderBy(asc(labUsageLogs.startedAt))
    .limit(limit + 1)

  const limitedRows = usage.slice(0, limit)
  const ids = limitedRows.map((x) => x.usageId)
  if (ids.length === 0) return { rows: [] as LabUsageProofBulkRow[], truncated: false, limit }

  const attendance = await db
    .select({
      usageLogId: labUsageAttendances.usageLogId,
      attendeeName: labUsageAttendances.attendeeName,
      attendeeNim: labUsageAttendances.attendeeNim,
    })
    .from(labUsageAttendances)
    .where(inArray(labUsageAttendances.usageLogId, ids))
    .orderBy(asc(labUsageAttendances.createdAt))

  const attendanceByUsage = new Map<string, LabUsageProofBulkAttendance[]>()
  for (const item of attendance) {
    const list = attendanceByUsage.get(item.usageLogId) ?? []
    list.push({
      attendeeName: item.attendeeName,
      attendeeNim: item.attendeeNim,
    })
    attendanceByUsage.set(item.usageLogId, list)
  }

  return {
    rows: limitedRows.map((row) => ({
      ...row,
      attendance: attendanceByUsage.get(row.usageId) ?? [],
    })),
    truncated: usage.length > limit,
    limit,
  }
}
