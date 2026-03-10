import { asc, eq, sql } from "drizzle-orm"
import { redirect } from "next/navigation"

import { LabsPageClient, type LabManagementRow } from "@/components/labs/labs-page-client"
import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import { consumableItems, labs, toolModels, userLabAssignments } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

export default async function LabsPage() {
  const session = await getServerAuthSession()
  if (!session?.user?.id || session.user.role !== "admin") redirect("/dashboard")

  const [labRows, assignmentRows, toolRows, consumableRows] = await Promise.all([
    db
      .select({
        id: labs.id,
        code: labs.code,
        name: labs.name,
        description: labs.description,
        isActive: labs.isActive,
        createdAt: labs.createdAt,
      })
      .from(labs)
      .orderBy(asc(labs.name)),
    db
      .select({
        labId: userLabAssignments.labId,
        total: sql<number>`count(*)`,
      })
      .from(userLabAssignments)
      .groupBy(userLabAssignments.labId),
    db
      .select({
        labId: toolModels.labId,
        total: sql<number>`count(*)`,
      })
      .from(toolModels)
      .groupBy(toolModels.labId),
    db
      .select({
        labId: consumableItems.labId,
        total: sql<number>`count(*)`,
      })
      .from(consumableItems)
      .groupBy(consumableItems.labId),
  ])

  const assignmentMap = new Map(assignmentRows.map((row) => [row.labId, Number(row.total)]))
  const toolMap = new Map(toolRows.map((row) => [row.labId, Number(row.total)]))
  const consumableMap = new Map(consumableRows.map((row) => [row.labId, Number(row.total)]))

  const rows: LabManagementRow[] = labRows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt?.toISOString() ?? null,
    assignmentCount: assignmentMap.get(row.id) ?? 0,
    toolModelCount: toolMap.get(row.id) ?? 0,
    consumableCount: consumableMap.get(row.id) ?? 0,
  }))

  return <LabsPageClient rows={rows} />
}
