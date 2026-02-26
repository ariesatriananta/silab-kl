"use server"

import { eq } from "drizzle-orm"
import { z } from "zod"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema"
import { writeSecurityAuditLog } from "@/lib/security/audit"

export type UpdateOwnProfileActionResult = {
  ok: boolean
  message: string
  data?: {
    fullName: string
    email: string | null
  }
}

const updateProfileSchema = z.object({
  fullName: z.string().min(3, "Nama lengkap minimal 3 karakter.").max(200, "Nama terlalu panjang."),
  email: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : "")),
})

export async function updateOwnProfileAction(
  _prev: UpdateOwnProfileActionResult | null,
  formData: FormData,
): Promise<UpdateOwnProfileActionResult> {
  const session = await getServerAuthSession()
  if (!session?.user?.id) return { ok: false, message: "Sesi tidak valid. Silakan login ulang." }

  const parsed = updateProfileSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
  })
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Data profil tidak valid." }
  }

  const fullName = parsed.data.fullName.trim()
  const emailRaw = parsed.data.email?.trim() ?? ""
  const email = emailRaw.length > 0 ? emailRaw : null

  if (email) {
    const emailValid = z.string().email("Format email tidak valid.").safeParse(email)
    if (!emailValid.success) return { ok: false, message: "Format email tidak valid." }
  }

  try {
    await db
      .update(users)
      .set({
        fullName,
        email,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id))

    await writeSecurityAuditLog({
      category: "user_profile",
      action: "update_own_profile",
      outcome: "success",
      userId: session.user.id,
      actorRole: session.user.role ?? null,
      targetType: "user",
      targetId: session.user.id,
      metadata: { fullName, email },
    })

    return {
      ok: true,
      message: "Profil berhasil diperbarui.",
      data: { fullName, email },
    }
  } catch (error) {
    console.error("updateOwnProfileAction error:", error)
    await writeSecurityAuditLog({
      category: "user_profile",
      action: "update_own_profile",
      outcome: "failure",
      userId: session.user.id,
      actorRole: session.user.role ?? null,
      targetType: "user",
      targetId: session.user.id,
    })
    return { ok: false, message: "Gagal memperbarui profil. Pastikan email tidak digunakan akun lain." }
  }
}

