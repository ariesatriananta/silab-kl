import { redirect } from "next/navigation"
import { asc, desc, eq, inArray, sql } from "drizzle-orm"

import {
  LabUsagePageClient,
  type LabUsageAttendanceRow,
  type LabUsageHistoryRow,
  type LabUsageLabOption,
  type LabUsageScheduleRow,
} from "@/components/lab-usage/lab-usage-page-client"
import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import { labSchedules, labUsageAttendances, labUsageLogs, labs, userLabAssignments } from "@/lib/db/schema"

type Role = "admin" | "mahasiswa" | "petugas_plp"

function fmtDate(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date)
}

function fmtDateInput(date: Date) {
  const dt = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Jakarta" }))
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const dd = String(dt.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function fmtTime(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(date)
}

function fmtTimeInput(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).formatToParts(date)
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00"
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00"
  return `${hh}:${mm}`
}

function fmtDuration(start: Date, end: Date) {
  const minutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h} jam ${m} menit`
  if (h > 0) return `${h} jam`
  return `${m} menit`
}

async function getAccessibleLabIds(role: Role, userId: string) {
  if (role === "admin") return null
  const rows = await db
    .select({ labId: userLabAssignments.labId })
    .from(userLabAssignments)
    .where(eq(userLabAssignments.userId, userId))
  return rows.map((r) => r.labId)
}

export default async function LabUsagePage() {
  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) redirect("/")

  const role = session.user.role as Role
  if (role === "mahasiswa") redirect("/dashboard/student-tools")

  const accessibleLabIds = await getAccessibleLabIds(role, session.user.id)
  const scheduleFilter =
    role === "admin"
      ? undefined
      : accessibleLabIds && accessibleLabIds.length > 0
        ? inArray(labSchedules.labId, accessibleLabIds)
        : sql`false`
  const usageFilter =
    role === "admin"
      ? undefined
      : accessibleLabIds && accessibleLabIds.length > 0
        ? inArray(labUsageLogs.labId, accessibleLabIds)
        : sql`false`
  const labsFilter =
    role === "admin"
      ? undefined
      : accessibleLabIds && accessibleLabIds.length > 0
        ? inArray(labs.id, accessibleLabIds)
        : sql`false`

  const [labRows, scheduleRowsRaw, historyRowsRaw, attendanceRowsRaw] = await Promise.all([
    db.select({ id: labs.id, name: labs.name }).from(labs).where(labsFilter).orderBy(asc(labs.name)),
    db
      .select({
        id: labSchedules.id,
        labId: labSchedules.labId,
        labName: labs.name,
        courseName: labSchedules.courseName,
        groupName: labSchedules.groupName,
        instructorName: labSchedules.instructorName,
        scheduledStartAt: labSchedules.scheduledStartAt,
        scheduledEndAt: labSchedules.scheduledEndAt,
        capacity: labSchedules.capacity,
        enrolledCount: labSchedules.enrolledCount,
      })
      .from(labSchedules)
      .innerJoin(labs, eq(labs.id, labSchedules.labId))
      .where(scheduleFilter)
      .orderBy(asc(labSchedules.scheduledStartAt))
      .limit(100),
    db
      .select({
        id: labUsageLogs.id,
        labId: labUsageLogs.labId,
        labName: labs.name,
        courseName: labUsageLogs.courseName,
        groupName: labUsageLogs.groupName,
        studentCount: labUsageLogs.studentCount,
        startedAt: labUsageLogs.startedAt,
        endedAt: labUsageLogs.endedAt,
      })
      .from(labUsageLogs)
      .innerJoin(labs, eq(labs.id, labUsageLogs.labId))
      .where(usageFilter)
      .orderBy(desc(labUsageLogs.startedAt))
      .limit(100),
    db
      .select({
        usageLogId: labUsageAttendances.usageLogId,
        attendeeName: labUsageAttendances.attendeeName,
        attendeeNim: labUsageAttendances.attendeeNim,
      })
      .from(labUsageAttendances)
      .innerJoin(labUsageLogs, eq(labUsageLogs.id, labUsageAttendances.usageLogId))
      .where(usageFilter)
      .orderBy(asc(labUsageAttendances.createdAt)),
  ])

  const labOptions: LabUsageLabOption[] = labRows.map((r) => ({ id: r.id, name: r.name }))
  const schedules: LabUsageScheduleRow[] = scheduleRowsRaw.map((r) => ({
    id: r.id,
    labId: r.labId,
    labName: r.labName,
    courseName: r.courseName,
    groupName: r.groupName,
    instructorName: r.instructorName,
    scheduledDate: fmtDateInput(r.scheduledStartAt),
    startTime: fmtTimeInput(r.scheduledStartAt),
    endTime: fmtTimeInput(r.scheduledEndAt),
    capacity: r.capacity,
    enrolledCount: r.enrolledCount,
  }))
  const attendanceMap = new Map<string, LabUsageAttendanceRow[]>()
  for (const row of attendanceRowsRaw) {
    const list = attendanceMap.get(row.usageLogId) ?? []
    list.push({
      attendeeName: row.attendeeName,
      attendeeNim: row.attendeeNim,
    })
    attendanceMap.set(row.usageLogId, list)
  }

  const history: LabUsageHistoryRow[] = historyRowsRaw.map((r) => ({
    id: r.id.slice(0, 8),
    labId: r.labId,
    labName: r.labName,
    courseName: r.courseName,
    groupName: r.groupName,
    studentCount: r.studentCount,
    date: fmtDate(r.startedAt),
    startTime: fmtTime(r.startedAt),
    endTime: fmtTime(r.endedAt),
    durationLabel: fmtDuration(r.startedAt, r.endedAt),
    attendance: attendanceMap.get(r.id) ?? [],
  }))

  return <LabUsagePageClient role={role as "admin" | "petugas_plp"} labs={labOptions} schedules={schedules} history={history} />
}
