import { and, asc, desc, eq, gte, ilike, inArray, lte, or } from "drizzle-orm"
import { redirect } from "next/navigation"

import {
  StudentLabSchedulePageClient,
  type StudentLabAvailabilityFilters,
  type StudentLabAvailabilityPagination,
  type StudentLabBookingRow,
  type StudentLabBookingRouteOption,
  type StudentLabScheduleRow,
} from "@/components/student-lab-schedule/student-lab-schedule-page-client"
import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import { labRoomBookingRequests, labSchedules, labs, userLabAssignments, users } from "@/lib/db/schema"

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

const AVAILABILITY_PAGE_SIZE = 24
const AVAILABILITY_PAST_DAYS = 7
const AVAILABILITY_FUTURE_DAYS = 60

type SearchParamsInput = Promise<Record<string, string | string[] | undefined>>

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function addDays(date: Date, days: number) {
  const copy = new Date(date)
  copy.setDate(copy.getDate() + days)
  return copy
}

export default async function StudentLabSchedulePage({
  searchParams,
}: {
  searchParams: SearchParamsInput
}) {
  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) redirect("/")
  if (session.user.role !== "mahasiswa") redirect("/dashboard")

  const params = await searchParams
  const availabilitySearch = (getSingleParam(params.search) ?? "").trim()
  const availabilityLabId = (getSingleParam(params.lab) ?? "all").trim()
  const availabilityPageParam = Number.parseInt(getSingleParam(params.page) ?? "1", 10)
  const availabilityPage =
    Number.isFinite(availabilityPageParam) && availabilityPageParam > 0 ? availabilityPageParam : 1

  const now = new Date()
  const windowStart = addDays(now, -AVAILABILITY_PAST_DAYS)
  const windowEnd = addDays(now, AVAILABILITY_FUTURE_DAYS)

  const availabilityLabFilter =
    availabilityLabId !== "all" ? eq(labs.id, availabilityLabId) : undefined
  const availabilityKeywordFilter = availabilitySearch
    ? or(
        ilike(labSchedules.courseName, `%${availabilitySearch}%`),
        ilike(labSchedules.groupName, `%${availabilitySearch}%`),
        ilike(labSchedules.instructorName, `%${availabilitySearch}%`),
        ilike(labs.name, `%${availabilitySearch}%`),
      )
    : undefined
  const bookingKeywordFilter = availabilitySearch
    ? or(
        ilike(labRoomBookingRequests.courseName, `%${availabilitySearch}%`),
        ilike(labRoomBookingRequests.groupName, `%${availabilitySearch}%`),
        ilike(labRoomBookingRequests.advisorLecturerName, `%${availabilitySearch}%`),
        ilike(labs.name, `%${availabilitySearch}%`),
      )
    : undefined

  const [scheduleRows, pendingBookingRows, myBookingRows, labRows, assignmentRows] = await Promise.all([
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
      })
      .from(labSchedules)
      .innerJoin(labs, eq(labs.id, labSchedules.labId))
      .where(
        and(
          eq(labs.isActive, true),
          availabilityLabFilter,
          availabilityKeywordFilter,
          gte(labSchedules.scheduledEndAt, windowStart),
          lte(labSchedules.scheduledStartAt, windowEnd),
        ),
      )
      .orderBy(asc(labSchedules.scheduledStartAt))
      .limit(160),
    db
      .select({
        id: labRoomBookingRequests.id,
        labId: labRoomBookingRequests.labId,
        labName: labs.name,
        courseName: labRoomBookingRequests.courseName,
        groupName: labRoomBookingRequests.groupName,
        advisorLecturerName: labRoomBookingRequests.advisorLecturerName,
        plannedStartAt: labRoomBookingRequests.plannedStartAt,
        plannedEndAt: labRoomBookingRequests.plannedEndAt,
      })
      .from(labRoomBookingRequests)
      .innerJoin(labs, eq(labs.id, labRoomBookingRequests.labId))
      .where(
        and(
          inArray(labRoomBookingRequests.status, ["pending"]),
          eq(labs.isActive, true),
          availabilityLabFilter,
          bookingKeywordFilter,
          gte(labRoomBookingRequests.plannedEndAt, windowStart),
          lte(labRoomBookingRequests.plannedStartAt, windowEnd),
        ),
      )
      .orderBy(asc(labRoomBookingRequests.plannedStartAt))
      .limit(160),
    db
      .select({
        id: labRoomBookingRequests.id,
        code: labRoomBookingRequests.code,
        labId: labRoomBookingRequests.labId,
        labName: labs.name,
        status: labRoomBookingRequests.status,
        courseName: labRoomBookingRequests.courseName,
        materialTopic: labRoomBookingRequests.materialTopic,
        studyProgram: labRoomBookingRequests.studyProgram,
        semesterClassLabel: labRoomBookingRequests.semesterClassLabel,
        groupName: labRoomBookingRequests.groupName,
        advisorLecturerName: labRoomBookingRequests.advisorLecturerName,
        plannedStartAt: labRoomBookingRequests.plannedStartAt,
        plannedEndAt: labRoomBookingRequests.plannedEndAt,
        note: labRoomBookingRequests.note,
        rejectionReason: labRoomBookingRequests.rejectionReason,
        usageLogId: labRoomBookingRequests.usageLogId,
      })
      .from(labRoomBookingRequests)
      .innerJoin(labs, eq(labs.id, labRoomBookingRequests.labId))
      .where(eq(labRoomBookingRequests.requesterUserId, session.user.id))
      .orderBy(desc(labRoomBookingRequests.createdAt))
      .limit(100),
    db.select({ id: labs.id, name: labs.name }).from(labs).where(eq(labs.isActive, true)).orderBy(asc(labs.name)),
    db
      .select({
        labId: userLabAssignments.labId,
        userId: users.id,
        fullName: users.fullName,
        identifier: users.nip,
        role: users.role,
      })
      .from(userLabAssignments)
      .innerJoin(users, eq(users.id, userLabAssignments.userId))
      .where(inArray(users.role, ["dosen", "petugas_plp"])),
  ])

  const scheduleDataAll: StudentLabScheduleRow[] = [
    ...scheduleRows.map((row) => {
      const status: StudentLabScheduleRow["status"] =
        row.scheduledStartAt <= now && now < row.scheduledEndAt
          ? "ongoing"
          : row.scheduledStartAt > now
            ? "upcoming"
            : "finished"
      return {
        id: row.id,
        source: "schedule" as const,
        sourceStatus: "final" as const,
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
        endAtMs: row.scheduledEndAt.getTime(),
        status,
      }
    }),
    ...pendingBookingRows.map((row) => {
      const status: StudentLabScheduleRow["status"] =
        row.plannedStartAt <= now && now < row.plannedEndAt
          ? "ongoing"
          : row.plannedStartAt > now
            ? "upcoming"
            : "finished"
      return {
        id: row.id,
        source: "booking_request" as const,
        sourceStatus: "pending" as const,
        labId: row.labId,
        labName: row.labName,
        courseName: row.courseName,
        groupName: row.groupName,
        instructorName: row.advisorLecturerName,
        dateLabel: formatDateLabel(row.plannedStartAt),
        dateKey: formatDateKey(row.plannedStartAt),
        startTimeLabel: formatTimeLabel(row.plannedStartAt),
        endTimeLabel: formatTimeLabel(row.plannedEndAt),
        startAtMs: row.plannedStartAt.getTime(),
        endAtMs: row.plannedEndAt.getTime(),
        status,
      }
    }),
  ].sort((a, b) => {
    const statusOrder: Record<StudentLabScheduleRow["status"], number> = {
      ongoing: 0,
      upcoming: 1,
      finished: 2,
    }
    const statusDiff = statusOrder[a.status] - statusOrder[b.status]
    if (statusDiff !== 0) return statusDiff
    return a.startAtMs - b.startAtMs
  })

  const availabilityTotalItems = scheduleDataAll.length
  const availabilityTotalPages = Math.max(1, Math.ceil(availabilityTotalItems / AVAILABILITY_PAGE_SIZE))
  const normalizedAvailabilityPage = Math.min(Math.max(1, availabilityPage), availabilityTotalPages)
  const availabilitySliceStart = (normalizedAvailabilityPage - 1) * AVAILABILITY_PAGE_SIZE
  const scheduleData = scheduleDataAll.slice(
    availabilitySliceStart,
    availabilitySliceStart + AVAILABILITY_PAGE_SIZE,
  )

  const myBookings: StudentLabBookingRow[] = myBookingRows.map((row) => ({
    id: row.id,
    code: row.code,
    labId: row.labId,
    labName: row.labName,
    status: row.status,
    courseName: row.courseName,
    materialTopic: row.materialTopic,
    studyProgram: row.studyProgram,
    semesterClassLabel: row.semesterClassLabel,
    groupName: row.groupName,
    advisorLecturerName: row.advisorLecturerName,
    plannedDateLabel: formatDateLabel(row.plannedStartAt),
    plannedTimeLabel: `${formatTimeLabel(row.plannedStartAt)} - ${formatTimeLabel(row.plannedEndAt)}`,
    note: row.note,
    rejectionReason: row.rejectionReason,
    usageLogId: row.usageLogId,
    canCancel:
      (row.status === "pending" || row.status === "approved") &&
      !row.usageLogId &&
      row.plannedStartAt.getTime() > Date.now(),
    canFillUsage: row.status === "approved" && !row.usageLogId,
    canPrintUsage: Boolean(row.usageLogId),
  }))

  const routeOptionsByLab = new Map<
    string,
    {
      dosen: Array<{ id: string; name: string }>
      plp: Array<{ id: string; name: string; identifier: string | null }>
    }
  >()

  for (const row of assignmentRows) {
    const current = routeOptionsByLab.get(row.labId) ?? { dosen: [], plp: [] }
    if (row.role === "dosen") {
      current.dosen.push({ id: row.userId, name: row.fullName })
    }
    if (row.role === "petugas_plp") {
      current.plp.push({ id: row.userId, name: row.fullName, identifier: row.identifier })
    }
    routeOptionsByLab.set(row.labId, current)
  }

  const bookingRoutes: StudentLabBookingRouteOption[] = labRows.map((lab) => {
    const route = routeOptionsByLab.get(lab.id) ?? { dosen: [], plp: [] }
    return {
      labId: lab.id,
      lecturers: route.dosen,
      plpApprovers: route.plp,
    }
  })

  const availabilityFilters: StudentLabAvailabilityFilters = {
    search: availabilitySearch,
    labId: availabilityLabId,
    windowLabel: `${AVAILABILITY_PAST_DAYS} hari ke belakang sampai ${AVAILABILITY_FUTURE_DAYS} hari ke depan`,
    totalItems: availabilityTotalItems,
  }

  const availabilityPagination: StudentLabAvailabilityPagination = {
    page: normalizedAvailabilityPage,
    pageSize: AVAILABILITY_PAGE_SIZE,
    totalItems: availabilityTotalItems,
    totalPages: availabilityTotalPages,
    showingFrom: availabilityTotalItems === 0 ? 0 : availabilitySliceStart + 1,
    showingTo: Math.min(availabilitySliceStart + AVAILABILITY_PAGE_SIZE, availabilityTotalItems),
  }

  return (
    <StudentLabSchedulePageClient
      rows={scheduleData}
      labs={labRows}
      myBookings={myBookings}
      bookingRoutes={bookingRoutes}
      availabilityFilters={availabilityFilters}
      availabilityPagination={availabilityPagination}
    />
  )
}
