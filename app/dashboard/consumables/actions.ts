"use server"

import { revalidatePath } from "next/cache"
import { and, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import {
  borrowingTransactionItems,
  consumableItems,
  consumableStockMovements,
  materialRequestItems,
  materialRequests,
  userLabAssignments,
} from "@/lib/db/schema"
import { writeSecurityAuditLog } from "@/lib/security/audit"

export type MaterialRequestActionResult = { ok: boolean; message: string }
export type ConsumableMasterActionResult = { ok: boolean; message: string }
export type ConsumableStockInActionResult = { ok: boolean; message: string }

const createMaterialRequestSchema = z.object({
  labId: z.string().uuid(),
  itemsPayload: z.string(),
  note: z.string().max(500).optional(),
})

const createItemsPayloadSchema = z.object({
  items: z
    .array(
      z.object({
        consumableItemId: z.string().uuid(),
        qty: z.number().int().min(1),
      }),
    )
    .default([]),
})

const processMaterialRequestSchema = z.object({
  requestId: z.string().uuid(),
  note: z.string().max(500).optional(),
})

const consumableMasterSchema = z.object({
  labId: z.string().uuid(),
  code: z.string().trim().min(2).max(50),
  name: z.string().trim().min(2).max(200),
  category: z.string().trim().min(2).max(100),
  unit: z.string().trim().min(1).max(50),
  stockQty: z.coerce.number().int().min(0),
  minStockQty: z.coerce.number().int().min(0),
})

const consumableMasterUpdateSchema = consumableMasterSchema.extend({
  consumableId: z.string().uuid(),
})

const consumableDeactivateSchema = z.object({
  consumableId: z.string().uuid(),
})

const consumableStockInSchema = z.object({
  consumableId: z.string().uuid(),
  qtyIn: z.coerce.number().int().min(1),
  note: z.string().trim().max(500).optional(),
  source: z.string().trim().max(100).optional(),
})

function generateMaterialRequestCode() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  const ymd = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const rnd = Math.floor(Math.random() * 9000) + 1000
  return `MTR-${ymd}-${rnd}`
}

function movementNote(base: string | undefined, source: string | undefined) {
  const note = base?.trim()
  const src = source?.trim()
  if (src && note) return `${src} | ${note}`
  if (src) return `Sumber: ${src}`
  return note || null
}

async function getActor() {
  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) return { error: "Sesi tidak valid." as const }
  return { session }
}

async function ensureLabAccess(role: string, userId: string, labId: string) {
  if (role === "dosen") return { ok: false as const, message: "Dosen tidak memiliki akses operasional bahan." }
  if (role === "admin" || role === "mahasiswa") return { ok: true as const }
  const assignment = await db.query.userLabAssignments.findFirst({
    where: and(eq(userLabAssignments.userId, userId), eq(userLabAssignments.labId, labId)),
    columns: { userId: true },
  })
  return assignment ? { ok: true as const } : { ok: false as const, message: "Anda tidak memiliki akses ke lab ini." }
}

async function ensureConsumableManagerForLab(labId: string) {
  const actor = await getActor()
  if ("error" in actor) return { error: actor.error as string }
  const { session } = actor
  if (session.user.role === "dosen") return { error: "Dosen tidak dapat mengelola bahan." as const }
  if (session.user.role === "mahasiswa") {
    return { error: "Mahasiswa tidak dapat mengelola master bahan." as const }
  }
  const access = await ensureLabAccess(session.user.role, session.user.id, labId)
  if (!access.ok) return { error: access.message as string }
  return { session }
}

async function validateProcessAccess(requestId: string) {
  const actor = await getActor()
  if ("error" in actor) return { error: actor.error as string }
  const { session } = actor
  if (session.user.role === "dosen") return { error: "Dosen tidak dapat memproses permintaan bahan." as const }
  if (session.user.role === "mahasiswa") return { error: "Mahasiswa tidak dapat memproses permintaan bahan." as const }

  const req = await db.query.materialRequests.findFirst({
    where: eq(materialRequests.id, requestId),
    columns: { id: true, labId: true, status: true },
  })
  if (!req) return { error: "Permintaan tidak ditemukan." as const }

  if (session.user.role === "petugas_plp") {
    const access = await ensureLabAccess(session.user.role, session.user.id, req.labId)
    if (!access.ok) return { error: access.message as string }
  }

  return { session, req }
}

export async function createMaterialRequestAction(
  _prev: MaterialRequestActionResult | null,
  formData: FormData,
): Promise<MaterialRequestActionResult> {
  const actor = await getActor()
  if ("error" in actor) return { ok: false, message: actor.error ?? "Sesi tidak valid." }
  const { session } = actor

  const parsed = createMaterialRequestSchema.safeParse({
    labId: formData.get("labId"),
    itemsPayload: formData.get("itemsPayload")?.toString() ?? "",
    note: formData.get("note")?.toString() || undefined,
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data permintaan bahan tidak valid." }
  }

  let items: Array<{ consumableItemId: string; qty: number }> = []
  try {
    const raw = JSON.parse(parsed.data.itemsPayload) as unknown
    const payload = createItemsPayloadSchema.parse(raw)
    items = payload.items
      .filter((i) => i.qty > 0)
      .map((i) => ({ consumableItemId: i.consumableItemId, qty: i.qty }))
  } catch {
    return { ok: false, message: "Payload item permintaan bahan tidak valid." }
  }
  if (items.length === 0) return { ok: false, message: "Pilih minimal satu bahan dengan qty > 0." }

  const access = await ensureLabAccess(session.user.role, session.user.id, parsed.data.labId)
  if (!access.ok) return { ok: false, message: access.message }

  const rows = await db
    .select({ id: consumableItems.id, labId: consumableItems.labId })
    .from(consumableItems)
    .where(inArray(consumableItems.id, items.map((i) => i.consumableItemId)))

  if (rows.length !== items.length) return { ok: false, message: "Sebagian bahan tidak ditemukan." }
  if (rows.some((r) => r.labId !== parsed.data.labId)) {
    return { ok: false, message: "Semua bahan harus berasal dari lab yang sama." }
  }

  try {
    await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(materialRequests)
        .values({
          code: generateMaterialRequestCode(),
          labId: parsed.data.labId,
          requesterUserId: session.user.id,
          status: "pending",
          note: parsed.data.note?.trim() || null,
        })
        .returning({ id: materialRequests.id })

      if (!inserted) throw new Error("Gagal membuat permintaan bahan.")

      await tx.insert(materialRequestItems).values(
        items.map((item) => ({
          requestId: inserted.id,
          consumableItemId: item.consumableItemId,
          qtyRequested: item.qty,
          qtyFulfilled: 0,
        })),
      )
    })
  } catch (error) {
    const duplicate =
      error instanceof Error &&
      (error.message.includes("material_requests_code_uq") || error.message.includes("duplicate"))
    return {
      ok: false,
      message: duplicate ? "Kode permintaan bentrok. Silakan kirim ulang." : "Gagal menyimpan permintaan bahan.",
    }
  }

  await writeSecurityAuditLog({
    category: "consumables",
    action: "create_material_request",
    outcome: "success",
    userId: session.user.id,
    actorRole: session.user.role,
    targetType: "lab",
    targetId: parsed.data.labId,
    metadata: { itemCount: items.length },
  })

  revalidatePath("/dashboard/consumables")
  revalidatePath("/dashboard/dashboard")
  return { ok: true, message: "Permintaan bahan berhasil dibuat." }
}

export async function createConsumableMasterAction(
  _prev: ConsumableMasterActionResult | null,
  formData: FormData,
): Promise<ConsumableMasterActionResult> {
  const parsed = consumableMasterSchema.safeParse({
    labId: formData.get("labId"),
    code: formData.get("code"),
    name: formData.get("name"),
    category: formData.get("category"),
    unit: formData.get("unit"),
    stockQty: formData.get("stockQty"),
    minStockQty: formData.get("minStockQty"),
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data bahan tidak valid." }
  }

  const auth = await ensureConsumableManagerForLab(parsed.data.labId)
  if ("error" in auth) return { ok: false, message: auth.error ?? "Akses ditolak." }

  try {
    await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(consumableItems)
        .values({
          labId: parsed.data.labId,
          code: parsed.data.code,
          name: parsed.data.name,
          category: parsed.data.category,
          unit: parsed.data.unit,
          stockQty: parsed.data.stockQty,
          minStockQty: parsed.data.minStockQty,
          isActive: true,
        })
        .returning({ id: consumableItems.id })

      if (inserted && parsed.data.stockQty > 0) {
        await tx.insert(consumableStockMovements).values({
          consumableItemId: inserted.id,
          movementType: "stock_in",
          qtyDelta: parsed.data.stockQty,
          qtyBefore: 0,
          qtyAfter: parsed.data.stockQty,
          note: "Stok awal saat membuat master bahan.",
          referenceType: "consumable_master_create",
          actorUserId: auth.session.user.id,
        })
      }
    })
  } catch (error) {
    const duplicate =
      error instanceof Error &&
      (error.message.includes("consumable_items_code_uq") || error.message.includes("duplicate"))
    return {
      ok: false,
      message: duplicate ? "Kode bahan sudah digunakan." : "Gagal menambahkan master bahan.",
    }
  }

  await writeSecurityAuditLog({
    category: "consumables",
    action: "create_master",
    outcome: "success",
    userId: auth.session.user.id,
    actorRole: auth.session.user.role,
    targetType: "lab",
    targetId: parsed.data.labId,
    metadata: { code: parsed.data.code, stockQty: parsed.data.stockQty },
  })

  revalidatePath("/dashboard/consumables")
  return { ok: true, message: "Master bahan berhasil ditambahkan." }
}

export async function updateConsumableMasterAction(
  _prev: ConsumableMasterActionResult | null,
  formData: FormData,
): Promise<ConsumableMasterActionResult> {
  const parsed = consumableMasterUpdateSchema.safeParse({
    consumableId: formData.get("consumableId"),
    labId: formData.get("labId"),
    code: formData.get("code"),
    name: formData.get("name"),
    category: formData.get("category"),
    unit: formData.get("unit"),
    stockQty: formData.get("stockQty"),
    minStockQty: formData.get("minStockQty"),
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data bahan tidak valid." }
  }

  const existing = await db.query.consumableItems.findFirst({
    where: eq(consumableItems.id, parsed.data.consumableId),
    columns: { id: true, labId: true, stockQty: true },
  })
  if (!existing) return { ok: false, message: "Bahan tidak ditemukan." }

  const auth = await ensureConsumableManagerForLab(existing.labId)
  if ("error" in auth) return { ok: false, message: auth.error ?? "Akses ditolak." }
  if (auth.session.user.role === "petugas_plp" && existing.labId !== parsed.data.labId) {
    return { ok: false, message: "Petugas PLP tidak dapat memindahkan bahan ke lab lain." }
  }
  if (auth.session.user.role === "admin" && existing.labId !== parsed.data.labId) {
    const newLabAccess = await ensureLabAccess(auth.session.user.role, auth.session.user.id, parsed.data.labId)
    if (!newLabAccess.ok) return { ok: false, message: newLabAccess.message }
  }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(consumableItems)
        .set({
          labId: parsed.data.labId,
          code: parsed.data.code,
          name: parsed.data.name,
          category: parsed.data.category,
          unit: parsed.data.unit,
          stockQty: parsed.data.stockQty,
          minStockQty: parsed.data.minStockQty,
          updatedAt: new Date(),
        })
        .where(eq(consumableItems.id, parsed.data.consumableId))

      const delta = parsed.data.stockQty - existing.stockQty
      if (delta !== 0) {
        await tx.insert(consumableStockMovements).values({
          consumableItemId: parsed.data.consumableId,
          movementType: "manual_adjustment",
          qtyDelta: delta,
          qtyBefore: existing.stockQty,
          qtyAfter: parsed.data.stockQty,
          note: "Koreksi stok melalui edit master bahan.",
          referenceType: "consumable_master_update",
          referenceId: parsed.data.consumableId,
          actorUserId: auth.session.user.id,
        })
      }
    })
  } catch (error) {
    const duplicate =
      error instanceof Error &&
      (error.message.includes("consumable_items_code_uq") || error.message.includes("duplicate"))
    return {
      ok: false,
      message: duplicate ? "Kode bahan sudah digunakan." : "Gagal memperbarui master bahan.",
    }
  }

  await writeSecurityAuditLog({
    category: "consumables",
    action: "update_master",
    outcome: "success",
    userId: auth.session.user.id,
    actorRole: auth.session.user.role,
    targetType: "consumable_item",
    targetId: parsed.data.consumableId,
    metadata: { labId: parsed.data.labId },
  })

  revalidatePath("/dashboard/consumables")
  return { ok: true, message: "Master bahan berhasil diperbarui." }
}

export async function stockInConsumableAction(
  _prev: ConsumableStockInActionResult | null,
  formData: FormData,
): Promise<ConsumableStockInActionResult> {
  const parsed = consumableStockInSchema.safeParse({
    consumableId: formData.get("consumableId"),
    qtyIn: formData.get("qtyIn"),
    note: formData.get("note")?.toString() || undefined,
    source: formData.get("source")?.toString() || undefined,
  })
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data stok masuk tidak valid." }

  const existing = await db.query.consumableItems.findFirst({
    where: eq(consumableItems.id, parsed.data.consumableId),
    columns: { id: true, labId: true, stockQty: true, name: true, isActive: true },
  })
  if (!existing) return { ok: false, message: "Bahan tidak ditemukan." }
  if (!existing.isActive) return { ok: false, message: "Bahan nonaktif tidak dapat ditambah stok." }

  const auth = await ensureConsumableManagerForLab(existing.labId)
  if ("error" in auth) return { ok: false, message: auth.error ?? "Akses ditolak." }

  try {
    await db.transaction(async (tx) => {
      const before = existing.stockQty
      const after = before + parsed.data.qtyIn
      await tx
        .update(consumableItems)
        .set({
          stockQty: after,
          updatedAt: new Date(),
        })
        .where(eq(consumableItems.id, existing.id))

      await tx.insert(consumableStockMovements).values({
        consumableItemId: existing.id,
        movementType: "stock_in",
        qtyDelta: parsed.data.qtyIn,
        qtyBefore: before,
        qtyAfter: after,
        note: movementNote(parsed.data.note, parsed.data.source),
        referenceType: "manual_stock_in",
        referenceId: existing.id,
        actorUserId: auth.session.user.id,
      })
    })
  } catch (error) {
    console.error("stockInConsumableAction error:", error)
    await writeSecurityAuditLog({
      category: "consumables",
      action: "stock_in",
      outcome: "failure",
      userId: auth.session.user.id,
      actorRole: auth.session.user.role,
      targetType: "consumable_item",
      targetId: existing.id,
    })
    return { ok: false, message: "Gagal memproses stok masuk." }
  }

  await writeSecurityAuditLog({
    category: "consumables",
    action: "stock_in",
    outcome: "success",
    userId: auth.session.user.id,
    actorRole: auth.session.user.role,
    targetType: "consumable_item",
    targetId: existing.id,
    metadata: { qtyIn: parsed.data.qtyIn },
  })

  revalidatePath("/dashboard/consumables")
  revalidatePath("/dashboard/dashboard")
  return { ok: true, message: `Stok masuk untuk "${existing.name}" berhasil dicatat.` }
}

export async function deactivateConsumableMasterAction(
  _prev: ConsumableMasterActionResult | null,
  formData: FormData,
): Promise<ConsumableMasterActionResult> {
  const parsed = consumableDeactivateSchema.safeParse({
    consumableId: formData.get("consumableId"),
  })
  if (!parsed.success) return { ok: false, message: "Data nonaktif bahan tidak valid." }

  const existing = await db.query.consumableItems.findFirst({
    where: eq(consumableItems.id, parsed.data.consumableId),
    columns: { id: true, labId: true, isActive: true, name: true },
  })
  if (!existing) return { ok: false, message: "Bahan tidak ditemukan." }
  if (!existing.isActive) return { ok: false, message: "Bahan sudah nonaktif." }

  const auth = await ensureConsumableManagerForLab(existing.labId)
  if ("error" in auth) return { ok: false, message: auth.error ?? "Akses ditolak." }

  const [materialRef, borrowingRef] = await Promise.all([
    db.query.materialRequestItems.findFirst({
      where: eq(materialRequestItems.consumableItemId, existing.id),
      columns: { id: true },
    }),
    db.query.borrowingTransactionItems.findFirst({
      where: eq(borrowingTransactionItems.consumableItemId, existing.id),
      columns: { id: true },
    }),
  ])

  if (materialRef || borrowingRef) {
    return {
      ok: false,
      message:
        "Bahan tidak dapat dinonaktifkan karena sudah direferensikan transaksi/permintaan. Gunakan edit untuk koreksi data.",
    }
  }

  await db
    .update(consumableItems)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(eq(consumableItems.id, existing.id))

  await writeSecurityAuditLog({
    category: "consumables",
    action: "deactivate_master",
    outcome: "success",
    userId: auth.session.user.id,
    actorRole: auth.session.user.role,
    targetType: "consumable_item",
    targetId: existing.id,
  })

  revalidatePath("/dashboard/consumables")
  return { ok: true, message: `Bahan "${existing.name}" berhasil dinonaktifkan.` }
}

export async function approveMaterialRequestAction(formData: FormData) {
  await approveMaterialRequestWithFeedbackAction(null, formData)
}

export async function rejectMaterialRequestAction(formData: FormData) {
  await rejectMaterialRequestWithFeedbackAction(null, formData)
}

export async function fulfillMaterialRequestAction(formData: FormData) {
  await fulfillMaterialRequestWithFeedbackAction(null, formData)
}

export async function approveMaterialRequestWithFeedbackAction(
  _prev: MaterialRequestActionResult | null,
  formData: FormData,
): Promise<MaterialRequestActionResult> {
  const parsed = processMaterialRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    note: formData.get("note")?.toString() || undefined,
  })
  if (!parsed.success) return { ok: false, message: "Data approval permintaan tidak valid." }

  const validated = await validateProcessAccess(parsed.data.requestId)
  if ("error" in validated) return { ok: false, message: validated.error ?? "Akses ditolak." }
  const { session, req } = validated
  if (req.status !== "pending") {
    return { ok: false, message: "Hanya permintaan berstatus menunggu yang dapat disetujui." }
  }

  await db
    .update(materialRequests)
    .set({
      status: "approved",
      processedAt: new Date(),
      processedByUserId: session.user.id,
      note: parsed.data.note?.trim() || req.status,
      updatedAt: new Date(),
    })
    .where(eq(materialRequests.id, req.id))

  await writeSecurityAuditLog({
    category: "consumables",
    action: "approve_material_request",
    outcome: "success",
    userId: session.user.id,
    actorRole: session.user.role,
    targetType: "material_request",
    targetId: req.id,
  })

  revalidatePath("/dashboard/consumables")
  return { ok: true, message: "Permintaan bahan berhasil disetujui." }
}

export async function rejectMaterialRequestWithFeedbackAction(
  _prev: MaterialRequestActionResult | null,
  formData: FormData,
): Promise<MaterialRequestActionResult> {
  const parsed = processMaterialRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    note: formData.get("note")?.toString() || undefined,
  })
  if (!parsed.success) return { ok: false, message: "Data penolakan permintaan tidak valid." }

  const validated = await validateProcessAccess(parsed.data.requestId)
  if ("error" in validated) return { ok: false, message: validated.error ?? "Akses ditolak." }
  const { session, req } = validated
  if (!["pending", "approved"].includes(req.status)) {
    return { ok: false, message: "Permintaan tidak dapat ditolak pada status saat ini." }
  }

  await db
    .update(materialRequests)
    .set({
      status: "rejected",
      processedAt: new Date(),
      processedByUserId: session.user.id,
      note: parsed.data.note?.trim() || "Ditolak",
      updatedAt: new Date(),
    })
    .where(eq(materialRequests.id, req.id))

  await writeSecurityAuditLog({
    category: "consumables",
    action: "reject_material_request",
    outcome: "success",
    userId: session.user.id,
    actorRole: session.user.role,
    targetType: "material_request",
    targetId: req.id,
  })

  revalidatePath("/dashboard/consumables")
  return { ok: true, message: "Permintaan bahan berhasil ditolak." }
}

export async function fulfillMaterialRequestWithFeedbackAction(
  _prev: MaterialRequestActionResult | null,
  formData: FormData,
): Promise<MaterialRequestActionResult> {
  const parsed = processMaterialRequestSchema.safeParse({
    requestId: formData.get("requestId"),
    note: formData.get("note")?.toString() || undefined,
  })
  if (!parsed.success) return { ok: false, message: "Data pemenuhan permintaan tidak valid." }

  const validated = await validateProcessAccess(parsed.data.requestId)
  if ("error" in validated) return { ok: false, message: validated.error ?? "Akses ditolak." }
  const { session, req } = validated
  if (req.status !== "approved") {
    return { ok: false, message: "Hanya permintaan berstatus disetujui yang dapat dipenuhi." }
  }

  try {
    await db.transaction(async (tx) => {
      const lines = await tx
        .select({
          id: materialRequestItems.id,
          consumableItemId: materialRequestItems.consumableItemId,
          qtyRequested: materialRequestItems.qtyRequested,
        })
        .from(materialRequestItems)
        .where(eq(materialRequestItems.requestId, req.id))

      const stockRows = await tx
        .select({
          id: consumableItems.id,
          stockQty: consumableItems.stockQty,
        })
        .from(consumableItems)
        .where(inArray(consumableItems.id, lines.map((l) => l.consumableItemId)))

      const stockMap = new Map(stockRows.map((s) => [s.id, s.stockQty]))
      for (const line of lines) {
        const stock = stockMap.get(line.consumableItemId)
        if (stock == null || stock < line.qtyRequested) {
          throw new Error("Stok bahan tidak cukup untuk memenuhi permintaan.")
        }
      }

      for (const line of lines) {
        const currentStock = stockMap.get(line.consumableItemId) ?? 0
        const afterStock = currentStock - line.qtyRequested
        await tx
          .update(consumableItems)
          .set({
            stockQty: sql`${consumableItems.stockQty} - ${line.qtyRequested}`,
            updatedAt: new Date(),
          })
          .where(eq(consumableItems.id, line.consumableItemId))

        await tx.insert(consumableStockMovements).values({
          consumableItemId: line.consumableItemId,
          movementType: "material_request_fulfill",
          qtyDelta: -line.qtyRequested,
          qtyBefore: currentStock,
          qtyAfter: afterStock,
          note: parsed.data.note?.trim() || "Pemenuhan permintaan bahan",
          referenceType: "material_request",
          referenceId: req.id,
          actorUserId: session.user.id,
        })

        await tx
          .update(materialRequestItems)
          .set({ qtyFulfilled: line.qtyRequested })
          .where(eq(materialRequestItems.id, line.id))
      }

      await tx
        .update(materialRequests)
        .set({
          status: "fulfilled",
          processedAt: new Date(),
          processedByUserId: session.user.id,
          note: parsed.data.note?.trim() || "Terpenuhi",
          updatedAt: new Date(),
        })
        .where(eq(materialRequests.id, req.id))
    })
  } catch (error) {
    console.error("fulfillMaterialRequestAction error:", error)
    await writeSecurityAuditLog({
      category: "consumables",
      action: "fulfill_material_request",
      outcome: "failure",
      userId: session.user.id,
      actorRole: session.user.role,
      targetType: "material_request",
      targetId: req.id,
      metadata: { message: error instanceof Error ? error.message : "unknown_error" },
    })
    return {
      ok: false,
      message:
        error instanceof Error && error.message
          ? error.message
          : "Pemenuhan permintaan bahan gagal diproses.",
    }
  }

  await writeSecurityAuditLog({
    category: "consumables",
    action: "fulfill_material_request",
    outcome: "success",
    userId: session.user.id,
    actorRole: session.user.role,
    targetType: "material_request",
    targetId: req.id,
  })

  revalidatePath("/dashboard/consumables")
  return { ok: true, message: "Permintaan bahan berhasil dipenuhi." }
}
