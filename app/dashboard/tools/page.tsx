import { asc, eq } from "drizzle-orm"

import { ToolsPageClient, type ToolRow } from "@/components/tools/tools-page-client"
import { db } from "@/lib/db/client"
import { labs, toolAssets, toolModels } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

async function getToolsData(): Promise<ToolRow[]> {
  const rows = await db
    .select({
      assetCode: toolAssets.assetCode,
      qrCodeValue: toolAssets.qrCodeValue,
      status: toolAssets.status,
      condition: toolAssets.condition,
      modelName: toolModels.name,
      category: toolModels.category,
      labName: labs.name,
    })
    .from(toolAssets)
    .innerJoin(toolModels, eq(toolAssets.toolModelId, toolModels.id))
    .innerJoin(labs, eq(toolModels.labId, labs.id))
    .orderBy(asc(labs.name), asc(toolModels.name), asc(toolAssets.assetCode))

  return rows.map((row) => ({
    id: row.assetCode,
    name: row.modelName,
    category: row.category,
    lab: row.labName,
    status: row.status,
    condition: row.condition,
    qrCode: row.qrCodeValue,
  }))
}

export default async function ToolsPage() {
  const data = await getToolsData()

  return <ToolsPageClient data={data} />
}
