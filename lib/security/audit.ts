import { db } from "@/lib/db/client"
import { securityAuditLogs } from "@/lib/db/schema"

type AuditLogInput = {
  category: string
  action: string
  outcome: "success" | "failure" | "blocked"
  userId?: string | null
  actorRole?: "admin" | "mahasiswa" | "petugas_plp" | "dosen" | null
  targetType?: string | null
  targetId?: string | null
  identifier?: string | null
  metadata?: Record<string, unknown> | null
}

export async function writeSecurityAuditLog(input: AuditLogInput) {
  try {
    await db.insert(securityAuditLogs).values({
      category: input.category,
      action: input.action,
      outcome: input.outcome,
      userId: input.userId ?? null,
      actorRole: input.actorRole ?? null,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      identifier: input.identifier ?? null,
      metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
    })
  } catch (error) {
    console.error("writeSecurityAuditLog error:", error)
  }
}
