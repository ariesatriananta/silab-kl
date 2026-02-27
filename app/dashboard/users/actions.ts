"use server"

import { revalidatePath } from "next/cache"
import { and, eq, inArray, notInArray } from "drizzle-orm"

import { getServerAuthSession } from "@/lib/auth/server"
import { hashPassword } from "@/lib/auth/password"
import { db } from "@/lib/db/client"
import { labs, userLabAssignments, users } from "@/lib/db/schema"
import { writeSecurityAuditLog } from "@/lib/security/audit"

export type UserManagementActionResult = {
  ok: boolean
  message: string
}

type AppRole = "admin" | "mahasiswa" | "petugas_plp" | "dosen"

async function requireAdmin() {
  const session = await getServerAuthSession()
  if (!session?.user?.id || session.user.role !== "admin") {
    return { ok: false as const, message: "Akses ditolak." }
  }
  return { ok: true as const, session }
}

function parseRole(input: FormDataEntryValue | null): AppRole | null {
  if (input === "admin" || input === "mahasiswa" || input === "petugas_plp" || input === "dosen") return input
  return null
}

function parseAssignmentLabIds(raw: FormDataEntryValue | null) {
  if (!raw || typeof raw !== "string") return [] as string[]
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === "string")
  } catch {
    return []
  }
}

async function syncAssignedLabs(params: {
  userId: string
  role: AppRole
  assignmentLabIds: string[]
}) {
  if (params.role !== "petugas_plp" && params.role !== "dosen") {
    await db.delete(userLabAssignments).where(eq(userLabAssignments.userId, params.userId))
    return
  }

  const activeLabs = await db
    .select({ id: labs.id })
    .from(labs)
    .where(and(inArray(labs.id, params.assignmentLabIds.length ? params.assignmentLabIds : ["__none__"]), eq(labs.isActive, true)))

  const validLabIds = activeLabs.map((row) => row.id)
  const uniqueLabIds = Array.from(new Set(validLabIds))

  if (uniqueLabIds.length > 0) {
    const existing = await db
      .select({ labId: userLabAssignments.labId })
      .from(userLabAssignments)
      .where(eq(userLabAssignments.userId, params.userId))
    const existingSet = new Set(existing.map((e) => e.labId))

    const toInsert = uniqueLabIds
      .filter((labId) => !existingSet.has(labId))
      .map((labId) => ({ userId: params.userId, labId }))

    if (toInsert.length) {
      await db.insert(userLabAssignments).values(toInsert)
    }
  }

  const keepIds = uniqueLabIds
  if (keepIds.length === 0) {
    await db.delete(userLabAssignments).where(eq(userLabAssignments.userId, params.userId))
  } else {
    await db
      .delete(userLabAssignments)
      .where(and(eq(userLabAssignments.userId, params.userId), notInArray(userLabAssignments.labId, keepIds)))
  }
}

export async function createUserManagementAction(
  _prev: UserManagementActionResult | null,
  formData: FormData,
): Promise<UserManagementActionResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, message: auth.message }

  const username = String(formData.get("username") ?? "").trim()
  const fullName = String(formData.get("fullName") ?? "").trim()
  const role = parseRole(formData.get("role"))
  const email = String(formData.get("email") ?? "").trim() || null
  const nip = String(formData.get("nip") ?? "").trim() || null
  const nim = String(formData.get("nim") ?? "").trim() || null
  const password = String(formData.get("password") ?? "").trim() || "password"
  const isActive = String(formData.get("isActive") ?? "true") === "true"
  const assignmentLabIds = parseAssignmentLabIds(formData.get("assignmentLabIds"))

  if (!username || !fullName || !role) {
    return { ok: false, message: "Username, nama lengkap, dan role wajib diisi." }
  }
  if (password.length < 8) {
    return { ok: false, message: "Password minimal 8 karakter." }
  }
  if (role === "mahasiswa" && !nim) {
    return { ok: false, message: "NIM wajib untuk role mahasiswa." }
  }
  if (role !== "mahasiswa" && nim) {
    return { ok: false, message: "NIM hanya untuk user mahasiswa." }
  }
  if ((role === "petugas_plp" || role === "dosen") && assignmentLabIds.length === 0) {
    return { ok: false, message: `${role === "dosen" ? "Dosen" : "Petugas PLP"} harus di-assign minimal 1 lab.` }
  }

  try {
    const passwordHash = await hashPassword(password)
    const [inserted] = await db
      .insert(users)
      .values({
        username,
        fullName,
        role,
        email,
        nip,
        nim,
        passwordHash,
        isActive,
      })
      .returning({ id: users.id })

    await syncAssignedLabs({
      userId: inserted.id,
      role,
      assignmentLabIds,
    })

    await writeSecurityAuditLog({
      category: "user_management",
      action: "create_user",
      outcome: "success",
      userId: auth.session.user.id,
      actorRole: "admin",
      targetType: "user",
      targetId: inserted.id,
      identifier: username,
      metadata: { role, assignmentLabCount: assignmentLabIds.length },
    })
    revalidatePath("/dashboard/users")
    return { ok: true, message: `User ${username} berhasil dibuat.` }
  } catch (error) {
    console.error("createUserManagementAction error:", error)
    await writeSecurityAuditLog({
      category: "user_management",
      action: "create_user",
      outcome: "failure",
      userId: auth.session.user.id,
      actorRole: "admin",
      identifier: username,
      metadata: { error: "create_failed" },
    })
    return { ok: false, message: "Gagal membuat user. Cek username/NIM/NIP/email mungkin sudah dipakai." }
  }
}

export async function updateUserManagementAction(
  _prev: UserManagementActionResult | null,
  formData: FormData,
): Promise<UserManagementActionResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, message: auth.message }

  const userId = String(formData.get("userId") ?? "")
  const username = String(formData.get("username") ?? "").trim()
  const fullName = String(formData.get("fullName") ?? "").trim()
  const role = parseRole(formData.get("role"))
  const email = String(formData.get("email") ?? "").trim() || null
  const nip = String(formData.get("nip") ?? "").trim() || null
  const nim = String(formData.get("nim") ?? "").trim() || null
  const isActive = String(formData.get("isActive") ?? "true") === "true"
  const assignmentLabIds = parseAssignmentLabIds(formData.get("assignmentLabIds"))

  if (!userId || !username || !fullName || !role) {
    return { ok: false, message: "Data user tidak lengkap." }
  }
  if (role === "mahasiswa" && !nim) {
    return { ok: false, message: "NIM wajib untuk role mahasiswa." }
  }
  if (role !== "mahasiswa" && nim) {
    return { ok: false, message: "NIM hanya untuk user mahasiswa." }
  }
  if ((role === "petugas_plp" || role === "dosen") && assignmentLabIds.length === 0) {
    return { ok: false, message: `${role === "dosen" ? "Dosen" : "Petugas PLP"} harus di-assign minimal 1 lab.` }
  }

  try {
    await db
      .update(users)
      .set({
        username,
        fullName,
        role,
        email,
        nip,
        nim,
        isActive,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))

    await syncAssignedLabs({ userId, role, assignmentLabIds })

    await writeSecurityAuditLog({
      category: "user_management",
      action: "update_user",
      outcome: "success",
      userId: auth.session.user.id,
      actorRole: "admin",
      targetType: "user",
      targetId: userId,
      identifier: username,
      metadata: { role, isActive, assignmentLabCount: assignmentLabIds.length },
    })
    revalidatePath("/dashboard/users")
    return { ok: true, message: `User ${username} berhasil diperbarui.` }
  } catch (error) {
    console.error("updateUserManagementAction error:", error)
    return { ok: false, message: "Gagal memperbarui user. Cek data unik (username/NIM/NIP/email)." }
  }
}

export async function resetUserPasswordAction(
  _prev: UserManagementActionResult | null,
  formData: FormData,
): Promise<UserManagementActionResult> {
  const auth = await requireAdmin()
  if (!auth.ok) return { ok: false, message: auth.message }

  const userId = String(formData.get("userId") ?? "")
  const newPassword = String(formData.get("newPassword") ?? "").trim()
  if (!userId || !newPassword) return { ok: false, message: "Data reset password tidak lengkap." }
  if (newPassword.length < 8) return { ok: false, message: "Password baru minimal 8 karakter." }

  try {
    const passwordHash = await hashPassword(newPassword)
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId))
    await writeSecurityAuditLog({
      category: "user_management",
      action: "reset_user_password",
      outcome: "success",
      userId: auth.session.user.id,
      actorRole: "admin",
      targetType: "user",
      targetId: userId,
    })
    revalidatePath("/dashboard/users")
    return {
      ok: true,
      message:
        newPassword === "password"
          ? "Password berhasil direset ke default. User akan dipaksa ganti password saat login."
          : "Password user berhasil direset.",
    }
  } catch (error) {
    console.error("resetUserPasswordAction error:", error)
    return { ok: false, message: "Gagal reset password user." }
  }
}
