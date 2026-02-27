import { expect, test } from "@playwright/test"
import { and, asc, eq } from "drizzle-orm"

import { openSession, selectOptionById } from "./helpers"
import { createDb } from "../../lib/db/create-db"
import {
  borrowingApprovalMatrices,
  borrowingTransactionItems,
  borrowingTransactions,
  labs,
  toolAssets,
  toolModels,
  users,
} from "../../lib/db/schema"

async function createPendingBorrowingFixture() {
  const db = createDb()
  const code = `E2E-BRW-${Date.now()}`

  const [lab, requester, admin] = await Promise.all([
    db.query.labs.findFirst({
      where: eq(labs.code, "LAB-HEM"),
      columns: { id: true },
    }),
    db.query.users.findFirst({
      where: eq(users.username, "P27834021015"),
      columns: { id: true },
    }),
    db.query.users.findFirst({
      where: eq(users.username, "admin"),
      columns: { id: true },
    }),
  ])

  if (!lab?.id || !requester?.id || !admin?.id) {
    throw new Error("Fixture user/lab tidak ditemukan.")
  }

  const matrix = await db.query.borrowingApprovalMatrices.findFirst({
    where: and(eq(borrowingApprovalMatrices.labId, lab.id), eq(borrowingApprovalMatrices.isActive, true)),
    columns: { id: true },
  })
  if (!matrix?.id) throw new Error("Matrix approval aktif untuk LAB-HEM tidak ditemukan.")

  const availableTools = await db
    .select({ id: toolAssets.id })
    .from(toolAssets)
    .innerJoin(toolModels, eq(toolModels.id, toolAssets.toolModelId))
    .where(and(eq(toolModels.labId, lab.id), eq(toolAssets.status, "available")))
    .orderBy(asc(toolAssets.assetCode))
    .limit(2)

  if (availableTools.length < 2) throw new Error("Tool available untuk fixture kurang dari 2 unit.")

  const insertedTx = await db
    .insert(borrowingTransactions)
    .values({
      code,
      labId: lab.id,
      requesterUserId: requester.id,
      createdByUserId: admin.id,
      purpose: `Fixture ${code}`,
      courseName: "Uji E2E",
      materialTopic: "Alur Peminjaman",
      semesterLabel: "4",
      groupName: "A",
      advisorLecturerName: "Dr. Rahmawati",
      approvalMatrixId: matrix.id,
      status: "pending_approval",
    })
    .returning({ id: borrowingTransactions.id })

  const txId = insertedTx[0]?.id
  if (!txId) throw new Error("Gagal membuat fixture transaksi borrowing.")

  await db.insert(borrowingTransactionItems).values(
    availableTools.map((tool) => ({
      transactionId: txId,
      itemType: "tool_asset" as const,
      toolAssetId: tool.id,
      qtyRequested: 1,
    })),
  )

  return { code }
}

test.describe("Borrowing Core Flow", () => {
  test("admin -> dosen -> plp -> handover -> partial return -> complete", async ({ browser }) => {
    test.setTimeout(300_000)
    const fixture = await createPendingBorrowingFixture()
    const dosen = await openSession(browser, {
      username: "dosen.rahma",
      password: "Dosen#12345",
    })
    const plp = await openSession(browser, {
      username: "plp.suryani",
      password: "Plp#12345",
    })

    try {
      const txCode = fixture.code

      const dosenPage = dosen.page
      await dosenPage.goto("/dashboard/borrowing")
      await dosenPage.reload()
      const dosenRow = dosenPage.locator("table tbody tr").filter({ hasText: txCode }).first()
      await expect(dosenRow).toBeVisible()
      await dosenRow.getByRole("button", { name: "Lihat detail" }).click()
      await dosenPage.getByRole("tab", { name: "Tindakan" }).click()
      await dosenPage.getByRole("button", { name: "Setujui" }).click()
      await expect(dosenPage.getByText("Approval berhasil disimpan.")).toBeVisible()
      await dosenPage.keyboard.press("Escape")

      const plpPage = plp.page
      await plpPage.goto("/dashboard/borrowing")
      await plpPage.reload()
      const plpPendingRow = plpPage.locator("table tbody tr").filter({ hasText: txCode }).first()
      await expect(plpPendingRow).toBeVisible()
      await plpPendingRow.getByRole("button", { name: "Lihat detail" }).click()
      await plpPage.getByRole("tab", { name: "Tindakan" }).click()
      await plpPage.getByRole("button", { name: "Setujui" }).click()
      await expect(plpPage.getByText("Approval berhasil disimpan.")).toBeVisible()
      await plpPage.keyboard.press("Escape")

      await plpPage.reload()
      await plpPage.getByRole("button", { name: "Menunggu Serah Terima" }).click()
      const plpHandoverRow = plpPage.locator("table tbody tr").filter({ hasText: txCode }).first()
      await expect(plpHandoverRow).toBeVisible()
      await plpHandoverRow.getByRole("button", { name: "Lihat detail" }).click()
      await plpPage.getByRole("tab", { name: "Tindakan" }).click()

      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 2)
      const yyyy = dueDate.getFullYear()
      const mm = String(dueDate.getMonth() + 1).padStart(2, "0")
      const dd = String(dueDate.getDate()).padStart(2, "0")
      await plpPage.fill("#handoverDueDate", `${yyyy}-${mm}-${dd}`)
      await plpPage.getByRole("button", { name: "Proses Serah Terima" }).click()
      await expect(plpPage.getByText("Serah terima berhasil diproses dan transaksi aktif.")).toBeVisible()
      await plpPage.keyboard.press("Escape")

      await plpPage.reload()
      await plpPage.getByRole("button", { name: "Aktif" }).click()
      const plpActiveRow = plpPage.locator("table tbody tr").filter({ hasText: txCode }).first()
      await expect(plpActiveRow).toBeVisible()
      await plpActiveRow.getByRole("button", { name: "Lihat detail" }).click()
      await plpPage.getByRole("tab", { name: "Tindakan" }).click()

      await selectOptionById(plpPage, "returnTransactionItemId", / - /)
      await plpPage.getByRole("button", { name: "Terima Kembali" }).click()
      await expect(plpPage.getByText("Pengembalian alat berhasil diproses.")).toBeVisible()

      await selectOptionById(plpPage, "returnTransactionItemId", / - /)
      await plpPage.getByRole("button", { name: "Terima Kembali" }).click()
      await expect(plpPage.getByText("Pengembalian alat berhasil diproses.")).toBeVisible()
      await plpPage.keyboard.press("Escape")

      await plpPage.reload()
      await plpPage.getByRole("button", { name: "Dikembalikan" }).click()
      await expect(plpPage.locator("table tbody tr").filter({ hasText: txCode }).first()).toBeVisible()
    } finally {
      await dosen.context.close().catch(() => {})
      await plp.context.close().catch(() => {})
    }
  })
})
