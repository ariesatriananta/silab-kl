import test from "node:test"
import assert from "node:assert/strict"

import { config as loadDotenv } from "dotenv"
import { eq, inArray, sql } from "drizzle-orm"

import { createDb } from "@/lib/db/create-db"
import {
  borrowingApprovals,
  borrowingHandoverConsumableLines,
  borrowingHandovers,
  borrowingReturnItems,
  borrowingReturns,
  borrowingTransactionItems,
  borrowingTransactions,
  consumableItems,
  consumableStockMovements,
  labs,
  toolAssets,
  toolModels,
  users,
} from "@/lib/db/schema"

loadDotenv({ path: ".env.local" })
loadDotenv()

const db = createDb()

function randomCode(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

async function getSeedUsers() {
  const rows = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(inArray(users.username, ["admin", "plp.suryani", "P27834021001"]))

  const map = new Map(rows.map((r) => [r.username, r]))
  const admin = map.get("admin")
  const plp = map.get("plp.suryani")
  const mahasiswa = map.get("P27834021001")
  assert.ok(admin)
  assert.ok(plp)
  assert.ok(mahasiswa)
  return { admin, plp, mahasiswa }
}

async function getAnyLab() {
  const row = await db.query.labs.findFirst({
    where: eq(labs.isActive, true),
    columns: { id: true, code: true },
  })
  assert.ok(row)
  return row
}

async function cleanupBorrowingArtifacts(params: {
  borrowingId?: string | null
  consumableIds?: string[]
  toolAssetIds?: string[]
  toolModelIds?: string[]
}) {
  if (params.borrowingId) {
    await db.delete(borrowingTransactions).where(eq(borrowingTransactions.id, params.borrowingId))
  }
  if (params.consumableIds?.length) {
    await db
      .delete(consumableStockMovements)
      .where(inArray(consumableStockMovements.consumableItemId, params.consumableIds))
    await db.delete(consumableItems).where(inArray(consumableItems.id, params.consumableIds))
  }
  if (params.toolAssetIds?.length) {
    await db.delete(toolAssets).where(inArray(toolAssets.id, params.toolAssetIds))
  }
  if (params.toolModelIds?.length) {
    await db.delete(toolModels).where(inArray(toolModels.id, params.toolModelIds))
  }
}

test("integration: happy path borrowing (2 approval -> handover -> partial return -> complete)", async () => {
  const { admin, plp, mahasiswa } = await getSeedUsers()
  const lab = await getAnyLab()

  let borrowingId: string | null = null
  let consumableId: string | null = null
  const toolAssetIds: string[] = []
  const toolModelIds: string[] = []

  try {
    const modelCode = randomCode("TM-ITEST")
    const [model] = await db
      .insert(toolModels)
      .values({
        labId: lab.id,
        code: modelCode,
        name: "Tool ITest",
        category: "ITest",
        brand: "TestBrand",
      })
      .returning({ id: toolModels.id })
    assert.ok(model)
    toolModelIds.push(model.id)

    const assets = await db
      .insert(toolAssets)
      .values([
        {
          toolModelId: model.id,
          assetCode: `${modelCode}-001`,
          qrCodeValue: `TOOL:${modelCode}-001`,
          status: "available",
          condition: "baik",
        },
        {
          toolModelId: model.id,
          assetCode: `${modelCode}-002`,
          qrCodeValue: `TOOL:${modelCode}-002`,
          status: "available",
          condition: "baik",
        },
      ])
      .returning({ id: toolAssets.id })
    assert.equal(assets.length, 2)
    toolAssetIds.push(...assets.map((a) => a.id))

    const [consumable] = await db
      .insert(consumableItems)
      .values({
        labId: lab.id,
        code: randomCode("C-ITEST"),
        name: "Consumable ITest",
        category: "ITest",
        unit: "pcs",
        stockQty: 10,
        minStockQty: 1,
      })
      .returning({ id: consumableItems.id })
    assert.ok(consumable)
    consumableId = consumable.id

    const [borrowing] = await db
      .insert(borrowingTransactions)
      .values({
        code: randomCode("BRW-ITEST"),
        labId: lab.id,
        requesterUserId: mahasiswa.id,
        createdByUserId: mahasiswa.id,
        purpose: "Integration test borrowing flow",
        courseName: "Kimia Klinik",
        materialTopic: "Pemeriksaan Dasar",
        semesterLabel: "4",
        groupName: "A",
        advisorLecturerName: "Dr. Test",
        status: "pending_approval",
      })
      .returning({ id: borrowingTransactions.id, status: borrowingTransactions.status })
    assert.ok(borrowing)
    assert.equal(borrowing.status, "pending_approval")
    borrowingId = borrowing.id

    const insertedItems = await db
      .insert(borrowingTransactionItems)
      .values([
        {
          transactionId: borrowing.id,
          itemType: "tool_asset",
          toolAssetId: assets[0]!.id,
          qtyRequested: 1,
        },
        {
          transactionId: borrowing.id,
          itemType: "tool_asset",
          toolAssetId: assets[1]!.id,
          qtyRequested: 1,
        },
        {
          transactionId: borrowing.id,
          itemType: "consumable",
          consumableItemId: consumable.id,
          qtyRequested: 3,
        },
      ])
      .returning({
        id: borrowingTransactionItems.id,
        toolAssetId: borrowingTransactionItems.toolAssetId,
        consumableItemId: borrowingTransactionItems.consumableItemId,
        qtyRequested: borrowingTransactionItems.qtyRequested,
      })

    const toolItem1 = insertedItems.find((i) => i.toolAssetId === assets[0]!.id)
    const toolItem2 = insertedItems.find((i) => i.toolAssetId === assets[1]!.id)
    const consumableLine = insertedItems.find((i) => i.consumableItemId === consumable.id)
    assert.ok(toolItem1)
    assert.ok(toolItem2)
    assert.ok(consumableLine)

    await db.insert(borrowingApprovals).values({
      transactionId: borrowing.id,
      approverUserId: admin.id,
      decision: "approved",
    })
    await db
      .update(borrowingTransactions)
      .set({ status: "pending_approval", updatedAt: new Date() })
      .where(eq(borrowingTransactions.id, borrowing.id))

    await db.insert(borrowingApprovals).values({
      transactionId: borrowing.id,
      approverUserId: plp.id,
      decision: "approved",
    })
    await db
      .update(borrowingTransactions)
      .set({ status: "approved_waiting_handover", approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(borrowingTransactions.id, borrowing.id))

    const [handover] = await db
      .insert(borrowingHandovers)
      .values({
        transactionId: borrowing.id,
        handedOverByUserId: admin.id,
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        note: "Handover integration test",
      })
      .returning({ id: borrowingHandovers.id, dueDate: borrowingHandovers.dueDate, handedOverAt: borrowingHandovers.handedOverAt })
    assert.ok(handover)

    await db
      .update(toolAssets)
      .set({ status: "borrowed", updatedAt: new Date() })
      .where(inArray(toolAssets.id, assets.map((a) => a.id)))

    await db.insert(borrowingHandoverConsumableLines).values({
      handoverId: handover.id,
      transactionItemId: consumableLine.id,
      consumableItemId: consumable.id,
      qtyIssued: consumableLine.qtyRequested,
    })
    await db
      .update(consumableItems)
      .set({ stockQty: sql`${consumableItems.stockQty} - ${consumableLine.qtyRequested}`, updatedAt: new Date() })
      .where(eq(consumableItems.id, consumable.id))
    await db.insert(consumableStockMovements).values({
      consumableItemId: consumable.id,
      movementType: "borrowing_handover_issue",
      qtyDelta: -consumableLine.qtyRequested,
      qtyBefore: 10,
      qtyAfter: 7,
      note: "ITest handover issue",
      referenceType: "borrowing_transaction",
      referenceId: borrowing.id,
      actorUserId: admin.id,
    })
    await db
      .update(borrowingTransactions)
      .set({
        status: "active",
        handedOverAt: handover.handedOverAt,
        dueDate: handover.dueDate,
        updatedAt: new Date(),
      })
      .where(eq(borrowingTransactions.id, borrowing.id))

    const active = await db.query.borrowingTransactions.findFirst({
      where: eq(borrowingTransactions.id, borrowing.id),
      columns: { status: true },
    })
    assert.equal(active?.status, "active")

    const stockAfterHandover = await db.query.consumableItems.findFirst({
      where: eq(consumableItems.id, consumable.id),
      columns: { stockQty: true },
    })
    assert.equal(stockAfterHandover?.stockQty, 7)

    const [return1] = await db
      .insert(borrowingReturns)
      .values({
        transactionId: borrowing.id,
        receivedByUserId: admin.id,
        note: "partial return 1",
      })
      .returning({ id: borrowingReturns.id })
    assert.ok(return1)

    await db.insert(borrowingReturnItems).values({
      returnId: return1.id,
      transactionItemId: toolItem1.id,
      toolAssetId: toolItem1.toolAssetId!,
      returnCondition: "baik",
    })
    await db
      .update(toolAssets)
      .set({ status: "available", condition: "baik", updatedAt: new Date() })
      .where(eq(toolAssets.id, toolItem1.toolAssetId!))
    await db
      .update(borrowingTransactions)
      .set({ status: "partially_returned", updatedAt: new Date() })
      .where(eq(borrowingTransactions.id, borrowing.id))

    const partial = await db.query.borrowingTransactions.findFirst({
      where: eq(borrowingTransactions.id, borrowing.id),
      columns: { status: true },
    })
    assert.equal(partial?.status, "partially_returned")

    const [return2] = await db
      .insert(borrowingReturns)
      .values({
        transactionId: borrowing.id,
        receivedByUserId: plp.id,
        note: "final return",
      })
      .returning({ id: borrowingReturns.id })
    assert.ok(return2)

    await db.insert(borrowingReturnItems).values({
      returnId: return2.id,
      transactionItemId: toolItem2.id,
      toolAssetId: toolItem2.toolAssetId!,
      returnCondition: "damaged",
    })
    await db
      .update(toolAssets)
      .set({ status: "damaged", condition: "damaged", updatedAt: new Date() })
      .where(eq(toolAssets.id, toolItem2.toolAssetId!))
    await db
      .update(borrowingTransactions)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(borrowingTransactions.id, borrowing.id))

    const completed = await db.query.borrowingTransactions.findFirst({
      where: eq(borrowingTransactions.id, borrowing.id),
      columns: { status: true },
    })
    assert.equal(completed?.status, "completed")

    const [returnCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(borrowingReturnItems)
      .innerJoin(
        borrowingTransactionItems,
        eq(borrowingTransactionItems.id, borrowingReturnItems.transactionItemId),
      )
      .where(eq(borrowingTransactionItems.transactionId, borrowing.id))
    assert.equal(Number(returnCount?.count ?? 0), 2)
  } finally {
    await cleanupBorrowingArtifacts({
      borrowingId,
      consumableIds: consumableId ? [consumableId] : [],
      toolAssetIds,
      toolModelIds,
    })
  }
})

test("integration: approver yang sama tidak boleh approve dua kali (unique index)", async () => {
  const { admin, mahasiswa } = await getSeedUsers()
  const lab = await getAnyLab()

  let borrowingId: string | null = null
  try {
    const [borrowing] = await db
      .insert(borrowingTransactions)
      .values({
        code: randomCode("BRW-DUPAPP"),
        labId: lab.id,
        requesterUserId: mahasiswa.id,
        createdByUserId: admin.id,
        purpose: "Duplicate approver test",
        courseName: "Test",
        materialTopic: "Test",
        semesterLabel: "1",
        groupName: "A",
        status: "pending_approval",
      })
      .returning({ id: borrowingTransactions.id })
    assert.ok(borrowing)
    borrowingId = borrowing.id

    await db.insert(borrowingApprovals).values({
      transactionId: borrowing.id,
      approverUserId: admin.id,
      decision: "approved",
    })

    let duplicateBlocked = false
    try {
      await db.insert(borrowingApprovals).values({
        transactionId: borrowing.id,
        approverUserId: admin.id,
        decision: "approved",
      })
    } catch (error) {
      duplicateBlocked = error instanceof Error
    }
    assert.equal(duplicateBlocked, true)
  } finally {
    await cleanupBorrowingArtifacts({ borrowingId })
  }
})

test("integration: handover should remain waiting when consumable stock insufficient (precondition state)", async () => {
  const { admin, plp, mahasiswa } = await getSeedUsers()
  const lab = await getAnyLab()

  let borrowingId: string | null = null
  let consumableId: string | null = null

  try {
    const [consumable] = await db
      .insert(consumableItems)
      .values({
        labId: lab.id,
        code: randomCode("C-LOW"),
        name: "Consumable Stock Low",
        category: "ITest",
        unit: "pcs",
        stockQty: 1,
        minStockQty: 0,
      })
      .returning({ id: consumableItems.id })
    assert.ok(consumable)
    consumableId = consumable.id

    const [borrowing] = await db
      .insert(borrowingTransactions)
      .values({
        code: randomCode("BRW-STOCKLOW"),
        labId: lab.id,
        requesterUserId: mahasiswa.id,
        createdByUserId: admin.id,
        purpose: "Stock low handover precondition test",
        courseName: "Test",
        materialTopic: "Test",
        semesterLabel: "2",
        groupName: "B",
        status: "approved_waiting_handover",
      })
      .returning({ id: borrowingTransactions.id })
    assert.ok(borrowing)
    borrowingId = borrowing.id

    await db.insert(borrowingTransactionItems).values({
      transactionId: borrowing.id,
      itemType: "consumable",
      consumableItemId: consumable.id,
      qtyRequested: 5,
    })
    await db.insert(borrowingApprovals).values([
      { transactionId: borrowing.id, approverUserId: admin.id, decision: "approved" },
      { transactionId: borrowing.id, approverUserId: plp.id, decision: "approved" },
    ])

    const [line] = await db
      .select({
        qtyRequested: borrowingTransactionItems.qtyRequested,
        consumableItemId: borrowingTransactionItems.consumableItemId,
      })
      .from(borrowingTransactionItems)
      .where(eq(borrowingTransactionItems.transactionId, borrowing.id))
    assert.ok(line)

    const [stock] = await db
      .select({ stockQty: consumableItems.stockQty })
      .from(consumableItems)
      .where(eq(consumableItems.id, line.consumableItemId!))
    assert.ok(stock)
    assert.equal(stock.stockQty < line.qtyRequested, true)

    const [handoverCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(borrowingHandovers)
      .where(eq(borrowingHandovers.transactionId, borrowing.id))
    assert.equal(Number(handoverCount?.count ?? 0), 0)

    const status = await db.query.borrowingTransactions.findFirst({
      where: eq(borrowingTransactions.id, borrowing.id),
      columns: { status: true },
    })
    assert.equal(status?.status, "approved_waiting_handover")
  } finally {
    await cleanupBorrowingArtifacts({
      borrowingId,
      consumableIds: consumableId ? [consumableId] : [],
    })
  }
})
