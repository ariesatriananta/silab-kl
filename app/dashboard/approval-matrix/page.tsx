import { asc, eq, inArray } from "drizzle-orm"
import { redirect } from "next/navigation"

import {
  ApprovalMatrixPageClient,
  type ApprovalMatrixRow,
} from "@/components/approval-matrix/approval-matrix-page-client"
import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import { borrowingApprovalMatrices, borrowingApprovalMatrixSteps, labs, userLabAssignments, users } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

export default async function ApprovalMatrixPage() {
  const session = await getServerAuthSession()
  if (!session?.user?.id || session.user.role !== "admin") redirect("/dashboard")

  const [labRows, matrixRows, stepRows, assignmentRows] = await Promise.all([
    db.select({ id: labs.id, name: labs.name }).from(labs).where(eq(labs.isActive, true)).orderBy(asc(labs.name)),
    db
      .select({ id: borrowingApprovalMatrices.id, labId: borrowingApprovalMatrices.labId, isActive: borrowingApprovalMatrices.isActive })
      .from(borrowingApprovalMatrices),
    db
      .select({
        matrixId: borrowingApprovalMatrixSteps.matrixId,
        stepOrder: borrowingApprovalMatrixSteps.stepOrder,
        approverRole: borrowingApprovalMatrixSteps.approverRole,
      })
      .from(borrowingApprovalMatrixSteps),
    db
      .select({
        labId: userLabAssignments.labId,
        role: users.role,
      })
      .from(userLabAssignments)
      .innerJoin(users, eq(users.id, userLabAssignments.userId))
      .where(inArray(users.role, ["dosen", "petugas_plp"])),
  ])

  const matrixByLab = new Map(matrixRows.map((m) => [m.labId, m]))
  const stepsByMatrix = new Map<string, Array<{ stepOrder: number; approverRole: "dosen" | "petugas_plp" }>>()
  for (const step of stepRows) {
    const list = stepsByMatrix.get(step.matrixId) ?? []
    if (step.approverRole === "dosen" || step.approverRole === "petugas_plp") {
      list.push({ stepOrder: step.stepOrder, approverRole: step.approverRole })
    }
    stepsByMatrix.set(step.matrixId, list)
  }

  const assignmentSummary = new Map<string, { dosen: number; plp: number }>()
  for (const row of assignmentRows) {
    const item = assignmentSummary.get(row.labId) ?? { dosen: 0, plp: 0 }
    if (row.role === "dosen") item.dosen += 1
    if (row.role === "petugas_plp") item.plp += 1
    assignmentSummary.set(row.labId, item)
  }

  const rows: ApprovalMatrixRow[] = labRows.map((lab) => {
    const matrix = matrixByLab.get(lab.id)
    const steps = matrix ? stepsByMatrix.get(matrix.id) ?? [] : []
    const step1 = steps.find((s) => s.stepOrder === 1)
    const step2 = steps.find((s) => s.stepOrder === 2)
    const assignment = assignmentSummary.get(lab.id) ?? { dosen: 0, plp: 0 }

    return {
      labId: lab.id,
      labName: lab.name,
      isActive: matrix?.isActive ?? false,
      step1Role: step1?.approverRole === "dosen" ? "dosen" : null,
      step2Role: step2?.approverRole === "petugas_plp" ? "petugas_plp" : null,
      dosenAssignedCount: assignment.dosen,
      plpAssignedCount: assignment.plp,
    }
  })

  return <ApprovalMatrixPageClient rows={rows} />
}

