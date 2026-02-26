import CredentialsProvider from "next-auth/providers/credentials"
import type { NextAuthOptions } from "next-auth"
import { and, eq, or } from "drizzle-orm"
import { z } from "zod"

import { createDb } from "@/lib/db/create-db"
import { users } from "@/lib/db/schema"
import { getServerEnv } from "@/lib/env/get-server-env"
import { hashPassword, isLegacySeedHash, verifyPassword } from "@/lib/auth/password"
import {
  clearLoginFailures,
  isLoginRateLimited,
  recordLoginFailure,
} from "@/lib/auth/login-rate-limit"
import { writeSecurityAuditLog } from "@/lib/security/audit"

type AppRole = "admin" | "mahasiswa" | "petugas_plp"

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
})

export const authOptions: NextAuthOptions = {
  secret: getServerEnv().AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        identifier: { label: "Username / NIP / NIM", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials)
        if (!parsed.success) return null

        const db = createDb()
        const identifier = parsed.data.identifier.trim()
        const rateLimit = await isLoginRateLimited(identifier)
        if (rateLimit.limited) {
          await writeSecurityAuditLog({
            category: "auth",
            action: "login",
            outcome: "blocked",
            identifier,
            metadata: { reason: "rate_limited" },
          })
          throw new Error("TooManyAttempts")
        }

        const found = await db.query.users.findFirst({
          where: and(
            eq(users.isActive, true),
            or(eq(users.username, identifier), eq(users.nip, identifier), eq(users.nim, identifier)),
          ),
          columns: {
            id: true,
            username: true,
            fullName: true,
            email: true,
            role: true,
            passwordHash: true,
          },
        })

        if (!found) {
          await recordLoginFailure(identifier)
          await writeSecurityAuditLog({
            category: "auth",
            action: "login",
            outcome: "failure",
            identifier,
            metadata: { reason: "user_not_found" },
          })
          return null
        }

        const isValid = await verifyPassword(parsed.data.password, found.passwordHash)
        if (!isValid) {
          await recordLoginFailure(identifier)
          await writeSecurityAuditLog({
            category: "auth",
            action: "login",
            outcome: "failure",
            userId: found.id,
            actorRole: found.role as AppRole,
            identifier,
            metadata: { reason: "invalid_password" },
          })
          return null
        }

        await clearLoginFailures(identifier)
        await writeSecurityAuditLog({
          category: "auth",
          action: "login",
          outcome: "success",
          userId: found.id,
          actorRole: found.role as AppRole,
          identifier,
        })

        // Transparent migration from legacy seed hash to bcrypt after successful login.
        if (isLegacySeedHash(found.passwordHash)) {
          try {
            const nextHash = await hashPassword(parsed.data.password)
            await db
              .update(users)
              .set({
                passwordHash: nextHash,
                updatedAt: new Date(),
              })
              .where(eq(users.id, found.id))
            await writeSecurityAuditLog({
              category: "auth",
              action: "password_hash_upgrade",
              outcome: "success",
              userId: found.id,
              actorRole: found.role as AppRole,
              identifier,
            })
          } catch (error) {
            console.error("password hash upgrade failed:", error)
            await writeSecurityAuditLog({
              category: "auth",
              action: "password_hash_upgrade",
              outcome: "failure",
              userId: found.id,
              actorRole: found.role as AppRole,
              identifier,
            })
          }
        }

        return {
          id: found.id,
          name: found.fullName,
          email: found.email ?? undefined,
          role: found.role as AppRole,
          username: found.username,
          mustChangePassword: parsed.data.password === "password",
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.role = (user as { role: AppRole }).role
        token.username = (user as { username?: string }).username
        token.mustChangePassword = (user as { mustChangePassword?: boolean }).mustChangePassword ?? false
        token.name = user.name
        token.email = user.email
      }
      if (trigger === "update" && session) {
        if (typeof session.name === "string") token.name = session.name
        if ("email" in session) token.email = (session as { email?: string | null }).email ?? null
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? ""
        session.user.role = (token.role as AppRole | undefined) ?? "mahasiswa"
        session.user.username = (token.username as string | undefined) ?? undefined
        session.user.mustChangePassword = (token.mustChangePassword as boolean | undefined) ?? false
        if (typeof token.name === "string") session.user.name = token.name
        session.user.email = typeof token.email === "string" ? token.email : null
      }
      return session
    },
  },
}
