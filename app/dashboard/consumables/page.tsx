import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { redirect } from "next/navigation"

import {
  ConsumablesPageClient,
  type ConsumableCreateLabOption,
  type ConsumableCreateItemOption,
  type ConsumableStockMovementRow,
  type ConsumableStockRow,
  type MaterialRequestRow,
} from "@/components/consumables/consumables-page-client"
import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import {
  consumableItems,
  consumableStockMovements,
  labs,
  materialRequestItems,
  materialRequests,
  userLabAssignments,
  users,
} from "@/lib/db/schema"

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

async function getConsumablesData(
  role: Role,
  userId: string,
  accessibleLabIds: string[] | null,
  paging: { requestPage: number; requestPageSize: number; movementPage: number; movementPageSize: number },
) {
  const stockWhere =
    role === "petugas_plp" && accessibleLabIds
      ? accessibleLabIds.length > 0
        ? inArray(consumableItems.labId, accessibleLabIds)
        : sql`false`
      : undefined

  const requestWhere =
    role === "admin"
      ? undefined
      : role === "mahasiswa"
        ? eq(materialRequests.requesterUserId, userId)
        : accessibleLabIds && accessibleLabIds.length > 0
          ? inArray(materialRequests.labId, accessibleLabIds)
          : sql`false`

  const requestOffset = (paging.requestPage - 1) * paging.requestPageSize
  const movementOffset = (paging.movementPage - 1) * paging.movementPageSize

  const [stockRows, requestRows, requestCountRows, requestLineRows, labRows, createItemRows, movementRows, movementCountRows] = await Promise.all([
    db
      .select({
        id: consumableItems.id,
        labId: consumableItems.labId,
        code: consumableItems.code,
        name: consumableItems.name,
        unit: consumableItems.unit,
        stock: consumableItems.stockQty,
        minStock: consumableItems.minStockQty,
        category: consumableItems.category,
        lab: labs.name,
      })
      .from(consumableItems)
      .innerJoin(labs, eq(consumableItems.labId, labs.id))
      .where(
        and(
          eq(consumableItems.isActive, true),
          stockWhere,
        ),
      )
      .orderBy(asc(labs.name), asc(consumableItems.name)),
    db
      .select({
        id: materialRequests.id,
        code: materialRequests.code,
        labId: materialRequests.labId,
        requestorUserId: materialRequests.requesterUserId,
        requestor: sql<string>`coalesce(${users.fullName}, '-')`,
        labName: labs.name,
        date: materialRequests.requestedAt,
        status: materialRequests.status,
        note: materialRequests.note,
        items: sql<string>`coalesce(string_agg(concat(${consumableItems.name}, ' (', ${materialRequestItems.qtyRequested}, ' ', ${consumableItems.unit}, ')'), ', ' order by ${consumableItems.name}), '-')`,
      })
      .from(materialRequests)
      .innerJoin(labs, eq(materialRequests.labId, labs.id))
      .innerJoin(users, eq(materialRequests.requesterUserId, users.id))
      .leftJoin(materialRequestItems, eq(materialRequestItems.requestId, materialRequests.id))
      .leftJoin(consumableItems, eq(materialRequestItems.consumableItemId, consumableItems.id))
      .where(requestWhere)
      .groupBy(materialRequests.id, labs.name, users.fullName)
      .orderBy(desc(materialRequests.requestedAt))
      .limit(paging.requestPageSize)
      .offset(requestOffset),
    db
      .select({ total: sql<number>`count(*)` })
      .from(materialRequests)
      .where(requestWhere),
    db
      .select({
        requestId: materialRequestItems.requestId,
        consumableId: materialRequestItems.consumableItemId,
        name: consumableItems.name,
        unit: consumableItems.unit,
        qtyRequested: materialRequestItems.qtyRequested,
        qtyFulfilled: materialRequestItems.qtyFulfilled,
      })
      .from(materialRequestItems)
      .innerJoin(consumableItems, eq(consumableItems.id, materialRequestItems.consumableItemId)),
    db
      .select({ id: labs.id, name: labs.name })
      .from(labs)
      .where(
        role === "petugas_plp" && accessibleLabIds
          ? accessibleLabIds.length > 0
            ? inArray(labs.id, accessibleLabIds)
            : sql`false`
          : undefined,
      )
      .orderBy(asc(labs.name)),
    db
      .select({
        id: consumableItems.id,
        labId: consumableItems.labId,
        label: sql<string>`concat(${consumableItems.name}, ' - ', ${labs.name}, ' (stok ', ${consumableItems.stockQty}, ' ', ${consumableItems.unit}, ')')`,
        stockQty: consumableItems.stockQty,
        unit: consumableItems.unit,
      })
      .from(consumableItems)
      .innerJoin(labs, eq(labs.id, consumableItems.labId))
      .where(and(eq(consumableItems.isActive, true), stockWhere))
      .orderBy(asc(labs.name), asc(consumableItems.name)),
    db
      .select({
        id: consumableStockMovements.id,
        consumableId: consumableStockMovements.consumableItemId,
        movementType: consumableStockMovements.movementType,
        qtyDelta: consumableStockMovements.qtyDelta,
        qtyBefore: consumableStockMovements.qtyBefore,
        qtyAfter: consumableStockMovements.qtyAfter,
        note: consumableStockMovements.note,
        referenceType: consumableStockMovements.referenceType,
        createdAt: consumableStockMovements.createdAt,
        actorName: users.fullName,
        consumableName: consumableItems.name,
        unit: consumableItems.unit,
        labId: consumableItems.labId,
        labName: labs.name,
      })
      .from(consumableStockMovements)
      .innerJoin(consumableItems, eq(consumableItems.id, consumableStockMovements.consumableItemId))
      .innerJoin(labs, eq(labs.id, consumableItems.labId))
      .leftJoin(users, eq(users.id, consumableStockMovements.actorUserId))
      .where(stockWhere)
      .orderBy(desc(consumableStockMovements.createdAt))
      .limit(paging.movementPageSize)
      .offset(movementOffset),
    db
      .select({ total: sql<number>`count(*)` })
      .from(consumableStockMovements)
      .innerJoin(consumableItems, eq(consumableItems.id, consumableStockMovements.consumableItemId))
      .where(stockWhere),
  ])

  const consumables: ConsumableStockRow[] = stockRows.map((row) => ({
    id: row.id,
    labId: row.labId,
    code: row.code,
    name: row.name,
    unit: row.unit,
    stock: row.stock,
    minStock: row.minStock,
    category: row.category,
    lab: row.lab,
  }))

  const requestLineMap = new Map<string, MaterialRequestRow["lines"]>()
  for (const line of requestLineRows) {
    const list = requestLineMap.get(line.requestId) ?? []
    list.push({
      consumableId: line.consumableId,
      name: line.name,
      unit: line.unit,
      qtyRequested: line.qtyRequested,
      qtyFulfilled: line.qtyFulfilled,
    })
    requestLineMap.set(line.requestId, list)
  }

  const requests: MaterialRequestRow[] = requestRows.map((row) => ({
    id: row.id,
    code: row.code,
    labId: row.labId,
    requestorUserId: row.requestorUserId,
    requestor: row.requestor,
    lab: row.labName,
    items: row.items,
    date: row.date.toISOString().slice(0, 10),
    status: row.status,
    note: row.note,
    lines: requestLineMap.get(row.id) ?? [],
  }))

  const createLabs: ConsumableCreateLabOption[] = labRows.map((r) => ({ id: r.id, name: r.name }))
  const createItems: ConsumableCreateItemOption[] = createItemRows.map((r) => ({
    id: r.id,
    labId: r.labId,
    label: r.label,
    stockQty: r.stockQty,
    unit: r.unit,
  }))

  const stockMovementRows: ConsumableStockMovementRow[] = movementRows.map((row) => ({
    id: row.id,
    consumableId: row.consumableId,
    consumableName: row.consumableName,
    unit: row.unit,
    labId: row.labId,
    labName: row.labName,
    movementType: row.movementType,
    qtyDelta: row.qtyDelta,
    qtyBefore: row.qtyBefore,
    qtyAfter: row.qtyAfter,
    note: row.note,
    referenceType: row.referenceType,
    actorName: row.actorName ?? "-",
    createdAt: row.createdAt.toISOString(),
  }))

  const requestTotalItems = Number(requestCountRows[0]?.total ?? 0)
  const requestTotalPages = Math.max(1, Math.ceil(requestTotalItems / paging.requestPageSize))
  const movementTotalItems = Number(movementCountRows[0]?.total ?? 0)
  const movementTotalPages = Math.max(1, Math.ceil(movementTotalItems / paging.movementPageSize))

  return {
    consumables,
    requests,
    createLabs,
    createItems,
    stockMovementRows,
    pagination: {
      requests: {
        page: Math.min(paging.requestPage, requestTotalPages),
        pageSize: paging.requestPageSize,
        totalItems: requestTotalItems,
        totalPages: requestTotalPages,
      },
      movements: {
        page: Math.min(paging.movementPage, movementTotalPages),
        pageSize: paging.movementPageSize,
        totalItems: movementTotalItems,
        totalPages: movementTotalPages,
      },
    },
  }
}

export default async function ConsumablesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) redirect("/")

  const role = session.user.role as Role
  const accessibleLabIds = await getAccessibleLabIds(role, session.user.id)
  const sp = (await searchParams) ?? {}
  const getSingle = (key: string) => {
    const v = sp[key]
    return Array.isArray(v) ? v[0] : v
  }
  const requestPage = Math.max(1, Number.parseInt(getSingle("reqPage") ?? "1", 10) || 1)
  const movementPage = Math.max(1, Number.parseInt(getSingle("movPage") ?? "1", 10) || 1)

  const { consumables, requests, createLabs, createItems, stockMovementRows, pagination } = await getConsumablesData(
    role,
    session.user.id,
    accessibleLabIds,
    { requestPage, requestPageSize: 20, movementPage, movementPageSize: 50 },
  )

  return (
    <ConsumablesPageClient
      role={role}
      currentUserId={session.user.id}
      consumables={consumables}
      materialRequests={requests}
      stockMovements={stockMovementRows}
      masterLabs={createLabs}
      createOptions={{ labs: createLabs, items: createItems }}
      pagination={pagination}
    />
  )
}
