import { asc, eq, sql } from "drizzle-orm"

import {
  StudentToolsPageClient,
  type StudentToolCatalogRow,
} from "@/components/student-tools/student-tools-page-client"
import { db } from "@/lib/db/client"
import { labs, toolAssets, toolModels } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

async function getStudentCatalogData(): Promise<StudentToolCatalogRow[]> {
  const rows = await db
    .select({
      id: toolModels.code,
      name: toolModels.name,
      image: toolModels.imageUrl,
      lab: labs.name,
      category: toolModels.category,
      total: sql<number>`count(${toolAssets.id})`,
      available: sql<number>`coalesce(sum(case when ${toolAssets.status} = 'available' then 1 else 0 end), 0)`,
    })
    .from(toolModels)
    .innerJoin(labs, eq(toolModels.labId, labs.id))
    .leftJoin(toolAssets, eq(toolAssets.toolModelId, toolModels.id))
    .groupBy(toolModels.id, labs.id)
    .orderBy(asc(labs.name), asc(toolModels.name))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    image: row.image,
    lab: row.lab,
    category: row.category,
    total: Number(row.total),
    available: Number(row.available),
  }))
}

export default async function StudentToolsPage() {
  const data = await getStudentCatalogData()

  return <StudentToolsPageClient data={data} />
}
