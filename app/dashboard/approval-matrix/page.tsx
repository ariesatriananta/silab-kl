import { asc, eq, inArray } from "drizzle-orm"
import { redirect } from "next/navigation"

import {
  ApprovalMatrixPageClient,
  type ApprovalMatrixRow,
} from "@/components/approval-matrix/approval-matrix-page-client"
import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import { borrowingApprovalMatrices, labs, userLabAssignments, users } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

export default async function ApprovalMatrixPage() {
  const session = await getServerAuthSession()
  if (!session?.user?.id || session.user.role !== "admin") redirect("/dashboard")

  const [labRows, matrixRows, assignmentRows] = await Promise.all([
    db.select({ id: labs.id, name: labs.name }).from(labs).where(eq(labs.isActive, true)).orderBy(asc(labs.name)),
    db
      .select({
        id: borrowingApprovalMatrices.id,
        labId: borrowingApprovalMatrices.labId,
        isActive: borrowingApprovalMatrices.isActive,
        step1ApproverUserId: borrowingApprovalMatrices.step1ApproverUserId,
        step2ApproverUserId: borrowingApprovalMatrices.step2ApproverUserId,
      })
      .from(borrowingApprovalMatrices),
    db
      .select({
        labId: userLabAssignments.labId,
        userId: users.id,
        fullName: users.fullName,
        identifier: users.nip,
        role: users.role,
      })
      .from(userLabAssignments)
      .innerJoin(users, eq(users.id, userLabAssignments.userId))
      .where(inArray(users.role, ["dosen", "petugas_plp"])),
  ])

  const matrixByLab = new Map(matrixRows.map((m) => [m.labId, m]))
  const assignmentSummary = new Map<string, { dosen: number; plp: number }>()
  const approverCandidatesByLab = new Map<
    string,
    {
      dosen: Array<{ id: string; name: string; identifier: string | null }>
      plp: Array<{ id: string; name: string; identifier: string | null }>
    }
  >()
  for (const row of assignmentRows) {
    const item = assignmentSummary.get(row.labId) ?? { dosen: 0, plp: 0 }
    const candidates = approverCandidatesByLab.get(row.labId) ?? { dosen: [], plp: [] }
    if (row.role === "dosen") item.dosen += 1
    if (row.role === "petugas_plp") item.plp += 1
    if (row.role === "dosen") candidates.dosen.push({ id: row.userId, name: row.fullName, identifier: row.identifier })
    if (row.role === "petugas_plp") candidates.plp.push({ id: row.userId, name: row.fullName, identifier: row.identifier })
    assignmentSummary.set(row.labId, item)
    approverCandidatesByLab.set(row.labId, candidates)
  }

  const rows: ApprovalMatrixRow[] = labRows.map((lab) => {
    const matrix = matrixByLab.get(lab.id)
    const assignment = assignmentSummary.get(lab.id) ?? { dosen: 0, plp: 0 }
    const candidates = approverCandidatesByLab.get(lab.id) ?? { dosen: [], plp: [] }
    const selectedStep1 = candidates.dosen.find((item) => item.id === matrix?.step1ApproverUserId) ?? null
    const selectedStep2 = candidates.plp.find((item) => item.id === matrix?.step2ApproverUserId) ?? null

    return {
      labId: lab.id,
      labName: lab.name,
      isActive: matrix?.isActive ?? false,
      step1ApproverUserId: matrix?.step1ApproverUserId ?? null,
      step2ApproverUserId: matrix?.step2ApproverUserId ?? null,
      step1ApproverName: selectedStep1?.name ?? null,
      step2ApproverName: selectedStep2?.name ?? null,
      dosenAssignedCount: assignment.dosen,
      plpAssignedCount: assignment.plp,
      dosenCandidates: candidates.dosen,
      plpCandidates: candidates.plp,
    }
  })

  return <ApprovalMatrixPageClient rows={rows} />
}
