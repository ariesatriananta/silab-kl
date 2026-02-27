"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import {
  borrowingTransactionItems,
  toolAssetEvents,
  toolAssets,
  toolModels,
  userLabAssignments,
} from "@/lib/db/schema"
import { writeSecurityAuditLog } from "@/lib/security/audit"

export type ToolMasterActionResult = { ok: boolean; message: string }

const createToolSchema = z.object({
  labId: z.string().uuid(),
  modelCode: z.string().trim().min(2).max(50),
  name: z.string().trim().min(2).max(200),
  brand: z.string().trim().max(100).optional(),
  category: z.string().trim().min(2).max(100),
  locationDetail: z.string().trim().max(255).optional(),
  imageUrl: z.string().trim().max(1000).optional(),
  description: z.string().trim().max(2000).optional(),
  unitCount: z.coerce.number().int().min(1).max(200),
  inventoryCodePrefix: z.string().trim().max(50).optional(),
  initialCondition: z.enum(["baik", "maintenance", "damaged"]).default("baik"),
})

const updateToolSchema = z.object({
  assetId: z.string().uuid(),
  modelId: z.string().uuid(),
  labId: z.string().uuid(),
  modelCode: z.string().trim().min(2).max(50),
  name: z.string().trim().min(2).max(200),
  brand: z.string().trim().max(100).optional(),
  category: z.string().trim().min(2).max(100),
  locationDetail: z.string().trim().max(255).optional(),
  imageUrl: z.string().trim().max(1000).optional(),
  description: z.string().trim().max(2000).optional(),
  inventoryCode: z.string().trim().max(100).optional(),
  status: z.enum(["available", "borrowed", "maintenance", "damaged", "inactive"]),
  condition: z.enum(["baik", "maintenance", "damaged"]),
  assetNotes: z.string().trim().max(1000).optional(),
  eventNote: z.string().trim().max(500).optional(),
})

const deactivateToolSchema = z.object({
  assetId: z.string().uuid(),
})

async function getActor() {
  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) return { error: "Sesi tidak valid." as const }
  if (session.user.role === "mahasiswa") return { error: "Mahasiswa tidak dapat mengelola master alat." as const }
  if (session.user.role === "dosen") return { error: "Dosen tidak dapat mengelola master alat." as const }
  return { session }
}

async function ensureLabAccess(role: string, userId: string, labId: string) {
  if (role === "admin") return { ok: true as const }
  const row = await db.query.userLabAssignments.findFirst({
    where: and(eq(userLabAssignments.userId, userId), eq(userLabAssignments.labId, labId)),
    columns: { userId: true },
  })
  return row ? { ok: true as const } : { ok: false as const, message: "Anda tidak memiliki akses ke lab ini." }
}

function normalizeOptional(value?: string) {
  const v = value?.trim()
  return v ? v : null
}

function buildAssetCode(modelCode: string, seq: number) {
  return `${modelCode}-${String(seq).padStart(3, "0")}`
}

function buildQrValue(assetCode: string) {
  return `TOOL:${assetCode}`
}

export async function createToolMasterAction(
  _prev: ToolMasterActionResult | null,
  formData: FormData,
): Promise<ToolMasterActionResult> {
  const parsed = createToolSchema.safeParse({
    labId: formData.get("labId"),
    modelCode: formData.get("modelCode"),
    name: formData.get("name"),
    brand: formData.get("brand")?.toString() || undefined,
    category: formData.get("category"),
    locationDetail: formData.get("locationDetail")?.toString() || undefined,
    imageUrl: formData.get("imageUrl")?.toString() || undefined,
    description: formData.get("description")?.toString() || undefined,
    unitCount: formData.get("unitCount"),
    inventoryCodePrefix: formData.get("inventoryCodePrefix")?.toString() || undefined,
    initialCondition: formData.get("initialCondition") ?? "baik",
  })
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data alat tidak valid." }

  const actor = await getActor()
  if ("error" in actor) return { ok: false, message: actor.error ?? "Sesi tidak valid." }
  const { session } = actor

  const access = await ensureLabAccess(session.user.role, session.user.id, parsed.data.labId)
  if (!access.ok) return { ok: false, message: access.message }

  try {
    await db.transaction(async (tx) => {
      const [model] = await tx
        .insert(toolModels)
        .values({
          labId: parsed.data.labId,
          code: parsed.data.modelCode,
          name: parsed.data.name,
          brand: normalizeOptional(parsed.data.brand),
          category: parsed.data.category,
          locationDetail: normalizeOptional(parsed.data.locationDetail),
          imageUrl: normalizeOptional(parsed.data.imageUrl),
          description: normalizeOptional(parsed.data.description),
          isActive: true,
        })
        .returning({ id: toolModels.id })

      if (!model) throw new Error("Gagal membuat master alat.")

      const assetsPayload = Array.from({ length: parsed.data.unitCount }, (_, i) => {
        const assetCode = buildAssetCode(parsed.data.modelCode, i + 1)
        return {
          toolModelId: model.id,
          assetCode,
          inventoryCode: parsed.data.inventoryCodePrefix
            ? `${parsed.data.inventoryCodePrefix}-${String(i + 1).padStart(3, "0")}`
            : null,
          qrCodeValue: buildQrValue(assetCode),
          status: parsed.data.initialCondition === "baik" ? ("available" as const) : parsed.data.initialCondition,
          condition: parsed.data.initialCondition,
          isActive: true,
        }
      })

      const insertedAssets = await tx
        .insert(toolAssets)
        .values(assetsPayload)
        .returning({
          id: toolAssets.id,
          condition: toolAssets.condition,
          status: toolAssets.status,
        })

      if (insertedAssets.length > 0) {
        await tx.insert(toolAssetEvents).values(
          insertedAssets.map((asset) => ({
            toolAssetId: asset.id,
            eventType: "created" as const,
            conditionAfter: asset.condition,
            statusAfter: asset.status,
            note: `Unit alat dibuat (${parsed.data.unitCount} unit pada master ${parsed.data.modelCode}).`,
            actorUserId: session.user.id,
          })),
        )
      }
    })
  } catch (error) {
    const message =
      error instanceof Error &&
      (error.message.includes("tool_models_code_uq") || error.message.includes("duplicate key"))
        ? "Kode master alat sudah digunakan."
        : error instanceof Error &&
            (error.message.includes("tool_assets_asset_code_uq") || error.message.includes("tool_assets_qr_code_value_uq"))
          ? "Kode unit/QR bentrok. Ganti kode master alat."
          : "Gagal menambahkan alat."
    return { ok: false, message }
  }

  await writeSecurityAuditLog({
    category: "tool_master",
    action: "create",
    outcome: "success",
    userId: session.user.id,
    actorRole: session.user.role,
    targetType: "lab",
    targetId: parsed.data.labId,
    metadata: { modelCode: parsed.data.modelCode, unitCount: parsed.data.unitCount },
  })

  revalidatePath("/dashboard/tools")
  revalidatePath("/dashboard/student-tools")
  revalidatePath("/dashboard/dashboard")
  return { ok: true, message: "Master alat dan unit berhasil ditambahkan." }
}

export async function updateToolAssetAction(
  _prev: ToolMasterActionResult | null,
  formData: FormData,
): Promise<ToolMasterActionResult> {
  const parsed = updateToolSchema.safeParse({
    assetId: formData.get("assetId"),
    modelId: formData.get("modelId"),
    labId: formData.get("labId"),
    modelCode: formData.get("modelCode"),
    name: formData.get("name"),
    brand: formData.get("brand")?.toString() || undefined,
    category: formData.get("category"),
    locationDetail: formData.get("locationDetail")?.toString() || undefined,
    imageUrl: formData.get("imageUrl")?.toString() || undefined,
    description: formData.get("description")?.toString() || undefined,
    inventoryCode: formData.get("inventoryCode")?.toString() || undefined,
    status: formData.get("status"),
    condition: formData.get("condition"),
    assetNotes: formData.get("assetNotes")?.toString() || undefined,
    eventNote: formData.get("eventNote")?.toString() || undefined,
  })
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data alat tidak valid." }

  const actor = await getActor()
  if ("error" in actor) return { ok: false, message: actor.error ?? "Sesi tidak valid." }
  const { session } = actor

  const existing = await db
    .select({
      assetId: toolAssets.id,
      modelId: toolModels.id,
      currentLabId: toolModels.labId,
      currentCondition: toolAssets.condition,
      currentStatus: toolAssets.status,
      currentAssetNotes: toolAssets.notes,
    })
    .from(toolAssets)
    .innerJoin(toolModels, eq(toolModels.id, toolAssets.toolModelId))
    .where(eq(toolAssets.id, parsed.data.assetId))
    .limit(1)

  const current = existing[0]
  if (!current) return { ok: false, message: "Alat tidak ditemukan." }
  if (current.modelId !== parsed.data.modelId) return { ok: false, message: "Data alat tidak konsisten." }

  const oldLabAccess = await ensureLabAccess(session.user.role, session.user.id, current.currentLabId)
  if (!oldLabAccess.ok) return { ok: false, message: oldLabAccess.message }
  const newLabAccess = await ensureLabAccess(session.user.role, session.user.id, parsed.data.labId)
  if (!newLabAccess.ok) return { ok: false, message: newLabAccess.message }

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(toolModels)
        .set({
          labId: parsed.data.labId,
          code: parsed.data.modelCode,
          name: parsed.data.name,
          brand: normalizeOptional(parsed.data.brand),
          category: parsed.data.category,
          locationDetail: normalizeOptional(parsed.data.locationDetail),
          imageUrl: normalizeOptional(parsed.data.imageUrl),
          description: normalizeOptional(parsed.data.description),
          updatedAt: new Date(),
        })
        .where(eq(toolModels.id, parsed.data.modelId))

      await tx
        .update(toolAssets)
        .set({
          inventoryCode: normalizeOptional(parsed.data.inventoryCode),
          status: parsed.data.status,
          condition: parsed.data.condition,
          notes: normalizeOptional(parsed.data.assetNotes),
          isActive: parsed.data.status !== "inactive",
          updatedAt: new Date(),
        })
        .where(eq(toolAssets.id, parsed.data.assetId))

      const statusChanged = current.currentStatus !== parsed.data.status
      const conditionChanged = current.currentCondition !== parsed.data.condition
      const noteChanged = (current.currentAssetNotes ?? null) !== (normalizeOptional(parsed.data.assetNotes) ?? null)

      if (statusChanged || conditionChanged || noteChanged || parsed.data.eventNote) {
        await tx.insert(toolAssetEvents).values({
          toolAssetId: parsed.data.assetId,
          eventType: conditionChanged
            ? parsed.data.condition === "maintenance"
              ? "maintenance_update"
              : "condition_update"
            : statusChanged
              ? "status_update"
              : "note_update",
          conditionBefore: conditionChanged ? current.currentCondition : null,
          conditionAfter: conditionChanged ? parsed.data.condition : null,
          statusBefore: statusChanged ? current.currentStatus : null,
          statusAfter: statusChanged ? parsed.data.status : null,
          note: normalizeOptional(parsed.data.eventNote) ?? (noteChanged ? "Catatan alat diperbarui." : null),
          actorUserId: session.user.id,
        })
      }
    })
  } catch (error) {
    const duplicate =
      error instanceof Error &&
      (error.message.includes("tool_models_code_uq") ||
        error.message.includes("tool_assets_inventory_code_uq") ||
        error.message.includes("duplicate key"))
    return {
      ok: false,
      message: duplicate ? "Kode alat/inventaris sudah digunakan." : "Gagal memperbarui alat.",
    }
  }

  await writeSecurityAuditLog({
    category: "tool_master",
    action: "update_asset",
    outcome: "success",
    userId: session.user.id,
    actorRole: session.user.role,
    targetType: "tool_asset",
    targetId: parsed.data.assetId,
    metadata: { modelId: parsed.data.modelId },
  })

  revalidatePath("/dashboard/tools")
  revalidatePath("/dashboard/student-tools")
  revalidatePath("/dashboard/dashboard")
  return { ok: true, message: "Data alat berhasil diperbarui." }
}

export async function deactivateToolAssetAction(
  _prev: ToolMasterActionResult | null,
  formData: FormData,
): Promise<ToolMasterActionResult> {
  const parsed = deactivateToolSchema.safeParse({
    assetId: formData.get("assetId"),
  })
  if (!parsed.success) return { ok: false, message: "Data nonaktif alat tidak valid." }

  const actor = await getActor()
  if ("error" in actor) return { ok: false, message: actor.error ?? "Sesi tidak valid." }
  const { session } = actor

  const row = await db
    .select({
      assetId: toolAssets.id,
      modelId: toolModels.id,
      labId: toolModels.labId,
      assetCode: toolAssets.assetCode,
      status: toolAssets.status,
      condition: toolAssets.condition,
      isActive: toolAssets.isActive,
    })
    .from(toolAssets)
    .innerJoin(toolModels, eq(toolModels.id, toolAssets.toolModelId))
    .where(eq(toolAssets.id, parsed.data.assetId))
    .limit(1)

  const existing = row[0]
  if (!existing) return { ok: false, message: "Unit alat tidak ditemukan." }
  const access = await ensureLabAccess(session.user.role, session.user.id, existing.labId)
  if (!access.ok) return { ok: false, message: access.message }
  if (!existing.isActive || existing.status === "inactive") return { ok: false, message: "Unit alat sudah nonaktif." }
  if (existing.status === "borrowed") return { ok: false, message: "Unit alat sedang dipinjam dan tidak dapat dinonaktifkan." }

  const ref = await db.query.borrowingTransactionItems.findFirst({
    where: eq(borrowingTransactionItems.toolAssetId, existing.assetId),
    columns: { id: true },
  })
  if (ref) {
    return {
      ok: false,
      message: "Unit alat tidak dapat dinonaktifkan karena sudah direferensikan transaksi. Gunakan status maintenance/damaged bila perlu.",
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(toolAssets)
      .set({
        status: "inactive",
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(toolAssets.id, existing.assetId))

    await tx.insert(toolAssetEvents).values({
      toolAssetId: existing.assetId,
      eventType: "status_update",
      statusBefore: existing.status,
      statusAfter: "inactive",
      note: "Unit alat dinonaktifkan.",
      actorUserId: session.user.id,
    })
  })

  await writeSecurityAuditLog({
    category: "tool_master",
    action: "deactivate_asset",
    outcome: "success",
    userId: session.user.id,
    actorRole: session.user.role,
    targetType: "tool_asset",
    targetId: existing.assetId,
    metadata: { assetCode: existing.assetCode },
  })

  revalidatePath("/dashboard/tools")
  revalidatePath("/dashboard/student-tools")
  revalidatePath("/dashboard/dashboard")
  return { ok: true, message: `Unit ${existing.assetCode} berhasil dinonaktifkan.` }
}
