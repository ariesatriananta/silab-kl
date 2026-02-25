"use server"

import { revalidatePath } from "next/cache"
import { and, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
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
  userLabAssignments,
  users,
} from "@/lib/db/schema"
import { writeSecurityAuditLog } from "@/lib/security/audit"

const createBorrowingRequestSchema = z.object({
  labId: z.string().uuid(),
  requesterUserId: z.string().uuid(),
  purpose: z.string().min(5, "Keperluan minimal 5 karakter"),
  courseName: z.string().trim().min(2, "Mata kuliah wajib diisi").max(200),
  materialTopic: z.string().trim().min(2, "Materi wajib diisi").max(200),
  semesterLabel: z.string().trim().min(1, "Semester wajib diisi").max(50),
  groupName: z.string().trim().min(1, "Kelompok wajib diisi").max(50),
  advisorLecturerName: z.string().trim().max(200).optional(),
  itemsPayload: z.string().optional(),
  toolAssetId: z.string().uuid().optional().or(z.literal("")),
  consumableItemId: z.string().uuid().optional().or(z.literal("")),
  consumableQty: z.coerce.number().int().min(1).optional(),
})

const itemsPayloadSchema = z.object({
  toolAssetIds: z.array(z.string().uuid()).default([]),
  consumables: z
    .array(
      z.object({
        consumableItemId: z.string().uuid(),
        qty: z.number().int().min(1),
      }),
    )
    .default([]),
})

function normalizeOptionalUuid(value: string | undefined) {
  return value && value.length > 0 && value !== "none" ? value : null
}

function generateBorrowingCode() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const ymd = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const rnd = Math.floor(Math.random() * 9000) + 1000
  return `BRW-${ymd}-${rnd}`
}

export type CreateBorrowingActionResult = {
  ok: boolean
  message: string
}

export type BorrowingMutationResult = CreateBorrowingActionResult

const approvalActionSchema = z.object({
  transactionId: z.string().uuid(),
  note: z.string().max(500).optional(),
})

const handoverActionSchema = z.object({
  transactionId: z.string().uuid(),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal jatuh tempo wajib diisi"),
  note: z.string().max(500).optional(),
})

const returnToolActionSchema = z.object({
  transactionId: z.string().uuid(),
  transactionItemId: z.string().uuid(),
  returnCondition: z.enum(["baik", "maintenance", "damaged"]),
  note: z.string().max(500).optional(),
})

export async function createBorrowingRequestAction(
  _prevState: CreateBorrowingActionResult | null,
  formData: FormData,
): Promise<CreateBorrowingActionResult> {
  const session = await getServerAuthSession()
  if (!session?.user?.id) {
    return { ok: false, message: "Sesi tidak valid. Silakan login ulang." }
  }

  const parsed = createBorrowingRequestSchema.safeParse({
    labId: formData.get("labId"),
    requesterUserId: formData.get("requesterUserId"),
    purpose: formData.get("purpose"),
    courseName: formData.get("courseName"),
    materialTopic: formData.get("materialTopic"),
    semesterLabel: formData.get("semesterLabel"),
    groupName: formData.get("groupName"),
    advisorLecturerName: formData.get("advisorLecturerName")?.toString() || undefined,
    itemsPayload: formData.get("itemsPayload")?.toString() || undefined,
    toolAssetId: formData.get("toolAssetId"),
    consumableItemId: formData.get("consumableItemId"),
    consumableQty: formData.get("consumableQty") || undefined,
  })

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data pengajuan tidak valid." }
  }

  const role = session.user.role
  const actorUserId = session.user.id
  const labId = parsed.data.labId
  const requesterUserId = parsed.data.requesterUserId
  let toolAssetIds: string[] = []
  let consumableSelections: Array<{ consumableItemId: string; qty: number }> = []

  if (parsed.data.itemsPayload) {
    try {
      const raw = JSON.parse(parsed.data.itemsPayload) as unknown
      const parsedItems = itemsPayloadSchema.parse(raw)
      toolAssetIds = Array.from(new Set(parsedItems.toolAssetIds))
      consumableSelections = parsedItems.consumables
        .filter((c) => c.qty > 0)
        .map((c) => ({ consumableItemId: c.consumableItemId, qty: c.qty }))
    } catch {
      return { ok: false, message: "Data item pengajuan tidak valid." }
    }
  } else {
    const toolAssetId = normalizeOptionalUuid(parsed.data.toolAssetId ?? undefined)
    const consumableItemId = normalizeOptionalUuid(parsed.data.consumableItemId ?? undefined)
    const consumableQty = parsed.data.consumableQty ?? 1
    if (toolAssetId) toolAssetIds = [toolAssetId]
    if (consumableItemId) consumableSelections = [{ consumableItemId, qty: consumableQty }]
  }

  if (toolAssetIds.length === 0 && consumableSelections.length === 0) {
    return { ok: false, message: "Pilih minimal satu item (alat atau bahan)." }
  }

  if (role === "mahasiswa" && requesterUserId !== actorUserId) {
    return { ok: false, message: "Mahasiswa hanya dapat membuat pengajuan untuk akun sendiri." }
  }

  const [labExists, requester, actorAssignment] = await Promise.all([
    db.query.labs.findFirst({
      where: and(eq(labs.id, labId), eq(labs.isActive, true)),
      columns: { id: true },
    }),
    db.query.users.findFirst({
      where: and(eq(users.id, requesterUserId), eq(users.isActive, true)),
      columns: { id: true, role: true },
    }),
    role === "petugas_plp"
      ? db.query.userLabAssignments.findFirst({
          where: and(eq(userLabAssignments.userId, actorUserId), eq(userLabAssignments.labId, labId)),
          columns: { labId: true },
        })
      : Promise.resolve(null),
  ])

  if (!labExists) return { ok: false, message: "Lab tidak ditemukan atau nonaktif." }
  if (!requester) return { ok: false, message: "Peminjam tidak ditemukan." }
  if (requester.role !== "mahasiswa") {
    return { ok: false, message: "Peminjam harus akun mahasiswa." }
  }
  if (role === "petugas_plp" && !actorAssignment) {
    return { ok: false, message: "Anda tidak memiliki akses ke lab ini." }
  }

  if (consumableSelections.some((c) => c.qty < 1)) {
    return { ok: false, message: "Qty bahan harus minimal 1." }
  }

  const [toolAssetRows, consumableRows] = await Promise.all([
    toolAssetIds.length > 0
      ? db
          .select({
            id: toolAssets.id,
            status: toolAssets.status,
            toolModelLabId: toolModels.labId,
          })
          .from(toolAssets)
          .innerJoin(toolModels, eq(toolAssets.toolModelId, toolModels.id))
          .where(inArray(toolAssets.id, toolAssetIds))
      : Promise.resolve([]),
    consumableSelections.length > 0
      ? db
          .select({
            id: consumableItems.id,
            labId: consumableItems.labId,
          })
          .from(consumableItems)
          .where(inArray(consumableItems.id, consumableSelections.map((c) => c.consumableItemId)))
      : Promise.resolve([]),
  ])

  if (toolAssetRows.length !== toolAssetIds.length) {
    return { ok: false, message: "Sebagian alat tidak ditemukan." }
  }
  if (toolAssetRows.some((tool) => tool.toolModelLabId !== labId)) {
    return { ok: false, message: "Semua alat harus berasal dari lab yang sama dengan transaksi." }
  }
  if (toolAssetRows.some((tool) => tool.status !== "available")) {
    return { ok: false, message: "Ada alat yang tidak tersedia." }
  }

  if (consumableRows.length !== consumableSelections.length) {
    return { ok: false, message: "Sebagian bahan habis pakai tidak ditemukan." }
  }
  if (consumableRows.some((item) => item.labId !== labId)) {
    return { ok: false, message: "Semua bahan harus berasal dari lab yang sama dengan transaksi." }
  }

  try {
    await db.transaction(async (tx) => {
      const insertedTx = await tx
        .insert(borrowingTransactions)
        .values({
          code: generateBorrowingCode(),
          labId,
          requesterUserId,
          createdByUserId: actorUserId,
          purpose: parsed.data.purpose.trim(),
          courseName: parsed.data.courseName.trim(),
          materialTopic: parsed.data.materialTopic.trim(),
          semesterLabel: parsed.data.semesterLabel.trim(),
          groupName: parsed.data.groupName.trim(),
          advisorLecturerName: parsed.data.advisorLecturerName?.trim() || null,
          status: "pending_approval",
        })
        .returning({ id: borrowingTransactions.id })

      const transactionId = insertedTx[0]?.id
      if (!transactionId) throw new Error("Gagal membuat transaksi peminjaman.")

      if (toolAssetIds.length > 0) {
        await tx.insert(borrowingTransactionItems).values(
          toolAssetIds.map((toolAssetId) => ({
            transactionId,
            itemType: "tool_asset" as const,
            toolAssetId,
            qtyRequested: 1,
          })),
        )
      }

      if (consumableSelections.length > 0) {
        await tx.insert(borrowingTransactionItems).values(
          consumableSelections.map((item) => ({
            transactionId,
            itemType: "consumable" as const,
            consumableItemId: item.consumableItemId,
            qtyRequested: item.qty,
          })),
        )
      }
    })
  } catch (error) {
    const isUniqueCodeError =
      error instanceof Error &&
      (error.message.includes("borrowing_transactions_code_uq") || error.message.includes("duplicate"))

    return {
      ok: false,
      message: isUniqueCodeError
        ? "Kode transaksi bentrok. Silakan kirim ulang."
        : "Gagal menyimpan pengajuan peminjaman.",
    }
  }

  await writeSecurityAuditLog({
    category: "borrowing",
    action: "create_request",
    outcome: "success",
    userId: actorUserId,
    actorRole: role,
    targetType: "lab",
    targetId: labId,
    metadata: {
      requesterUserId,
      toolCount: toolAssetIds.length,
      consumableCount: consumableSelections.length,
    },
  })

  revalidatePath("/dashboard/borrowing")
  revalidatePath("/dashboard")

  return { ok: true, message: "Pengajuan peminjaman berhasil dibuat." }
}

async function validateApprovalActorAndTransaction(transactionId: string) {
  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) {
    return { error: "Sesi tidak valid." as const }
  }

  if (session.user.role === "mahasiswa") {
    return { error: "Mahasiswa tidak dapat memproses approval." as const }
  }

  const txRow = await db.query.borrowingTransactions.findFirst({
    where: eq(borrowingTransactions.id, transactionId),
    columns: {
      id: true,
      labId: true,
      status: true,
    },
  })

  if (!txRow) return { error: "Transaksi tidak ditemukan." as const }

  if (!["submitted", "pending_approval"].includes(txRow.status)) {
    return { error: "Transaksi tidak dalam status pending approval." as const }
  }

  if (session.user.role === "petugas_plp") {
    const assignment = await db.query.userLabAssignments.findFirst({
      where: and(
        eq(userLabAssignments.userId, session.user.id),
        eq(userLabAssignments.labId, txRow.labId),
      ),
      columns: { userId: true },
    })

    if (!assignment) {
      return { error: "Anda tidak memiliki akses approval untuk lab transaksi ini." as const }
    }
  }

  return { session, txRow }
}

export async function approveBorrowingAction(formData: FormData) {
  await approveBorrowingWithFeedbackAction(null, formData)
}

export async function rejectBorrowingAction(formData: FormData) {
  await rejectBorrowingWithFeedbackAction(null, formData)
}

export async function approveBorrowingWithFeedbackAction(
  _prevState: BorrowingMutationResult | null,
  formData: FormData,
): Promise<BorrowingMutationResult> {
  const parsed = approvalActionSchema.safeParse({
    transactionId: formData.get("transactionId"),
    note: formData.get("note")?.toString() || undefined,
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data approval tidak valid." }
  }

  const validated = await validateApprovalActorAndTransaction(parsed.data.transactionId)
  if ("error" in validated) return { ok: false, message: validated.error ?? "Approval tidak dapat diproses." }

  const { session, txRow } = validated

  try {
    await db.transaction(async (tx) => {
      await tx.insert(borrowingApprovals).values({
        transactionId: txRow.id,
        approverUserId: session.user.id,
        decision: "approved",
        note: parsed.data.note?.trim() || null,
      })

      const approvalCountRows = await tx
        .select({ count: sql<number>`count(*)` })
        .from(borrowingApprovals)
        .where(
          and(
            eq(borrowingApprovals.transactionId, txRow.id),
            eq(borrowingApprovals.decision, "approved"),
          ),
        )

      const approvalCount = Number(approvalCountRows[0]?.count ?? 0)

      await tx
        .update(borrowingTransactions)
        .set({
          status: approvalCount >= 2 ? "approved_waiting_handover" : "pending_approval",
          approvedAt: approvalCount >= 2 ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(borrowingTransactions.id, txRow.id))
    })
  } catch (error) {
    // duplicate approver on same transaction will be blocked by unique index
    console.error("approveBorrowingAction error:", error)
    await writeSecurityAuditLog({
      category: "borrowing",
      action: "approve",
      outcome: "failure",
      userId: session.user.id,
      actorRole: session.user.role,
      targetType: "borrowing_transaction",
      targetId: txRow.id,
      metadata: { message: error instanceof Error ? error.message : "unknown_error" },
    })
    const message =
      error instanceof Error &&
      (error.message.includes("borrowing_approvals_tx_approver_uq") || error.message.includes("duplicate"))
        ? "User yang sama tidak boleh approve dua kali pada transaksi yang sama."
        : "Approval gagal diproses."
    return { ok: false, message }
  }

  await writeSecurityAuditLog({
    category: "borrowing",
    action: "approve",
    outcome: "success",
    userId: session.user.id,
    actorRole: session.user.role,
    targetType: "borrowing_transaction",
    targetId: txRow.id,
  })

  revalidatePath("/dashboard/borrowing")
  revalidatePath("/dashboard")

  return { ok: true, message: "Approval berhasil disimpan." }
}

export async function rejectBorrowingWithFeedbackAction(
  _prevState: BorrowingMutationResult | null,
  formData: FormData,
): Promise<BorrowingMutationResult> {
  const parsed = approvalActionSchema.safeParse({
    transactionId: formData.get("transactionId"),
    note: formData.get("note")?.toString() || undefined,
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data penolakan tidak valid." }
  }

  const validated = await validateApprovalActorAndTransaction(parsed.data.transactionId)
  if ("error" in validated) return { ok: false, message: validated.error ?? "Penolakan tidak dapat diproses." }

  const { session, txRow } = validated

  try {
    await db.transaction(async (tx) => {
      await tx.insert(borrowingApprovals).values({
        transactionId: txRow.id,
        approverUserId: session.user.id,
        decision: "rejected",
        note: parsed.data.note?.trim() || null,
      })

      await tx
        .update(borrowingTransactions)
        .set({
          status: "rejected",
          rejectionReason: parsed.data.note?.trim() || "Ditolak oleh approver",
          updatedAt: new Date(),
        })
        .where(eq(borrowingTransactions.id, txRow.id))
    })
  } catch (error) {
    console.error("rejectBorrowingAction error:", error)
    await writeSecurityAuditLog({
      category: "borrowing",
      action: "reject",
      outcome: "failure",
      userId: session.user.id,
      actorRole: session.user.role,
      targetType: "borrowing_transaction",
      targetId: txRow.id,
      metadata: { message: error instanceof Error ? error.message : "unknown_error" },
    })
    const message =
      error instanceof Error &&
      (error.message.includes("borrowing_approvals_tx_approver_uq") || error.message.includes("duplicate"))
        ? "User yang sama sudah pernah memproses approval transaksi ini."
        : "Penolakan gagal diproses."
    return { ok: false, message }
  }

  await writeSecurityAuditLog({
    category: "borrowing",
    action: "reject",
    outcome: "success",
    userId: session.user.id,
    actorRole: session.user.role,
    targetType: "borrowing_transaction",
    targetId: txRow.id,
  })

  revalidatePath("/dashboard/borrowing")
  revalidatePath("/dashboard")

  return { ok: true, message: "Penolakan berhasil disimpan." }
}

function parseDueDateWibEndOfDay(dateInput: string) {
  const dueDate = new Date(`${dateInput}T23:59:59+07:00`)
  if (Number.isNaN(dueDate.getTime())) {
    throw new Error("Format due date tidak valid.")
  }
  return dueDate
}

export async function handoverBorrowingAction(
  _prevState: BorrowingMutationResult | null,
  formData: FormData,
): Promise<BorrowingMutationResult> {
  const parsed = handoverActionSchema.safeParse({
    transactionId: formData.get("transactionId"),
    dueDate: formData.get("dueDate"),
    note: formData.get("note")?.toString() || undefined,
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data serah terima tidak valid." }
  }

  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) return { ok: false, message: "Sesi tidak valid." }
  if (session.user.role === "mahasiswa") return { ok: false, message: "Akses ditolak." }

  const txRow = await db.query.borrowingTransactions.findFirst({
    where: eq(borrowingTransactions.id, parsed.data.transactionId),
    columns: {
      id: true,
      labId: true,
      status: true,
    },
  })
  if (!txRow) return { ok: false, message: "Transaksi tidak ditemukan." }
  if (txRow.status !== "approved_waiting_handover") {
    return { ok: false, message: "Transaksi belum siap untuk serah terima." }
  }

  if (session.user.role === "petugas_plp") {
    const assignment = await db.query.userLabAssignments.findFirst({
      where: and(eq(userLabAssignments.userId, session.user.id), eq(userLabAssignments.labId, txRow.labId)),
      columns: { userId: true },
    })
    if (!assignment) return { ok: false, message: "Anda tidak memiliki akses ke lab ini." }
  }

  const dueDate = parseDueDateWibEndOfDay(parsed.data.dueDate)
  if (dueDate.getTime() <= Date.now()) {
    return { ok: false, message: "Due date harus lebih besar dari waktu saat ini." }
  }

  try {
    await db.transaction(async (tx) => {
      const approvalCountRows = await tx
        .select({ count: sql<number>`count(*)` })
        .from(borrowingApprovals)
        .where(
          and(
            eq(borrowingApprovals.transactionId, txRow.id),
            eq(borrowingApprovals.decision, "approved"),
          ),
        )
      const approvalCount = Number(approvalCountRows[0]?.count ?? 0)
      if (approvalCount < 2) {
        throw new Error("Approval belum lengkap.")
      }

      const items = await tx
        .select({
          id: borrowingTransactionItems.id,
          itemType: borrowingTransactionItems.itemType,
          qtyRequested: borrowingTransactionItems.qtyRequested,
          toolAssetId: borrowingTransactionItems.toolAssetId,
          consumableItemId: borrowingTransactionItems.consumableItemId,
        })
        .from(borrowingTransactionItems)
        .where(eq(borrowingTransactionItems.transactionId, txRow.id))

      const toolItemIds = items
        .filter((i) => i.itemType === "tool_asset" && i.toolAssetId)
        .map((i) => i.toolAssetId!)
      const consumableLines = items.filter((i) => i.itemType === "consumable" && i.consumableItemId)

      if (toolItemIds.length > 0) {
        const toolStates = await tx
          .select({
            id: toolAssets.id,
            status: toolAssets.status,
          })
          .from(toolAssets)
          .where(inArray(toolAssets.id, toolItemIds))

        if (toolStates.length !== toolItemIds.length) {
          throw new Error("Sebagian alat tidak ditemukan.")
        }
        if (toolStates.some((tool) => tool.status !== "available")) {
          throw new Error("Ada alat yang sudah tidak tersedia. Handover dibatalkan.")
        }
      }

      if (consumableLines.length > 0) {
        const consumableIds = consumableLines.map((i) => i.consumableItemId!)
        const stocks = await tx
          .select({
            id: consumableItems.id,
            stockQty: consumableItems.stockQty,
          })
          .from(consumableItems)
          .where(inArray(consumableItems.id, consumableIds))

        const stockMap = new Map(stocks.map((s) => [s.id, s.stockQty]))
        for (const line of consumableLines) {
          const currentStock = stockMap.get(line.consumableItemId!)
          if (currentStock == null || currentStock < line.qtyRequested) {
            throw new Error("Stok bahan tidak cukup saat serah terima.")
          }
        }
      }

      const handoverRows = await tx
        .insert(borrowingHandovers)
        .values({
          transactionId: txRow.id,
          handedOverByUserId: session.user.id,
          handedOverAt: new Date(),
          dueDate,
          note: parsed.data.note?.trim() || null,
        })
        .returning({ id: borrowingHandovers.id, handedOverAt: borrowingHandovers.handedOverAt })

      const handover = handoverRows[0]
      if (!handover) throw new Error("Gagal menyimpan serah terima.")

      if (toolItemIds.length > 0) {
        await tx
          .update(toolAssets)
          .set({
            status: "borrowed",
            updatedAt: new Date(),
          })
          .where(inArray(toolAssets.id, toolItemIds))
      }

      for (const line of consumableLines) {
        const stockRow = await tx.query.consumableItems.findFirst({
          where: eq(consumableItems.id, line.consumableItemId!),
          columns: { stockQty: true },
        })
        const beforeStock = stockRow?.stockQty ?? 0
        const afterStock = beforeStock - line.qtyRequested
        await tx
          .update(consumableItems)
          .set({
            stockQty: sql`${consumableItems.stockQty} - ${line.qtyRequested}`,
            updatedAt: new Date(),
          })
          .where(eq(consumableItems.id, line.consumableItemId!))

        await tx.insert(borrowingHandoverConsumableLines).values({
          handoverId: handover.id,
          transactionItemId: line.id,
          consumableItemId: line.consumableItemId!,
          qtyIssued: line.qtyRequested,
        })

        await tx.insert(consumableStockMovements).values({
          consumableItemId: line.consumableItemId!,
          movementType: "borrowing_handover_issue",
          qtyDelta: -line.qtyRequested,
          qtyBefore: beforeStock,
          qtyAfter: afterStock,
          note: parsed.data.note?.trim() || "Pengeluaran bahan saat serah terima peminjaman",
          referenceType: "borrowing_transaction",
          referenceId: txRow.id,
          actorUserId: session.user.id,
        })
      }

      await tx
        .update(borrowingTransactions)
        .set({
          status: "active",
          handedOverAt: handover.handedOverAt,
          dueDate,
          updatedAt: new Date(),
        })
        .where(eq(borrowingTransactions.id, txRow.id))
    })
  } catch (error) {
    console.error("handoverBorrowingAction error:", error)
    await writeSecurityAuditLog({
      category: "borrowing",
      action: "handover",
      outcome: "failure",
      userId: session.user.id,
      actorRole: session.user.role,
      targetType: "borrowing_transaction",
      targetId: txRow.id,
      metadata: { message: error instanceof Error ? error.message : "unknown_error" },
    })
    return {
      ok: false,
      message:
        error instanceof Error && error.message
          ? error.message
          : "Serah terima gagal diproses.",
    }
  }

  await writeSecurityAuditLog({
    category: "borrowing",
    action: "handover",
    outcome: "success",
    userId: session.user.id,
    actorRole: session.user.role,
    targetType: "borrowing_transaction",
    targetId: txRow.id,
  })

  revalidatePath("/dashboard/borrowing")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/tools")
  revalidatePath("/dashboard/consumables")
  revalidatePath("/dashboard/student-tools")

  return { ok: true, message: "Serah terima berhasil diproses dan transaksi aktif." }
}

export async function returnBorrowingToolAction(
  _prevState: BorrowingMutationResult | null,
  formData: FormData,
): Promise<BorrowingMutationResult> {
  const parsed = returnToolActionSchema.safeParse({
    transactionId: formData.get("transactionId"),
    transactionItemId: formData.get("transactionItemId"),
    returnCondition: formData.get("returnCondition"),
    note: formData.get("note")?.toString() || undefined,
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data pengembalian tidak valid." }
  }

  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) return { ok: false, message: "Sesi tidak valid." }
  if (session.user.role === "mahasiswa") return { ok: false, message: "Akses ditolak." }

  const txRow = await db.query.borrowingTransactions.findFirst({
    where: eq(borrowingTransactions.id, parsed.data.transactionId),
    columns: { id: true, labId: true, status: true },
  })
  if (!txRow) return { ok: false, message: "Transaksi tidak ditemukan." }
  if (!["active", "partially_returned"].includes(txRow.status)) {
    return { ok: false, message: "Transaksi belum/sudah tidak dapat diproses pengembaliannya." }
  }

  if (session.user.role === "petugas_plp") {
    const assignment = await db.query.userLabAssignments.findFirst({
      where: and(eq(userLabAssignments.userId, session.user.id), eq(userLabAssignments.labId, txRow.labId)),
      columns: { userId: true },
    })
    if (!assignment) return { ok: false, message: "Anda tidak memiliki akses ke lab ini." }
  }

  try {
    await db.transaction(async (tx) => {
      const itemRows = await tx
        .select({
          id: borrowingTransactionItems.id,
          transactionId: borrowingTransactionItems.transactionId,
          itemType: borrowingTransactionItems.itemType,
          toolAssetId: borrowingTransactionItems.toolAssetId,
        })
        .from(borrowingTransactionItems)
        .where(
          and(
            eq(borrowingTransactionItems.id, parsed.data.transactionItemId),
            eq(borrowingTransactionItems.transactionId, txRow.id),
          ),
        )

      const txItem = itemRows[0]
      if (!txItem) throw new Error("Item transaksi tidak ditemukan.")
      if (txItem.itemType !== "tool_asset" || !txItem.toolAssetId) {
        throw new Error("Hanya item alat yang dapat dikembalikan.")
      }

      const existingReturn = await tx.query.borrowingReturnItems.findFirst({
        where: eq(borrowingReturnItems.transactionItemId, txItem.id),
        columns: { id: true },
      })
      if (existingReturn) {
        throw new Error("Item alat ini sudah dikembalikan sebelumnya.")
      }

      const toolState = await tx.query.toolAssets.findFirst({
        where: eq(toolAssets.id, txItem.toolAssetId),
        columns: { id: true, status: true },
      })
      if (!toolState) throw new Error("Asset alat tidak ditemukan.")
      if (toolState.status !== "borrowed") {
        throw new Error("Asset alat tidak dalam status dipinjam.")
      }

      const [returnHeader] = await tx
        .insert(borrowingReturns)
        .values({
          transactionId: txRow.id,
          receivedByUserId: session.user.id,
          returnedAt: new Date(),
          note: parsed.data.note?.trim() || null,
        })
        .returning({ id: borrowingReturns.id })

      if (!returnHeader) throw new Error("Gagal membuat header pengembalian.")

      await tx.insert(borrowingReturnItems).values({
        returnId: returnHeader.id,
        transactionItemId: txItem.id,
        toolAssetId: txItem.toolAssetId,
        returnCondition: parsed.data.returnCondition,
        note: parsed.data.note?.trim() || null,
      })

      const nextAssetStatus =
        parsed.data.returnCondition === "baik"
          ? "available"
          : parsed.data.returnCondition === "maintenance"
            ? "maintenance"
            : "damaged"

      await tx
        .update(toolAssets)
        .set({
          status: nextAssetStatus,
          condition: parsed.data.returnCondition,
          updatedAt: new Date(),
        })
        .where(eq(toolAssets.id, txItem.toolAssetId))

      const [toolCountRow] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(borrowingTransactionItems)
        .where(
          and(
            eq(borrowingTransactionItems.transactionId, txRow.id),
            eq(borrowingTransactionItems.itemType, "tool_asset"),
          ),
        )

      const [returnedCountRow] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(borrowingReturnItems)
        .innerJoin(borrowingTransactionItems, eq(borrowingTransactionItems.id, borrowingReturnItems.transactionItemId))
        .where(eq(borrowingTransactionItems.transactionId, txRow.id))

      const toolCount = Number(toolCountRow?.count ?? 0)
      const returnedCount = Number(returnedCountRow?.count ?? 0)
      const nextTxStatus = returnedCount >= toolCount ? "completed" : "partially_returned"

      await tx
        .update(borrowingTransactions)
        .set({
          status: nextTxStatus,
          updatedAt: new Date(),
        })
        .where(eq(borrowingTransactions.id, txRow.id))
    })
  } catch (error) {
    console.error("returnBorrowingToolAction error:", error)
    await writeSecurityAuditLog({
      category: "borrowing",
      action: "return_tool",
      outcome: "failure",
      userId: session.user.id,
      actorRole: session.user.role,
      targetType: "borrowing_transaction",
      targetId: txRow.id,
      metadata: { message: error instanceof Error ? error.message : "unknown_error" },
    })
    return {
      ok: false,
      message:
        error instanceof Error && error.message ? error.message : "Pengembalian gagal diproses.",
    }
  }

  await writeSecurityAuditLog({
    category: "borrowing",
    action: "return_tool",
    outcome: "success",
    userId: session.user.id,
    actorRole: session.user.role,
    targetType: "borrowing_transaction",
    targetId: txRow.id,
  })

  revalidatePath("/dashboard/borrowing")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/tools")
  revalidatePath("/dashboard/student-tools")

  return { ok: true, message: "Pengembalian alat berhasil diproses." }
}
