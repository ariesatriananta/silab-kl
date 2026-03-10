"use server"

import { revalidatePath } from "next/cache"
import { eq, sql } from "drizzle-orm"
import { z } from "zod"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import {
  borrowingApprovalMatrices,
  borrowingTransactions,
  consumableItems,
  labRoomBookingRequests,
  labSchedules,
  labs,
  labUsageLogs,
  materialRequests,
  toolModels,
  userLabAssignments,
} from "@/lib/db/schema"
import { writeSecurityAuditLog } from "@/lib/security/audit"

export type LabManagementActionResult = {
  ok: boolean
  message: string
}

const createLabSchema = z.object({
  code: z.string().trim().min(2).max(50),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
})

const booleanFromForm = z.preprocess((value) => {
  if (value === true || value === "true" || value === "on" || value === 1 || value === "1") return true
  if (value === false || value === "false" || value === "off" || value === 0 || value === "0") return false
  return value
}, z.boolean())

const updateLabSchema = createLabSchema.extend({
  labId: z.string().uuid(),
  isActive: booleanFromForm,
})

const toggleLabSchema = z.object({
  labId: z.string().uuid(),
  nextActive: booleanFromForm,
})

const deleteLabSchema = z.object({
  labId: z.string().uuid(),
})

async function requireAdmin() {
  const session = await getServerAuthSession()
  if (!session?.user?.id || session.user.role !== "admin") {
    return { ok: false as const, message: "Akses ditolak." }
  }
  return { ok: true as const, session }
}

async function countRowsByLab<TTable extends { labId: unknown }>(table: TTable, labId: string) {
  const rows = await db
    .select({ total: sql<number>`count(*)` })
    // @ts-expect-error drizzle table generic helper for shared labId shape
    .from(table)
    // @ts-expect-error drizzle table generic helper for shared labId shape
    .where(eq(table.labId, labId))
  return Number(rows[0]?.total ?? 0)
}

export async function createLabManagementAction(
  _prev: LabManagementActionResult | null,
  formData: FormData,
): Promise<LabManagementActionResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, message: auth.message }

  const parsed = createLabSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description")?.toString() || undefined,
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data laboratorium tidak valid." }
  }

  try {
    await db.insert(labs).values({
      code: parsed.data.code,
      name: parsed.data.name,
      description: parsed.data.description || null,
      isActive: true,
    })

    await writeSecurityAuditLog({
      category: "lab_management",
      action: "create_lab",
      outcome: "success",
      userId: auth.session.user.id,
      actorRole: "admin",
      targetType: "lab",
      identifier: parsed.data.code,
      metadata: { name: parsed.data.name },
    })

    revalidatePath("/dashboard/labs")
    return { ok: true, message: `Laboratorium ${parsed.data.name} berhasil ditambahkan.` }
  } catch (error) {
    console.error("createLabManagementAction error:", error)
    return { ok: false, message: "Gagal menambahkan laboratorium. Cek kode/nama mungkin sudah dipakai." }
  }
}

export async function updateLabManagementAction(
  _prev: LabManagementActionResult | null,
  formData: FormData,
): Promise<LabManagementActionResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, message: auth.message }

  const parsed = updateLabSchema.safeParse({
    labId: formData.get("labId"),
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description")?.toString() || undefined,
    isActive: formData.get("isActive"),
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data laboratorium tidak valid." }
  }

  try {
    await db
      .update(labs)
      .set({
        code: parsed.data.code,
        name: parsed.data.name,
        description: parsed.data.description || null,
        isActive: parsed.data.isActive,
        updatedAt: new Date(),
      })
      .where(eq(labs.id, parsed.data.labId))

    await writeSecurityAuditLog({
      category: "lab_management",
      action: "update_lab",
      outcome: "success",
      userId: auth.session.user.id,
      actorRole: "admin",
      targetType: "lab",
      targetId: parsed.data.labId,
      identifier: parsed.data.code,
      metadata: { name: parsed.data.name, isActive: parsed.data.isActive },
    })

    revalidatePath("/dashboard/labs")
    return { ok: true, message: `Laboratorium ${parsed.data.name} berhasil diperbarui.` }
  } catch (error) {
    console.error("updateLabManagementAction error:", error)
    return { ok: false, message: "Gagal memperbarui laboratorium. Cek kode/nama mungkin sudah dipakai." }
  }
}

export async function toggleLabActiveAction(
  _prev: LabManagementActionResult | null,
  formData: FormData,
): Promise<LabManagementActionResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, message: auth.message }

  const parsed = toggleLabSchema.safeParse({
    labId: formData.get("labId"),
    nextActive: formData.get("nextActive"),
  })
  if (!parsed.success) return { ok: false, message: "Data status laboratorium tidak valid." }

  const existing = await db.query.labs.findFirst({
    where: eq(labs.id, parsed.data.labId),
    columns: { id: true, name: true, code: true, isActive: true },
  })
  if (!existing) return { ok: false, message: "Laboratorium tidak ditemukan." }

  try {
    await db
      .update(labs)
      .set({
        isActive: parsed.data.nextActive,
        updatedAt: new Date(),
      })
      .where(eq(labs.id, parsed.data.labId))

    await writeSecurityAuditLog({
      category: "lab_management",
      action: parsed.data.nextActive ? "activate_lab" : "deactivate_lab",
      outcome: "success",
      userId: auth.session.user.id,
      actorRole: "admin",
      targetType: "lab",
      targetId: existing.id,
      identifier: existing.code,
      metadata: { name: existing.name },
    })

    revalidatePath("/dashboard/labs")
    return {
      ok: true,
      message: `Laboratorium ${existing.name} berhasil ${parsed.data.nextActive ? "diaktifkan" : "dinonaktifkan"}.`,
    }
  } catch (error) {
    console.error("toggleLabActiveAction error:", error)
    return { ok: false, message: "Gagal mengubah status laboratorium." }
  }
}

export async function deleteLabManagementAction(
  _prev: LabManagementActionResult | null,
  formData: FormData,
): Promise<LabManagementActionResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, message: auth.message }

  const parsed = deleteLabSchema.safeParse({
    labId: formData.get("labId"),
  })
  if (!parsed.success) return { ok: false, message: "Data laboratorium tidak valid." }

  const existing = await db.query.labs.findFirst({
    where: eq(labs.id, parsed.data.labId),
    columns: { id: true, name: true, code: true },
  })
  if (!existing) return { ok: false, message: "Laboratorium tidak ditemukan." }

  const [
    assignmentCount,
    toolModelCount,
    consumableCount,
    borrowingCount,
    matrixCount,
    materialRequestCount,
    scheduleCount,
    usageCount,
    bookingCount,
  ] = await Promise.all([
    countRowsByLab(userLabAssignments, parsed.data.labId),
    countRowsByLab(toolModels, parsed.data.labId),
    countRowsByLab(consumableItems, parsed.data.labId),
    countRowsByLab(borrowingTransactions, parsed.data.labId),
    countRowsByLab(borrowingApprovalMatrices, parsed.data.labId),
    countRowsByLab(materialRequests, parsed.data.labId),
    countRowsByLab(labSchedules, parsed.data.labId),
    countRowsByLab(labUsageLogs, parsed.data.labId),
    countRowsByLab(labRoomBookingRequests, parsed.data.labId),
  ])

  const blockers = [
    assignmentCount > 0 ? `${assignmentCount} assignment user` : null,
    toolModelCount > 0 ? `${toolModelCount} model alat` : null,
    consumableCount > 0 ? `${consumableCount} bahan habis pakai` : null,
    borrowingCount > 0 ? `${borrowingCount} transaksi peminjaman` : null,
    matrixCount > 0 ? `${matrixCount} approval matrix` : null,
    materialRequestCount > 0 ? `${materialRequestCount} permintaan bahan` : null,
    scheduleCount > 0 ? `${scheduleCount} jadwal lab` : null,
    usageCount > 0 ? `${usageCount} riwayat penggunaan lab` : null,
    bookingCount > 0 ? `${bookingCount} booking ruang lab` : null,
  ].filter((item): item is string => Boolean(item))

  if (blockers.length > 0) {
    return {
      ok: false,
      message: `Laboratorium tidak bisa dihapus karena masih dipakai: ${blockers.join(", ")}.`,
    }
  }

  try {
    await db.delete(labs).where(eq(labs.id, parsed.data.labId))

    await writeSecurityAuditLog({
      category: "lab_management",
      action: "delete_lab",
      outcome: "success",
      userId: auth.session.user.id,
      actorRole: "admin",
      targetType: "lab",
      targetId: existing.id,
      identifier: existing.code,
      metadata: { name: existing.name },
    })

    revalidatePath("/dashboard/labs")
    return { ok: true, message: `Laboratorium ${existing.name} berhasil dihapus.` }
  } catch (error) {
    console.error("deleteLabManagementAction error:", error)
    return { ok: false, message: "Gagal menghapus laboratorium." }
  }
}
