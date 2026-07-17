import "server-only"
import { and, asc, eq, gte, inArray, lte, sql } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { labUsageAttendances, labUsageLogs, labs, userLabAssignments } from "@/lib/db/schema"

export type LabUsageReportFilters = { labId: string; startDate: string; endDate: string }
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
