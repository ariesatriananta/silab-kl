import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { redirect } from "next/navigation"

import {
  ToolsPageClient,
  type ToolAssetEventRow,
  type ToolCreateLabOption,
  type ToolRow,
} from "@/components/tools/tools-page-client"
import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import { labs, toolAssetEvents, toolAssets, toolModels, userLabAssignments, users } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

type Role = "admin" | "mahasiswa" | "petugas_plp"

async function getAccessibleLabIds(role: Role, userId: string) {
  if (role === "admin" || role === "mahasiswa") return null
  const rows = await db
    .select({ labId: userLabAssignments.labId })
    .from(userLabAssignments)
    .where(eq(userLabAssignments.userId, userId))
  return rows.map((r) => r.labId)
}

async function getToolsData(role: Role, userId: string, accessibleLabIds: string[] | null) {
  const toolsWhere =
    role === "petugas_plp" && accessibleLabIds
      ? accessibleLabIds.length > 0
        ? inArray(toolModels.labId, accessibleLabIds)
        : sql`false`
      : undefined

  const labWhere =
    role === "petugas_plp" && accessibleLabIds
      ? accessibleLabIds.length > 0
        ? inArray(labs.id, accessibleLabIds)
        : sql`false`
      : undefined

  const [toolRows, labRows, eventRows] = await Promise.all([
    db
      .select({
        assetId: toolAssets.id,
        modelId: toolModels.id,
        assetCode: toolAssets.assetCode,
        inventoryCode: toolAssets.inventoryCode,
        qrCodeValue: toolAssets.qrCodeValue,
        status: toolAssets.status,
        condition: toolAssets.condition,
        assetNotes: toolAssets.notes,
        isActive: toolAssets.isActive,
        modelCode: toolModels.code,
        modelName: toolModels.name,
        brand: toolModels.brand,
        category: toolModels.category,
        locationDetail: toolModels.locationDetail,
        imageUrl: toolModels.imageUrl,
        description: toolModels.description,
        labId: toolModels.labId,
        labName: labs.name,
      })
      .from(toolAssets)
      .innerJoin(toolModels, eq(toolAssets.toolModelId, toolModels.id))
      .innerJoin(labs, eq(toolModels.labId, labs.id))
      .where(and(eq(toolModels.isActive, true), toolsWhere))
      .orderBy(asc(labs.name), asc(toolModels.name), asc(toolAssets.assetCode)),
    db
      .select({ id: labs.id, name: labs.name })
      .from(labs)
      .where(and(eq(labs.isActive, true), labWhere))
      .orderBy(asc(labs.name)),
    db
      .select({
        id: toolAssetEvents.id,
        toolAssetId: toolAssetEvents.toolAssetId,
        eventType: toolAssetEvents.eventType,
        conditionBefore: toolAssetEvents.conditionBefore,
        conditionAfter: toolAssetEvents.conditionAfter,
        statusBefore: toolAssetEvents.statusBefore,
        statusAfter: toolAssetEvents.statusAfter,
        note: toolAssetEvents.note,
        createdAt: toolAssetEvents.createdAt,
        actorName: users.fullName,
      })
      .from(toolAssetEvents)
      .leftJoin(users, eq(users.id, toolAssetEvents.actorUserId))
      .where(
        role === "petugas_plp" && accessibleLabIds
          ? accessibleLabIds.length > 0
            ? inArray(
                toolAssetEvents.toolAssetId,
                db
                  .select({ id: toolAssets.id })
                  .from(toolAssets)
                  .innerJoin(toolModels, eq(toolModels.id, toolAssets.toolModelId))
                  .where(inArray(toolModels.labId, accessibleLabIds)),
              )
            : sql`false`
          : undefined,
      )
      .orderBy(desc(toolAssetEvents.createdAt))
      .limit(300),
  ])

  const tools: ToolRow[] = toolRows.map((row) => ({
    assetId: row.assetId,
    modelId: row.modelId,
    assetCode: row.assetCode,
    inventoryCode: row.inventoryCode,
    qrCodeValue: row.qrCodeValue,
    status: row.status,
    condition: row.condition,
    assetNotes: row.assetNotes,
    isActive: row.isActive,
    modelCode: row.modelCode,
    name: row.modelName,
    brand: row.brand,
    category: row.category,
    locationDetail: row.locationDetail,
    imageUrl: row.imageUrl,
    description: row.description,
    labId: row.labId,
    lab: row.labName,
  }))

  const events: ToolAssetEventRow[] = eventRows.map((row) => ({
    id: row.id,
    toolAssetId: row.toolAssetId,
    eventType: row.eventType,
    conditionBefore: row.conditionBefore,
    conditionAfter: row.conditionAfter,
    statusBefore: row.statusBefore,
    statusAfter: row.statusAfter,
    note: row.note,
    actorName: row.actorName ?? "-",
    createdAtIso: row.createdAt.toISOString(),
  }))

  const createLabs: ToolCreateLabOption[] = labRows.map((lab) => ({ id: lab.id, name: lab.name }))
  return { tools, createLabs, events }
}

export default async function ToolsPage() {
  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) redirect("/")

  const role = session.user.role as Role
  if (role === "mahasiswa") redirect("/dashboard/student-tools")

  const accessibleLabIds = await getAccessibleLabIds(role, session.user.id)
  const { tools, createLabs, events } = await getToolsData(role, session.user.id, accessibleLabIds)

  return <ToolsPageClient role={role} data={tools} masterLabs={createLabs} events={events} />
}

