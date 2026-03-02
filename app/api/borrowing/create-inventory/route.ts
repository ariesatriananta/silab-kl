import { NextResponse } from "next/server"
import { and, asc, eq } from "drizzle-orm"

import { getServerAuthSession } from "@/lib/auth/server"
import { db } from "@/lib/db/client"
import { consumableItems, labs, toolAssets, toolModels, userLabAssignments } from "@/lib/db/schema"

type Role = "admin" | "mahasiswa" | "petugas_plp" | "dosen"

export async function GET(request: Request) {
  const session = await getServerAuthSession()
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ message: "Sesi tidak valid." }, { status: 401 })
  }

  const role = session.user.role as Role
  if (role === "dosen") {
    return NextResponse.json({ message: "Dosen tidak dapat membuat pengajuan peminjaman." }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const labId = searchParams.get("labId")
  if (!labId) {
    return NextResponse.json({ message: "Lab wajib dipilih." }, { status: 400 })
  }

  const labRow = await db.query.labs.findFirst({
    where: and(eq(labs.id, labId), eq(labs.isActive, true)),
    columns: { id: true },
  })
  if (!labRow) {
    return NextResponse.json({ message: "Lab tidak ditemukan atau nonaktif." }, { status: 404 })
  }

  if (role === "petugas_plp") {
    const assignment = await db.query.userLabAssignments.findFirst({
      where: and(eq(userLabAssignments.userId, session.user.id), eq(userLabAssignments.labId, labId)),
      columns: { labId: true },
    })
    if (!assignment) {
      return NextResponse.json({ message: "Anda tidak memiliki akses ke lab ini." }, { status: 403 })
    }
  }

  const [toolRows, consumableRows] = await Promise.all([
    db
      .select({
        id: toolAssets.id,
        modelId: toolModels.id,
        modelCode: toolModels.code,
        assetCode: toolAssets.assetCode,
        toolName: toolModels.name,
        labId: toolModels.labId,
        labName: labs.name,
      })
      .from(toolAssets)
      .innerJoin(toolModels, eq(toolModels.id, toolAssets.toolModelId))
      .innerJoin(labs, eq(labs.id, toolModels.labId))
      .where(and(eq(toolAssets.status, "available"), eq(toolModels.labId, labId)))
      .orderBy(asc(toolModels.name), asc(toolAssets.assetCode)),
    db
      .select({
        id: consumableItems.id,
        labId: consumableItems.labId,
        name: consumableItems.name,
        labName: labs.name,
        stockQty: consumableItems.stockQty,
        unit: consumableItems.unit,
      })
      .from(consumableItems)
      .innerJoin(labs, eq(labs.id, consumableItems.labId))
      .where(eq(consumableItems.labId, labId))
      .orderBy(asc(consumableItems.name)),
  ])

  return NextResponse.json({
    tools: toolRows.map((row) => ({
      id: row.id,
      modelId: row.modelId,
      modelCode: row.modelCode,
      labId: row.labId,
      label: `${row.toolName} - ${row.assetCode} - ${row.labName}`,
    })),
    consumables: consumableRows.map((row) => ({
      id: row.id,
      labId: row.labId,
      label: `${row.name} - ${row.labName} (stok ${row.stockQty} ${row.unit})`,
      stockQty: row.stockQty,
      unit: row.unit,
    })),
  })
}

