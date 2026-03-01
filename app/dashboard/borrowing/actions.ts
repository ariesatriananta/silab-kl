"use server"

import { revalidatePath } from "next/cache"
import { and, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import {
  borrowingApprovals,
  borrowingApprovalMatrices,
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

const BORROWING_APPROVAL_FLOW = [1, 2] as const

type BorrowingTxLike = typeof db

async function runBorrowingTx<T>(fn: (tx: BorrowingTxLike) => Promise<T>) {
  try {
    return await db.transaction(async (tx) => fn(tx as unknown as BorrowingTxLike))
  } catch (error) {
    if (error instanceof Error && error.message.includes("No transactions support in neon-http driver")) {
      return await fn(db)
    }
    throw error
  }
}

async function getActiveBorrowingMatrixForLab(labId: string) {
  const matrix = await db.query.borrowingApprovalMatrices.findFirst({
    where: and(eq(borrowingApprovalMatrices.labId, labId), eq(borrowingApprovalMatrices.isActive, true)),
    columns: {
      id: true,
      labId: true,
      isActive: true,
      step1ApproverUserId: true,
      step2ApproverUserId: true,
    },
  })
  if (!matrix) return null
  if (!matrix.step1ApproverUserId || !matrix.step2ApproverUserId) return null
  return matrix
}

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

const returnItemConditionSchema = z.object({
  transactionItemId: z.string().uuid(),
  returnCondition: z.enum(["baik", "maintenance", "damaged"]),
})

const returnToolActionSchema = z
  .object({
    transactionId: z.string().uuid(),
    transactionItemId: z.string().uuid().optional(),
    returnCondition: z.enum(["baik", "maintenance", "damaged"]).optional(),
    returnItemsPayload: z.string().optional(),
    note: z.string().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    const hasPayload = Boolean(value.returnItemsPayload?.trim())
    const hasSingle = Boolean(value.transactionItemId && value.returnCondition)
    if (!hasPayload && !hasSingle) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Pilih minimal satu alat untuk dikembalikan.",
      })
    }
  })

function mapReturnBorrowingIssueMessage(issue: z.ZodIssue) {
  const field = issue.path[0]
  const labels: Record<string, string> = {
    transactionId: "Transaksi",
    transactionItemId: "Item alat",
    returnCondition: "Kondisi pengembalian",
    returnItemsPayload: "Item pengembalian",
    note: "Catatan pengembalian",
  }
  const label = typeof field === "string" ? labels[field] ?? field : "Form pengembalian"

  if (issue.message && issue.message !== "Invalid input" && !issue.message.includes("Expected")) {
    return issue.message
  }

  if (issue.code === z.ZodIssueCode.invalid_type) {
    return `${label} tidak valid.`
  }
  return `${label} tidak valid.`
}

function mapCreateBorrowingIssueMessage(issue: z.ZodIssue) {
  const field = issue.path[0]
  const labels: Record<string, string> = {
    labId: "Laboratorium",
    requesterUserId: "Pemohon",
    purpose: "Keperluan",
    courseName: "Mata Kuliah",
    materialTopic: "Materi",
    semesterLabel: "Semester",
    groupName: "Kelompok",
    advisorLecturerName: "Dosen",
    toolAssetId: "Alat",
    consumableItemId: "Bahan Habis Pakai",
    consumableQty: "Qty Bahan",
    itemsPayload: "Item Pengajuan",
  }
  const label = typeof field === "string" ? labels[field] ?? field : "Form"

  if (issue.message && issue.message !== "Invalid input") {
    return issue.message
  }

  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return `${label} wajib diisi.`
    case z.ZodIssueCode.too_small:
      return `${label} belum memenuhi panjang minimal.`
    case z.ZodIssueCode.invalid_string:
      return `${label} tidak valid.`
    default:
      return `${label} tidak valid.`
  }
}

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
    toolAssetId: formData.get("toolAssetId")?.toString() || undefined,
    consumableItemId: formData.get("consumableItemId")?.toString() || undefined,
    consumableQty: formData.get("consumableQty") || undefined,
  })

  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, message: issue ? mapCreateBorrowingIssueMessage(issue) : "Data pengajuan tidak valid." }
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
  if (role === "dosen") {
    return { ok: false, message: "Dosen tidak dapat membuat pengajuan peminjaman." }
  }

  const [labExists, requester, actorAssignment, matrixConfig] = await Promise.all([
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
    getActiveBorrowingMatrixForLab(labId),
  ])

  if (!labExists) return { ok: false, message: "Lab tidak ditemukan atau nonaktif." }
  if (!requester) return { ok: false, message: "Peminjam tidak ditemukan." }
  if (!matrixConfig) {
    return {
      ok: false,
      message:
        "Matrix approval lab belum aktif atau belum lengkap (Dosen/PLP). Hubungi admin.",
    }
  }
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
    await runBorrowingTx(async (tx) => {
      const insertedTx = await tx
        .insert(borrowingTransactions)
        .values({
          code: generateBorrowingCode(),
          labId,
          approvalMatrixId: matrixConfig.id,
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
        : error instanceof Error && error.message
          ? `Gagal menyimpan pengajuan peminjaman: ${error.message}`
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

  if (session.user.role !== "dosen" && session.user.role !== "petugas_plp" && session.user.role !== "admin") {
    return { error: "Hanya Dosen, Petugas PLP, atau Admin yang dapat memproses approval." as const }
  }

  const txRow = await db.query.borrowingTransactions.findFirst({
    where: eq(borrowingTransactions.id, transactionId),
    columns: {
      id: true,
      labId: true,
      status: true,
      approvalMatrixId: true,
    },
  })

  if (!txRow) return { error: "Transaksi tidak ditemukan." as const }

  if (!["submitted", "pending_approval"].includes(txRow.status)) {
    return { error: "Transaksi tidak dalam status pending approval." as const }
  }

  if (session.user.role !== "admin") {
    const assignment = await db.query.userLabAssignments.findFirst({
      where: and(eq(userLabAssignments.userId, session.user.id), eq(userLabAssignments.labId, txRow.labId)),
      columns: { userId: true },
    })
    if (!assignment) {
      return { error: "Anda tidak memiliki akses approval untuk lab transaksi ini." as const }
    }
  }

  if (!txRow.approvalMatrixId) {
    return { error: "Transaksi belum memiliki matrix approval. Hubungi admin." as const }
  }

  const matrixRow = await db.query.borrowingApprovalMatrices.findFirst({
    where: eq(borrowingApprovalMatrices.id, txRow.approvalMatrixId),
    columns: {
      id: true,
      isActive: true,
      step1ApproverUserId: true,
      step2ApproverUserId: true,
    },
  })
  if (!matrixRow?.isActive || !matrixRow.step1ApproverUserId || !matrixRow.step2ApproverUserId) {
    return { error: "Matrix approval transaksi tidak valid. Hubungi admin." as const }
  }

  const approvedRows = await db
    .select({
      stepOrder: borrowingApprovals.stepOrder,
      approverRole: users.role,
    })
    .from(borrowingApprovals)
    .innerJoin(users, eq(users.id, borrowingApprovals.approverUserId))
    .where(and(eq(borrowingApprovals.transactionId, txRow.id), eq(borrowingApprovals.decision, "approved")))

  const approvedStepSet = new Set(approvedRows.map((r) => r.stepOrder))
  const nextStepOrder = BORROWING_APPROVAL_FLOW.find((stepOrder) => !approvedStepSet.has(stepOrder))
  const requiredApproverUserId =
    nextStepOrder === 1 ? matrixRow.step1ApproverUserId : nextStepOrder === 2 ? matrixRow.step2ApproverUserId : null
  const requiredRole = nextStepOrder === 1 ? "dosen" : nextStepOrder === 2 ? "petugas_plp" : null
  if (!nextStepOrder || !requiredApproverUserId || !requiredRole) {
    return { error: "Approval sudah lengkap untuk transaksi ini." as const }
  }
  const isAdminOverride = session.user.role === "admin" && session.user.id !== requiredApproverUserId

  if (session.user.role !== "admin") {
    if (session.user.role !== requiredRole) {
      return {
        error:
          requiredRole === "dosen"
            ? "Approval tahap 1 wajib dilakukan Dosen."
            : "Approval tahap 2 wajib dilakukan Petugas PLP setelah Dosen.",
      }
    }
    if (session.user.id !== requiredApproverUserId) {
      return {
        error:
          requiredRole === "dosen"
            ? "Anda bukan approver Dosen yang ditetapkan pada matrix lab ini."
            : "Anda bukan approver Petugas PLP yang ditetapkan pada matrix lab ini.",
      }
    }
  }
  return { session, txRow, nextStepOrder, requiredRole, requiredApproverUserId, isAdminOverride }
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

  const { session, txRow, nextStepOrder, requiredRole, requiredApproverUserId, isAdminOverride } = validated
  const noteTrimmed = parsed.data.note?.trim() || null
  if (isAdminOverride && !noteTrimmed) {
    return {
      ok: false,
      message:
        "Admin fallback wajib mengisi alasan approval karena approver matrix bukan user admin ini.",
    }
  }
  const approvalNote =
    isAdminOverride && noteTrimmed
      ? `[ADMIN FALLBACK ${requiredRole.toUpperCase()} | target:${requiredApproverUserId}] ${noteTrimmed}`
      : noteTrimmed

  try {
    await runBorrowingTx(async (tx) => {
      await tx.insert(borrowingApprovals).values({
        transactionId: txRow.id,
        approverUserId: session.user.id,
        decision: "approved",
        stepOrder: nextStepOrder,
        note: approvalNote,
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
          status: approvalCount >= BORROWING_APPROVAL_FLOW.length ? "approved_waiting_handover" : "pending_approval",
          approvedAt: approvalCount >= BORROWING_APPROVAL_FLOW.length ? new Date() : null,
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

  const { session, txRow, nextStepOrder, requiredRole, requiredApproverUserId, isAdminOverride } = validated
  const noteTrimmed = parsed.data.note?.trim() || null
  if (isAdminOverride && !noteTrimmed) {
    return {
      ok: false,
      message:
        "Admin fallback wajib mengisi alasan penolakan karena approver matrix bukan user admin ini.",
    }
  }
  const rejectionNote =
    isAdminOverride && noteTrimmed
      ? `[ADMIN FALLBACK ${requiredRole.toUpperCase()} | target:${requiredApproverUserId}] ${noteTrimmed}`
      : noteTrimmed

  try {
    await runBorrowingTx(async (tx) => {
      await tx.insert(borrowingApprovals).values({
        transactionId: txRow.id,
        approverUserId: session.user.id,
        decision: "rejected",
        stepOrder: nextStepOrder,
        note: rejectionNote,
      })

      await tx
        .update(borrowingTransactions)
        .set({
          status: "rejected",
          rejectionReason: rejectionNote || "Ditolak oleh approver",
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
  if (session.user.role === "dosen") return { ok: false, message: "Dosen tidak dapat memproses serah terima." }

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
    await runBorrowingTx(async (tx) => {
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
      if (approvalCount < BORROWING_APPROVAL_FLOW.length) {
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
    transactionId: formData.get("transactionId")?.toString() || undefined,
    transactionItemId: formData.get("transactionItemId")?.toString() || undefined,
    returnCondition: formData.get("returnCondition")?.toString() || undefined,
    returnItemsPayload: formData.get("returnItemsPayload")?.toString() || undefined,
    note: formData.get("note")?.toString() || undefined,
  })
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return {
      ok: false,
      message: issue ? mapReturnBorrowingIssueMessage(issue) : "Data pengembalian tidak valid.",
    }
  }

  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) return { ok: false, message: "Sesi tidak valid." }
  if (session.user.role === "mahasiswa") return { ok: false, message: "Akses ditolak." }
  if (session.user.role === "dosen") return { ok: false, message: "Dosen tidak dapat memproses pengembalian." }

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

  let returnItems: Array<{ transactionItemId: string; returnCondition: "baik" | "maintenance" | "damaged" }> = []
  if (parsed.data.returnItemsPayload?.trim()) {
    try {
      const raw = JSON.parse(parsed.data.returnItemsPayload) as unknown
      const list = z.array(returnItemConditionSchema).min(1).parse(raw)
      const seen = new Set<string>()
      returnItems = list.filter((item) => {
        if (seen.has(item.transactionItemId)) return false
        seen.add(item.transactionItemId)
        return true
      })
    } catch {
      return { ok: false, message: "Data item pengembalian tidak valid." }
    }
  } else if (parsed.data.transactionItemId && parsed.data.returnCondition) {
    returnItems = [
      {
        transactionItemId: parsed.data.transactionItemId,
        returnCondition: parsed.data.returnCondition,
      },
    ]
  }

  if (returnItems.length === 0) {
    return { ok: false, message: "Pilih minimal satu alat untuk dikembalikan." }
  }

  try {
    await runBorrowingTx(async (tx) => {
      const selectedItemIds = returnItems.map((item) => item.transactionItemId)
      const returnConditionByItemId = new Map(
        returnItems.map((item) => [item.transactionItemId, item.returnCondition] as const),
      )

      const itemRows = await tx
        .select({
          id: borrowingTransactionItems.id,
          transactionId: borrowingTransactionItems.transactionId,
          itemType: borrowingTransactionItems.itemType,
          toolAssetId: borrowingTransactionItems.toolAssetId,
        })
        .from(borrowingTransactionItems)
        .where(and(inArray(borrowingTransactionItems.id, selectedItemIds), eq(borrowingTransactionItems.transactionId, txRow.id)))

      if (itemRows.length !== selectedItemIds.length) {
        throw new Error("Sebagian item pengembalian tidak ditemukan pada transaksi ini.")
      }
      if (itemRows.some((txItem) => txItem.itemType !== "tool_asset" || !txItem.toolAssetId)) {
        throw new Error("Hanya item alat yang dapat dikembalikan.")
      }

      const existingReturns = await tx
        .select({ transactionItemId: borrowingReturnItems.transactionItemId })
        .from(borrowingReturnItems)
        .where(inArray(borrowingReturnItems.transactionItemId, selectedItemIds))
      if (existingReturns.length > 0) {
        throw new Error("Sebagian item alat sudah dikembalikan sebelumnya.")
      }

      const toolAssetIds = itemRows.map((item) => item.toolAssetId!).filter(Boolean)
      const toolStates = await tx
        .select({ id: toolAssets.id, status: toolAssets.status })
        .from(toolAssets)
        .where(inArray(toolAssets.id, toolAssetIds))
      if (toolStates.length !== toolAssetIds.length) {
        throw new Error("Sebagian asset alat tidak ditemukan.")
      }
      if (toolStates.some((toolState) => toolState.status !== "borrowed")) {
        throw new Error("Sebagian asset alat tidak dalam status dipinjam.")
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

      await tx.insert(borrowingReturnItems).values(
        itemRows.map((txItem) => {
          const returnCondition = returnConditionByItemId.get(txItem.id)
          if (!returnCondition) {
            throw new Error("Kondisi pengembalian item tidak valid.")
          }
          return {
            returnId: returnHeader.id,
            transactionItemId: txItem.id,
            toolAssetId: txItem.toolAssetId!,
            returnCondition,
            note: parsed.data.note?.trim() || null,
          }
        }),
      )

      for (const txItem of itemRows) {
        const returnCondition = returnConditionByItemId.get(txItem.id)
        if (!returnCondition) continue
        const nextAssetStatus =
          returnCondition === "baik"
            ? "available"
            : returnCondition === "maintenance"
              ? "maintenance"
              : "damaged"

        await tx
          .update(toolAssets)
          .set({
            status: nextAssetStatus,
            condition: returnCondition,
            updatedAt: new Date(),
          })
          .where(eq(toolAssets.id, txItem.toolAssetId!))
      }

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
