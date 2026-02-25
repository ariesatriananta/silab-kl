"use server"

import { z } from "zod"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { hashPassword, verifyPassword } from "@/lib/auth/password"
import { writeSecurityAuditLog } from "@/lib/security/audit"

export type ChangePasswordActionResult = {
  ok: boolean
  message: string
}

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi."),
    newPassword: z.string().min(8, "Password baru minimal 8 karakter."),
    confirmPassword: z.string().min(1, "Konfirmasi password wajib diisi."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Konfirmasi password tidak cocok.",
  })

export async function changeOwnPasswordAction(
  _prev: ChangePasswordActionResult | null,
  formData: FormData,
): Promise<ChangePasswordActionResult> {
  const session = await getServerAuthSession()
  if (!session?.user?.id) return { ok: false, message: "Sesi tidak valid. Silakan login ulang." }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  })
  if (!parsed.success) {
    await writeSecurityAuditLog({
      category: "auth",
      action: "change_password",
      outcome: "failure",
      userId: session.user.id,
      actorRole: session.user.role ?? null,
      metadata: { reason: "validation_error" },
    })
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data ganti password tidak valid." }
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    await writeSecurityAuditLog({
      category: "auth",
      action: "change_password",
      outcome: "failure",
      userId: session.user.id,
      actorRole: session.user.role ?? null,
      metadata: { reason: "same_password" },
    })
    return { ok: false, message: "Password baru harus berbeda dari password saat ini." }
  }
  if (parsed.data.newPassword === "password") {
    await writeSecurityAuditLog({
      category: "auth",
      action: "change_password",
      outcome: "failure",
      userId: session.user.id,
      actorRole: session.user.role ?? null,
      metadata: { reason: "default_password_disallowed" },
    })
    return { ok: false, message: "Password baru tidak boleh menggunakan password default." }
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { id: true, passwordHash: true, isActive: true },
  })
  if (!user || !user.isActive) {
    await writeSecurityAuditLog({
      category: "auth",
      action: "change_password",
      outcome: "failure",
      userId: session.user.id,
      actorRole: session.user.role ?? null,
      metadata: { reason: "user_not_active" },
    })
    return { ok: false, message: "Akun tidak ditemukan atau nonaktif." }
  }

  const validCurrent = await verifyPassword(parsed.data.currentPassword, user.passwordHash)
  if (!validCurrent) {
    await writeSecurityAuditLog({
      category: "auth",
      action: "change_password",
      outcome: "failure",
      userId: session.user.id,
      actorRole: session.user.role ?? null,
      metadata: { reason: "invalid_current_password" },
    })
    return { ok: false, message: "Password saat ini salah." }
  }

  const nextHash = await hashPassword(parsed.data.newPassword)
  await db
    .update(users)
    .set({
      passwordHash: nextHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))

  await writeSecurityAuditLog({
    category: "auth",
    action: "change_password",
    outcome: "success",
    userId: session.user.id,
    actorRole: session.user.role ?? null,
  })

  return { ok: true, message: "Password berhasil diubah. Anda akan logout untuk login ulang." }
}
