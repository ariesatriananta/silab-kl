"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import {
  borrowingApprovalMatrices,
  borrowingApprovalMatrixSteps,
  userLabAssignments,
  users,
} from "@/lib/db/schema"
import { writeSecurityAuditLog } from "@/lib/security/audit"

export type ApprovalMatrixActionResult = { ok: boolean; message: string }

const saveMatrixSchema = z.object({
  labId: z.string().uuid(),
  isActive: z.enum(["true", "false"]).transform((v) => v === "true"),
})

async function requireAdmin() {
  const session = await getServerAuthSession()
  if (!session?.user?.id || session.user.role !== "admin") return null
  return session
}

export async function saveBorrowingApprovalMatrixAction(
  _prev: ApprovalMatrixActionResult | null,
  formData: FormData,
): Promise<ApprovalMatrixActionResult> {
  const session = await requireAdmin()
  if (!session) return { ok: false, message: "Akses ditolak." }

  const parsed = saveMatrixSchema.safeParse({
    labId: formData.get("labId"),
    isActive: formData.get("isActive"),
  })
  if (!parsed.success) return { ok: false, message: "Data matrix approval tidak valid." }

  if (parsed.data.isActive) {
    const [dosenCountRows, plpCountRows] = await Promise.all([
      db
        .select({ total: users.id })
        .from(userLabAssignments)
        .innerJoin(users, eq(users.id, userLabAssignments.userId))
        .where(and(eq(userLabAssignments.labId, parsed.data.labId), eq(users.role, "dosen"))),
      db
        .select({ total: users.id })
        .from(userLabAssignments)
        .innerJoin(users, eq(users.id, userLabAssignments.userId))
        .where(and(eq(userLabAssignments.labId, parsed.data.labId), eq(users.role, "petugas_plp"))),
    ])
    if (dosenCountRows.length === 0) {
      return { ok: false, message: "Tidak ada dosen ter-assign pada lab ini. Matrix tidak bisa diaktifkan." }
    }
    if (plpCountRows.length === 0) {
      return { ok: false, message: "Tidak ada Petugas PLP ter-assign pada lab ini. Matrix tidak bisa diaktifkan." }
    }
  }

  try {
    await db.transaction(async (tx) => {
      const existing = await tx.query.borrowingApprovalMatrices.findFirst({
        where: eq(borrowingApprovalMatrices.labId, parsed.data.labId),
        columns: { id: true },
      })

      const matrixId =
        existing?.id ??
        (
          await tx
            .insert(borrowingApprovalMatrices)
            .values({ labId: parsed.data.labId, isActive: parsed.data.isActive })
            .returning({ id: borrowingApprovalMatrices.id })
        )[0]?.id

      if (!matrixId) throw new Error("Gagal menyimpan matrix approval.")

      if (existing?.id) {
        await tx
          .update(borrowingApprovalMatrices)
          .set({ isActive: parsed.data.isActive, updatedAt: new Date() })
          .where(eq(borrowingApprovalMatrices.id, existing.id))
      }

      const currentSteps = await tx
        .select({ id: borrowingApprovalMatrixSteps.id })
        .from(borrowingApprovalMatrixSteps)
        .where(eq(borrowingApprovalMatrixSteps.matrixId, matrixId))

      if (currentSteps.length > 0) {
        await tx.delete(borrowingApprovalMatrixSteps).where(eq(borrowingApprovalMatrixSteps.matrixId, matrixId))
      }

      await tx.insert(borrowingApprovalMatrixSteps).values([
        { matrixId, stepOrder: 1, approverRole: "dosen" },
        { matrixId, stepOrder: 2, approverRole: "petugas_plp" },
      ])
    })
  } catch (error) {
    console.error("saveBorrowingApprovalMatrixAction error:", error)
    return { ok: false, message: "Gagal menyimpan matrix approval." }
  }

  await writeSecurityAuditLog({
    category: "borrowing_matrix",
    action: "save_matrix",
    outcome: "success",
    userId: session.user.id,
    actorRole: "admin",
    targetType: "lab",
    targetId: parsed.data.labId,
    metadata: { isActive: parsed.data.isActive, flow: "dosen->petugas_plp" },
  })

  revalidatePath("/dashboard/approval-matrix")
  revalidatePath("/dashboard/borrowing")
  return { ok: true, message: "Matrix approval berhasil disimpan." }
}

