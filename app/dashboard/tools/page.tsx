import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm"
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

type ToolsFilters = {
  q: string
  lab: string
  category: string
  page: number
  pageSize: number
}

async function getToolsData(
  role: Role,
  userId: string,
  accessibleLabIds: string[] | null,
  filters: ToolsFilters,
) {
  const baseToolsWhere =
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

  const searchConditions = filters.q
    ? or(
        ilike(toolModels.name, `%${filters.q}%`),
        ilike(toolAssets.assetCode, `%${filters.q}%`),
        ilike(toolModels.code, `%${filters.q}%`),
        ilike(toolAssets.inventoryCode, `%${filters.q}%`),
      )
    : undefined
  const selectedLabCondition = filters.lab !== "all" ? eq(toolModels.labId, filters.lab) : undefined
  const selectedCategoryCondition = filters.category !== "all" ? eq(toolModels.category, filters.category) : undefined

  const filteredToolsWhere = and(
    eq(toolModels.isActive, true),
    baseToolsWhere,
    selectedLabCondition,
    selectedCategoryCondition,
    searchConditions,
  )

  const offset = (filters.page - 1) * filters.pageSize

  const [toolRows, totalRows, labRows, categoryRows, eventRows, kpiRows] = await Promise.all([
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
      .where(filteredToolsWhere)
      .orderBy(asc(labs.name), asc(toolModels.name), asc(toolAssets.assetCode))
      .limit(filters.pageSize)
      .offset(offset),
    db
      .select({ total: count() })
      .from(toolAssets)
      .innerJoin(toolModels, eq(toolAssets.toolModelId, toolModels.id))
      .where(filteredToolsWhere),
    db
      .select({ id: labs.id, name: labs.name })
      .from(labs)
      .where(and(eq(labs.isActive, true), labWhere))
      .orderBy(asc(labs.name)),
    db
      .selectDistinct({ category: toolModels.category })
      .from(toolModels)
      .where(and(eq(toolModels.isActive, true), baseToolsWhere))
      .orderBy(asc(toolModels.category)),
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
    db
      .select({
        status: toolAssets.status,
        total: count(),
      })
      .from(toolAssets)
      .innerJoin(toolModels, eq(toolModels.id, toolAssets.toolModelId))
      .where(and(eq(toolModels.isActive, true), baseToolsWhere))
      .groupBy(toolAssets.status),
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
  const totalFiltered = totalRows[0]?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalFiltered / filters.pageSize))

  const kpiMap = new Map<string, number>()
  for (const row of kpiRows) kpiMap.set(row.status, Number(row.total))
  const kpi = {
    totalUnits: Array.from(kpiMap.values()).reduce((sum, n) => sum + n, 0),
    available: kpiMap.get("available") ?? 0,
    borrowed: kpiMap.get("borrowed") ?? 0,
    issue: (kpiMap.get("maintenance") ?? 0) + (kpiMap.get("damaged") ?? 0),
  }

  return {
    tools,
    createLabs,
    events,
    filterLabs: labRows.map((lab) => lab.name),
    filterCategories: categoryRows.map((row) => row.category),
    kpi,
    pagination: {
      page: Math.min(filters.page, totalPages),
      pageSize: filters.pageSize,
      totalItems: totalFiltered,
      totalPages,
    },
    filters: {
      q: filters.q,
      lab: filters.lab,
      category: filters.category,
    },
  }
}

export default async function ToolsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) redirect("/")

  const role = session.user.role as Role
  if (role === "mahasiswa") redirect("/dashboard/student-tools")

  const accessibleLabIds = await getAccessibleLabIds(role, session.user.id)
  const params = (await searchParams) ?? {}
  const getSingle = (key: string) => {
    const value = params[key]
    return Array.isArray(value) ? value[0] : value
  }
  const pageNum = Number.parseInt(getSingle("page") ?? "1", 10)
  const filters: ToolsFilters = {
    q: (getSingle("q") ?? "").trim(),
    lab: getSingle("lab") ?? "all",
    category: getSingle("category") ?? "all",
    page: Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1,
    pageSize: 20,
  }
  const { tools, createLabs, events, filterLabs, filterCategories, kpi, pagination, filters: activeFilters } =
    await getToolsData(role, session.user.id, accessibleLabIds, filters)

  return (
    <ToolsPageClient
      role={role}
      data={tools}
      masterLabs={createLabs}
      events={events}
      filterLabs={filterLabs}
      filterCategories={filterCategories}
      kpi={kpi}
      pagination={pagination}
      initialFilters={activeFilters}
    />
  )
}
