"use server"

import { revalidatePath } from "next/cache"
import { and, eq } from "drizzle-orm"
import { z } from "zod"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import {
  borrowingApprovalMatrices,
  userLabAssignments,
  users,
} from "@/lib/db/schema"
import { writeSecurityAuditLog } from "@/lib/security/audit"

export type ApprovalMatrixActionResult = { ok: boolean; message: string }

const saveMatrixSchema = z.object({
  labId: z.string().uuid(),
  isActive: z.enum(["true", "false"]).transform((v) => v === "true"),
  step1ApproverUserId: z.string().uuid().optional(),
  step2ApproverUserId: z.string().uuid().optional(),
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
    step1ApproverUserId: formData.get("step1ApproverUserId")?.toString() || undefined,
    step2ApproverUserId: formData.get("step2ApproverUserId")?.toString() || undefined,
  })
  if (!parsed.success) return { ok: false, message: "Data matrix approval tidak valid." }

  if (!parsed.data.step1ApproverUserId || !parsed.data.step2ApproverUserId) {
    return { ok: false, message: "Pilih approver tahap 1 (Dosen) dan tahap 2 (Petugas PLP)." }
  }

  const [step1User, step2User] = await Promise.all([
    db.query.users.findFirst({
      where: and(eq(users.id, parsed.data.step1ApproverUserId), eq(users.role, "dosen"), eq(users.isActive, true)),
      columns: { id: true },
    }),
    db.query.users.findFirst({
      where: and(eq(users.id, parsed.data.step2ApproverUserId), eq(users.role, "petugas_plp"), eq(users.isActive, true)),
      columns: { id: true },
    }),
  ])
  if (!step1User) return { ok: false, message: "Approver tahap 1 harus user Dosen aktif." }
  if (!step2User) return { ok: false, message: "Approver tahap 2 harus user Petugas PLP aktif." }

  const [step1Assignment, step2Assignment] = await Promise.all([
    db.query.userLabAssignments.findFirst({
      where: and(
        eq(userLabAssignments.userId, parsed.data.step1ApproverUserId),
        eq(userLabAssignments.labId, parsed.data.labId),
      ),
      columns: { userId: true },
    }),
    db.query.userLabAssignments.findFirst({
      where: and(
        eq(userLabAssignments.userId, parsed.data.step2ApproverUserId),
        eq(userLabAssignments.labId, parsed.data.labId),
      ),
      columns: { userId: true },
    }),
  ])
  if (!step1Assignment) return { ok: false, message: "Dosen tahap 1 harus ter-assign ke lab ini." }
  if (!step2Assignment) return { ok: false, message: "Petugas PLP tahap 2 harus ter-assign ke lab ini." }

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
    const existing = await db.query.borrowingApprovalMatrices.findFirst({
      where: eq(borrowingApprovalMatrices.labId, parsed.data.labId),
      columns: { id: true },
    })

    if (existing?.id) {
      await db
        .update(borrowingApprovalMatrices)
        .set({
          isActive: parsed.data.isActive,
          step1ApproverUserId: parsed.data.step1ApproverUserId,
          step2ApproverUserId: parsed.data.step2ApproverUserId,
          updatedAt: new Date(),
        })
        .where(eq(borrowingApprovalMatrices.id, existing.id))
    } else {
      await db.insert(borrowingApprovalMatrices).values({
        labId: parsed.data.labId,
        isActive: parsed.data.isActive,
        step1ApproverUserId: parsed.data.step1ApproverUserId,
        step2ApproverUserId: parsed.data.step2ApproverUserId,
      })
    }
  } catch (error) {
    console.error("saveBorrowingApprovalMatrixAction error:", error)
    const message =
      error instanceof Error && error.message
        ? `Gagal menyimpan matrix approval: ${error.message}`
        : "Gagal menyimpan matrix approval."
    return { ok: false, message }
  }

  await writeSecurityAuditLog({
    category: "borrowing_matrix",
    action: "save_matrix",
    outcome: "success",
    userId: session.user.id,
    actorRole: "admin",
    targetType: "lab",
    targetId: parsed.data.labId,
    metadata: {
      isActive: parsed.data.isActive,
      flow: "dosen->petugas_plp",
      step1ApproverUserId: parsed.data.step1ApproverUserId,
      step2ApproverUserId: parsed.data.step2ApproverUserId,
    },
  })

  revalidatePath("/dashboard/approval-matrix")
  revalidatePath("/dashboard/borrowing")
  return { ok: true, message: "Matrix approval berhasil disimpan." }
}
