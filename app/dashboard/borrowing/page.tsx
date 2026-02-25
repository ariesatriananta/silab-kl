import { redirect } from "next/navigation"
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"

import {
  BorrowingPageClient,
  type BorrowingCreateConsumableOption,
  type BorrowingCreateLabOption,
  type BorrowingCreateRequesterOption,
  type BorrowingCreateToolOption,
  type BorrowingDetail,
  type BorrowingListRow,
} from "@/components/borrowing/borrowing-page-client"
import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import {
  borrowingApprovals,
  borrowingHandovers,
  borrowingReturnItems,
  borrowingReturns,
  borrowingTransactionItems,
  borrowingTransactions,
  consumableItems,
  labs,
  toolAssets,
  toolModels,
  userLabAssignments,
  users,
} from "@/lib/db/schema"

export const dynamic = "force-dynamic"

type Role = "admin" | "mahasiswa" | "petugas_plp"

function fmtDate(date: Date | null) {
  if (!date) return null
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeZone: "Asia/Jakarta",
  }).format(date)
}

function fmtDateTime(date: Date | null) {
  if (!date) return null
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date)
}

function mapBorrowingDisplayStatus(input: {
  status: typeof borrowingTransactions.$inferSelect.status
  dueDate: Date | null
}) {
  const now = Date.now()
  const base = input.status
  if (
    (base === "active" || base === "partially_returned") &&
    input.dueDate &&
    input.dueDate.getTime() < now
  ) {
    return "overdue" as const
  }
  if (base === "submitted" || base === "pending_approval") return "pending" as const
  return base
}

async function getAccessibleLabIds(role: Role, userId: string) {
  if (role === "admin" || role === "mahasiswa") return null
  const assignments = await db
    .select({ labId: userLabAssignments.labId })
    .from(userLabAssignments)
    .where(eq(userLabAssignments.userId, userId))
  return assignments.map((a) => a.labId)
}

async function getBorrowingData(role: Role, userId: string) {
  const accessibleLabIds = await getAccessibleLabIds(role, userId)

  const baseWhere =
    role === "admin"
      ? undefined
      : role === "mahasiswa"
        ? eq(borrowingTransactions.requesterUserId, userId)
        : accessibleLabIds && accessibleLabIds.length > 0
          ? inArray(borrowingTransactions.labId, accessibleLabIds)
          : sql`false`

  const txRows = await db
    .select({
      id: borrowingTransactions.id,
      code: borrowingTransactions.code,
      labId: borrowingTransactions.labId,
      requesterUserId: borrowingTransactions.requesterUserId,
      createdByUserId: borrowingTransactions.createdByUserId,
      purpose: borrowingTransactions.purpose,
      courseName: borrowingTransactions.courseName,
      materialTopic: borrowingTransactions.materialTopic,
      semesterLabel: borrowingTransactions.semesterLabel,
      groupName: borrowingTransactions.groupName,
      advisorLecturerName: borrowingTransactions.advisorLecturerName,
      status: borrowingTransactions.status,
      requesterName: users.fullName,
      requesterNim: users.nim,
      requestedAt: borrowingTransactions.requestedAt,
      handedOverAt: borrowingTransactions.handedOverAt,
      dueDate: borrowingTransactions.dueDate,
      labName: labs.name,
    })
    .from(borrowingTransactions)
    .innerJoin(users, eq(users.id, borrowingTransactions.requesterUserId))
    .innerJoin(labs, eq(labs.id, borrowingTransactions.labId))
    .where(baseWhere)
    .orderBy(desc(borrowingTransactions.requestedAt))
    .limit(100)

  const txIds = txRows.map((row) => row.id)
  if (txIds.length === 0) {
    return { rows: [] as BorrowingListRow[], details: {} as Record<string, BorrowingDetail>, accessibleLabIds }
  }

  const [
    itemRows,
    approvalRows,
    approvalHistoryRows,
    handoverHistoryRows,
    returnCountRows,
    returnedItemRows,
    returnRows,
    returnItemRows,
  ] =
    await Promise.all([
      db
        .select({
        transactionId: borrowingTransactionItems.transactionId,
        itemId: borrowingTransactionItems.id,
        itemType: borrowingTransactionItems.itemType,
        qty: borrowingTransactionItems.qtyRequested,
        toolAssetId: borrowingTransactionItems.toolAssetId,
        toolName: toolModels.name,
        assetCode: toolAssets.assetCode,
        consumableName: consumableItems.name,
        consumableUnit: consumableItems.unit,
      })
      .from(borrowingTransactionItems)
      .leftJoin(toolAssets, eq(toolAssets.id, borrowingTransactionItems.toolAssetId))
      .leftJoin(toolModels, eq(toolModels.id, toolAssets.toolModelId))
      .leftJoin(consumableItems, eq(consumableItems.id, borrowingTransactionItems.consumableItemId))
      .where(inArray(borrowingTransactionItems.transactionId, txIds)),
      db
      .select({
        transactionId: borrowingApprovals.transactionId,
        count: sql<number>`count(*)`,
      })
      .from(borrowingApprovals)
      .where(eq(borrowingApprovals.decision, "approved"))
      .groupBy(borrowingApprovals.transactionId),
      db
      .select({
        transactionId: borrowingApprovals.transactionId,
        decision: borrowingApprovals.decision,
        decidedAt: borrowingApprovals.decidedAt,
        note: borrowingApprovals.note,
        approverName: users.fullName,
        approverRole: users.role,
      })
      .from(borrowingApprovals)
      .innerJoin(users, eq(users.id, borrowingApprovals.approverUserId))
      .where(inArray(borrowingApprovals.transactionId, txIds))
      .orderBy(asc(borrowingApprovals.decidedAt)),
      db
        .select({
          transactionId: borrowingHandovers.transactionId,
          handedOverAt: borrowingHandovers.handedOverAt,
          dueDate: borrowingHandovers.dueDate,
          note: borrowingHandovers.note,
          handedOverByName: users.fullName,
        })
        .from(borrowingHandovers)
        .innerJoin(users, eq(users.id, borrowingHandovers.handedOverByUserId))
        .where(inArray(borrowingHandovers.transactionId, txIds))
        .orderBy(desc(borrowingHandovers.handedOverAt)),
      db
        .select({
        transactionId: borrowingReturns.transactionId,
        count: sql<number>`count(${borrowingReturnItems.id})`,
      })
      .from(borrowingReturns)
      .leftJoin(borrowingReturnItems, eq(borrowingReturnItems.returnId, borrowingReturns.id))
      .where(inArray(borrowingReturns.transactionId, txIds))
      .groupBy(borrowingReturns.transactionId),
      db
      .select({
        transactionItemId: borrowingReturnItems.transactionItemId,
      })
      .from(borrowingReturnItems)
      .innerJoin(borrowingReturns, eq(borrowingReturns.id, borrowingReturnItems.returnId))
      .where(inArray(borrowingReturns.transactionId, txIds)),
      db
      .select({
        returnId: borrowingReturns.id,
        transactionId: borrowingReturns.transactionId,
        returnedAt: borrowingReturns.returnedAt,
        note: borrowingReturns.note,
        receivedByName: users.fullName,
      })
      .from(borrowingReturns)
      .innerJoin(users, eq(users.id, borrowingReturns.receivedByUserId))
      .where(inArray(borrowingReturns.transactionId, txIds))
      .orderBy(desc(borrowingReturns.returnedAt)),
      db
      .select({
        returnId: borrowingReturnItems.returnId,
        transactionItemId: borrowingReturnItems.transactionItemId,
        returnCondition: borrowingReturnItems.returnCondition,
        note: borrowingReturnItems.note,
        toolName: toolModels.name,
        assetCode: toolAssets.assetCode,
      })
      .from(borrowingReturnItems)
      .innerJoin(toolAssets, eq(toolAssets.id, borrowingReturnItems.toolAssetId))
      .innerJoin(toolModels, eq(toolModels.id, toolAssets.toolModelId))
      .innerJoin(borrowingReturns, eq(borrowingReturns.id, borrowingReturnItems.returnId))
      .where(inArray(borrowingReturns.transactionId, txIds)),
    ])

  const txIdSet = new Set(txRows.map((row) => row.id))

  const returnedItemIdSet = new Set(returnedItemRows.map((r) => r.transactionItemId))
  const itemMap = new Map<string, BorrowingDetail["items"]>()
  for (const row of itemRows) {
    if (!txIdSet.has(row.transactionId)) continue
    const list = itemMap.get(row.transactionId) ?? []
    list.push({
      id: row.itemId,
      itemType: row.itemType,
      name: row.itemType === "tool_asset" ? (row.toolName ?? "Alat") : (row.consumableName ?? "Bahan"),
      qty: row.qty,
      toolAssetId: row.toolAssetId,
      assetCode: row.assetCode,
      unit: row.consumableUnit,
      returned: returnedItemIdSet.has(row.itemId),
    })
    itemMap.set(row.transactionId, list)
  }

  const approvalCountByTx = new Map(approvalRows.map((r) => [r.transactionId, Number(r.count)]))
  const returnCountByTx = new Map(returnCountRows.map((r) => [r.transactionId, Number(r.count)]))
  const handoverHistoryByTx = new Map<string, BorrowingDetail["handoverHistory"]>()
  for (const row of handoverHistoryRows) {
    if (!txIdSet.has(row.transactionId)) continue
    const list = handoverHistoryByTx.get(row.transactionId) ?? []
    list.push({
      handedOverAt: fmtDateTime(row.handedOverAt) ?? "-",
      dueDate: fmtDate(row.dueDate) ?? "-",
      handedOverByName: row.handedOverByName,
      note: row.note,
    })
    handoverHistoryByTx.set(row.transactionId, list)
  }

  const approvalHistoryByTx = new Map<string, BorrowingDetail["approvalHistory"]>()
  for (const row of approvalHistoryRows) {
    if (!txIdSet.has(row.transactionId)) continue
    const list = approvalHistoryByTx.get(row.transactionId) ?? []
    list.push({
      approverName: row.approverName,
      approverRole: row.approverRole,
      decision: row.decision,
      decidedAt: fmtDateTime(row.decidedAt) ?? "-",
      note: row.note,
    })
    approvalHistoryByTx.set(row.transactionId, list)
  }

  const returnItemsByReturnId = new Map<string, NonNullable<BorrowingDetail["returnEvents"]>[number]["items"]>()
  for (const row of returnItemRows) {
    const list = returnItemsByReturnId.get(row.returnId) ?? []
    list.push({
      transactionItemId: row.transactionItemId,
      toolName: row.toolName,
      assetCode: row.assetCode,
      returnCondition: row.returnCondition,
      note: row.note,
    })
    returnItemsByReturnId.set(row.returnId, list)
  }

  const returnEventsByTx = new Map<string, BorrowingDetail["returnEvents"]>()
  for (const row of returnRows) {
    if (!txIdSet.has(row.transactionId)) continue
    const list = returnEventsByTx.get(row.transactionId) ?? []
    list.push({
      returnedAt: fmtDateTime(row.returnedAt) ?? "-",
      receivedByName: row.receivedByName,
      note: row.note,
      items: returnItemsByReturnId.get(row.returnId) ?? [],
    })
    returnEventsByTx.set(row.transactionId, list)
  }

  const rows: BorrowingListRow[] = txRows.map((row) => {
    const status = mapBorrowingDisplayStatus({ status: row.status, dueDate: row.dueDate })
    const items = itemMap.get(row.id) ?? []
    return {
      id: row.id,
      code: row.code,
      labId: row.labId,
      requesterUserId: row.requesterUserId,
      createdByUserId: row.createdByUserId,
      borrower: row.requesterName,
      nim: row.requesterNim,
      borrowDate: fmtDate(row.handedOverAt),
      dueDate: fmtDate(row.dueDate),
      status,
      purpose: row.purpose,
      courseName: row.courseName,
      materialTopic: row.materialTopic,
      semesterLabel: row.semesterLabel,
      groupName: row.groupName,
      advisorLecturerName: row.advisorLecturerName,
      itemCount: items.length,
    }
  })

  const details: Record<string, BorrowingDetail> = Object.fromEntries(
    txRows.map((row) => [
      row.id,
      {
        id: row.id,
        code: row.code,
        borrower: row.requesterName,
        nim: row.requesterNim,
        status: mapBorrowingDisplayStatus({ status: row.status, dueDate: row.dueDate }),
        purpose: row.purpose,
        courseName: row.courseName,
        materialTopic: row.materialTopic,
        semesterLabel: row.semesterLabel,
        groupName: row.groupName,
        advisorLecturerName: row.advisorLecturerName,
        requestedAt: fmtDate(row.requestedAt) ?? "-",
        borrowDate: fmtDate(row.handedOverAt),
        dueDate: fmtDate(row.dueDate),
        labName: row.labName,
        approvalsCount: approvalCountByTx.get(row.id) ?? 0,
        items: itemMap.get(row.id) ?? [],
        approvalHistory: approvalHistoryByTx.get(row.id) ?? [],
        handoverHistory: handoverHistoryByTx.get(row.id) ?? [],
        returnEvents: returnEventsByTx.get(row.id) ?? [],
      } satisfies BorrowingDetail,
    ]),
  )

  // For later usage (currently not shown, but useful if needed)
  void returnCountByTx

  return { rows, details, accessibleLabIds }
}

async function getCreateOptions(role: Role, userId: string, accessibleLabIds: string[] | null) {
  const [labRows, requesterRows, toolRows, consumableRows] = await Promise.all([
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
    role === "mahasiswa"
      ? db
          .select({ id: users.id, fullName: users.fullName, nim: users.nim })
          .from(users)
          .where(eq(users.id, userId))
      : db
          .select({ id: users.id, fullName: users.fullName, nim: users.nim })
          .from(users)
          .where(and(eq(users.role, "mahasiswa"), eq(users.isActive, true)))
          .orderBy(asc(users.fullName)),
    db
      .select({
        id: toolAssets.id,
        modelId: toolModels.id,
        modelCode: toolModels.code,
        assetCode: toolAssets.assetCode,
        toolName: toolModels.name,
        labId: toolModels.labId,
        labName: labs.name,
      })
      .from(toolAssets)
      .innerJoin(toolModels, eq(toolModels.id, toolAssets.toolModelId))
      .innerJoin(labs, eq(labs.id, toolModels.labId))
      .where(
        and(
          eq(toolAssets.status, "available"),
          role === "petugas_plp" && accessibleLabIds
            ? accessibleLabIds.length > 0
              ? inArray(toolModels.labId, accessibleLabIds)
              : sql`false`
            : undefined,
        ),
      )
      .orderBy(asc(labs.name), asc(toolModels.name), asc(toolAssets.assetCode)),
    db
      .select({
        id: consumableItems.id,
        name: consumableItems.name,
        code: consumableItems.code,
        labId: consumableItems.labId,
        labName: labs.name,
        stockQty: consumableItems.stockQty,
        unit: consumableItems.unit,
      })
      .from(consumableItems)
      .innerJoin(labs, eq(labs.id, consumableItems.labId))
      .where(
        role === "petugas_plp" && accessibleLabIds
          ? accessibleLabIds.length > 0
            ? inArray(consumableItems.labId, accessibleLabIds)
            : sql`false`
          : undefined,
      )
      .orderBy(asc(labs.name), asc(consumableItems.name)),
  ])

  const labsOptions: BorrowingCreateLabOption[] = labRows.map((row) => ({ id: row.id, name: row.name }))
  const requesterOptions: BorrowingCreateRequesterOption[] = requesterRows.map((row) => ({
    id: row.id,
    label: row.nim ? `${row.fullName} (${row.nim})` : row.fullName,
  }))
  const toolOptions: BorrowingCreateToolOption[] = toolRows.map((row) => ({
    id: row.id,
    modelId: row.modelId,
    modelCode: row.modelCode,
    labId: row.labId,
    label: `${row.toolName} - ${row.assetCode} - ${row.labName}`,
  }))
  const consumableOptions: BorrowingCreateConsumableOption[] = consumableRows.map((row) => ({
    id: row.id,
    labId: row.labId,
    label: `${row.name} - ${row.labName} (stok ${row.stockQty} ${row.unit})`,
    stockQty: row.stockQty,
    unit: row.unit,
  }))

  return { labsOptions, requesterOptions, toolOptions, consumableOptions }
}

export default async function BorrowingPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) {
    redirect("/")
  }

  const role = session.user.role as Role
  const currentUserId = session.user.id

  const { rows, details, accessibleLabIds } = await getBorrowingData(role, currentUserId)
  const options = await getCreateOptions(role, currentUserId, accessibleLabIds)
  const sp = (await searchParams) ?? {}
  const prefill = {
    openCreate: sp.openCreate === "1",
    labId: typeof sp.labId === "string" ? sp.labId : undefined,
    toolModelCode: typeof sp.toolModelCode === "string" ? sp.toolModelCode : undefined,
  }

  return (
    <BorrowingPageClient
      role={role}
      currentUserId={currentUserId}
      accessibleLabIds={accessibleLabIds}
      rows={rows}
      details={details}
      createOptions={{
        labs: options.labsOptions,
        requesters: options.requesterOptions,
        tools: options.toolOptions,
        consumables: options.consumableOptions,
      }}
      prefill={prefill}
    />
  )
}

