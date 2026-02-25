"use server"

import { z } from "zod"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { hashPassword, verifyPassword } from "@/lib/auth/password"

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
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data ganti password tidak valid." }
  }

  if (parsed.data.currentPassword === parsed.data.newPassword) {
    return { ok: false, message: "Password baru harus berbeda dari password saat ini." }
  }
  if (parsed.data.newPassword === "password") {
    return { ok: false, message: "Password baru tidak boleh menggunakan password default." }
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { id: true, passwordHash: true, isActive: true },
  })
  if (!user || !user.isActive) return { ok: false, message: "Akun tidak ditemukan atau nonaktif." }

  const validCurrent = await verifyPassword(parsed.data.currentPassword, user.passwordHash)
  if (!validCurrent) return { ok: false, message: "Password saat ini salah." }

  const nextHash = await hashPassword(parsed.data.newPassword)
  await db
    .update(users)
    .set({
      passwordHash: nextHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))

  return { ok: true, message: "Password berhasil diubah. Anda akan logout untuk login ulang." }
}
