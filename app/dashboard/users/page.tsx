import { asc, desc, eq, inArray, or, sql } from "drizzle-orm"
import { redirect } from "next/navigation"

import {
  UsersPageClient,
  type UserAuditRow,
  type UserLabOption,
  type UserManagementRow,
} from "@/components/users/users-page-client"
import { db } from "@/lib/db/client"
import { getServerAuthSession } from "@/lib/auth/server"
import { labs, securityAuditLogs, userLabAssignments, users } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

export default async function UsersManagementPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getServerAuthSession()
  if (!session?.user?.id || session.user.role !== "admin") {
    redirect("/dashboard")
  }

  const sp = (await searchParams) ?? {}
  const auditPageRaw = Array.isArray(sp.auditPage) ? sp.auditPage[0] : sp.auditPage
  const auditPage = Math.max(1, Number.parseInt(auditPageRaw ?? "1", 10) || 1)
  const auditPageSize = 25
  const auditOffset = (auditPage - 1) * auditPageSize

  const [userRows, labRows, assignmentRows, auditRows, auditCountRows] = await Promise.all([
    db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        email: users.email,
        nip: users.nip,
        nim: users.nim,
        isActive: users.isActive,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.role), asc(users.fullName)),
    db
      .select({ id: labs.id, name: labs.name })
      .from(labs)
      .where(eq(labs.isActive, true))
      .orderBy(asc(labs.name)),
    db.select({ userId: userLabAssignments.userId, labId: userLabAssignments.labId }).from(userLabAssignments),
    db
      .select({
        id: securityAuditLogs.id,
        category: securityAuditLogs.category,
        action: securityAuditLogs.action,
        outcome: securityAuditLogs.outcome,
        userId: securityAuditLogs.userId,
        targetType: securityAuditLogs.targetType,
        targetId: securityAuditLogs.targetId,
        identifier: securityAuditLogs.identifier,
        metadataJson: securityAuditLogs.metadataJson,
        createdAt: securityAuditLogs.createdAt,
      })
      .from(securityAuditLogs)
      .where(or(eq(securityAuditLogs.category, "user_management"), eq(securityAuditLogs.targetType, "user")))
      .orderBy(desc(securityAuditLogs.createdAt))
      .limit(auditPageSize)
      .offset(auditOffset),
    db
      .select({ total: sql<number>`count(*)` })
      .from(securityAuditLogs)
      .where(or(eq(securityAuditLogs.category, "user_management"), eq(securityAuditLogs.targetType, "user"))),
  ])

  const assignmentsByUser = assignmentRows.reduce<Record<string, string[]>>((acc, row) => {
    acc[row.userId] ??= []
    acc[row.userId].push(row.labId)
    return acc
  }, {})

  const labsById = new Map(labRows.map((l) => [l.id, l.name]))

  const rows: UserManagementRow[] = userRows.map((u) => ({
    id: u.id,
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    email: u.email,
    nip: u.nip,
    nim: u.nim,
    isActive: u.isActive,
    createdAt: new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    }).format(u.createdAt),
    assignedLabIds: assignmentsByUser[u.id] ?? [],
    assignedLabNames: (assignmentsByUser[u.id] ?? []).map((id) => labsById.get(id) ?? id),
  }))

  const labsOptions: UserLabOption[] = labRows.map((l) => ({ id: l.id, name: l.name }))
  const actorIds = Array.from(new Set(auditRows.map((r) => r.userId).filter((v): v is string => !!v)))
  const actorMap =
    actorIds.length === 0
      ? new Map<string, string>()
      : new Map(
          (
            await db
              .select({ id: users.id, fullName: users.fullName, username: users.username })
              .from(users)
              .where(inArray(users.id, actorIds))
          ).map((u) => [u.id, `${u.fullName} (${u.username})`]),
        )

  const userAuditRows: UserAuditRow[] = auditRows.map((row) => ({
    id: row.id,
    createdAt: new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    }).format(row.createdAt),
    category: row.category,
    action: row.action,
    outcome: row.outcome as "success" | "failure" | "blocked",
    actorLabel: row.userId ? (actorMap.get(row.userId) ?? row.userId) : "Sistem",
    identifier: row.identifier,
    targetType: row.targetType,
    targetId: row.targetId,
    metadataSummary: row.metadataJson,
  }))

  const auditTotalItems = Number(auditCountRows[0]?.total ?? 0)
  const auditTotalPages = Math.max(1, Math.ceil(auditTotalItems / auditPageSize))

  return (
    <UsersPageClient
      rows={rows}
      labs={labsOptions}
      auditRows={userAuditRows}
      auditPagination={{
        page: Math.min(auditPage, auditTotalPages),
        pageSize: auditPageSize,
        totalItems: auditTotalItems,
        totalPages: auditTotalPages,
      }}
    />
  )
}
