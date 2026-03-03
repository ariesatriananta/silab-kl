import { asc, eq } from "drizzle-orm"
import { redirect } from "next/navigation"

import {
  StudentLabSchedulePageClient,
  type StudentLabScheduleRow,
} from "@/components/student-lab-schedule/student-lab-schedule-page-client"
import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import { labSchedules, labs } from "@/lib/db/schema"

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date)
}

function formatTimeLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Jakarta",
  }).format(date)
}

function formatDateKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date)
}

export default async function StudentLabSchedulePage() {
  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) redirect("/")
  if (session.user.role !== "mahasiswa") redirect("/dashboard")

  const rows = await db
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
    .where(eq(labs.isActive, true))
    .orderBy(asc(labSchedules.scheduledStartAt))
    .limit(300)

  const now = new Date()
  const data: StudentLabScheduleRow[] = rows.map((row) => {
    const status: StudentLabScheduleRow["status"] =
      row.scheduledStartAt <= now && now < row.scheduledEndAt
        ? "ongoing"
        : row.scheduledStartAt > now
          ? "upcoming"
          : "finished"
    return {
      id: row.id,
      labId: row.labId,
      labName: row.labName,
      courseName: row.courseName,
      groupName: row.groupName,
      instructorName: row.instructorName,
      dateLabel: formatDateLabel(row.scheduledStartAt),
      dateKey: formatDateKey(row.scheduledStartAt),
      startTimeLabel: formatTimeLabel(row.scheduledStartAt),
      endTimeLabel: formatTimeLabel(row.scheduledEndAt),
      startAtMs: row.scheduledStartAt.getTime(),
      capacity: row.capacity,
      enrolledCount: row.enrolledCount,
      status,
    }
  })

  return <StudentLabSchedulePageClient rows={data} />
}
