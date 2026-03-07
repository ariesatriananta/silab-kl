import { and, asc, eq, ilike, or, sql } from "drizzle-orm"

import {
  StudentToolsPageClient,
  type StudentToolCatalogFilters,
  type StudentToolCatalogPagination,
  type StudentToolCatalogRow,
} from "@/components/student-tools/student-tools-page-client"
import { db } from "@/lib/db/client"
import { labs, toolAssets, toolModels } from "@/lib/db/schema"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 24

type SearchParamsInput = Promise<Record<string, string | string[] | undefined>>

function getSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

async function getStudentCatalogData(input: {
  search: string
  category: string
  page: number
}): Promise<{
  rows: StudentToolCatalogRow[]
  categories: string[]
  filters: StudentToolCatalogFilters
  pagination: StudentToolCatalogPagination
}> {
  const trimmedSearch = input.search.trim()
  const category = input.category.trim()

  const whereClause = and(
    eq(labs.isActive, true),
    trimmedSearch
      ? or(
          ilike(toolModels.name, `%${trimmedSearch}%`),
          ilike(toolModels.category, `%${trimmedSearch}%`),
          ilike(labs.name, `%${trimmedSearch}%`),
        )
      : undefined,
    category && category !== "all" ? eq(toolModels.category, category) : undefined,
  )

  const groupedRows = await db
    .select({
      id: toolModels.code,
      modelId: toolModels.id,
      labId: toolModels.labId,
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
    .where(whereClause)
    .groupBy(toolModels.id, labs.id)
    .orderBy(asc(labs.name), asc(toolModels.name))

  const totalItems = groupedRows.length
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const currentPage = Math.min(Math.max(1, input.page), totalPages)
  const start = (currentPage - 1) * PAGE_SIZE
  const pageRows = groupedRows.slice(start, start + PAGE_SIZE)

  const categoryRows = await db
    .selectDistinct({ category: toolModels.category })
    .from(toolModels)
    .innerJoin(labs, eq(toolModels.labId, labs.id))
    .where(eq(labs.isActive, true))
    .orderBy(asc(toolModels.category))

  const rows = pageRows.map((row) => ({
    id: row.id,
    modelId: row.modelId,
    labId: row.labId,
    name: row.name,
    image: row.image,
    lab: row.lab,
    category: row.category,
    total: Number(row.total),
    available: Number(row.available),
  }))

  const filteredAvailableCount = groupedRows.filter((row) => Number(row.available) > 0).length
  const filteredTotalUnits = groupedRows.reduce((sum, row) => sum + Number(row.total), 0)

  return {
    rows,
    categories: categoryRows.map((row) => row.category).filter(Boolean),
    filters: {
      search: trimmedSearch,
      category: category && category !== "all" ? category : "all",
      filteredAvailableCount,
      filteredTotalUnits,
      filteredTotalModels: totalItems,
    },
    pagination: {
      page: currentPage,
      pageSize: PAGE_SIZE,
      totalItems,
      totalPages,
      showingFrom: totalItems === 0 ? 0 : start + 1,
      showingTo: Math.min(start + PAGE_SIZE, totalItems),
    },
  }
}

export default async function StudentToolsPage({
  searchParams,
}: {
  searchParams: SearchParamsInput
}) {
  const params = await searchParams
  const search = getSingleParam(params.search) ?? ""
  const category = getSingleParam(params.category) ?? "all"
  const pageParam = Number.parseInt(getSingleParam(params.page) ?? "1", 10)
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1

  const { rows, categories, filters, pagination } = await getStudentCatalogData({
    search,
    category,
    page,
  })

  return (
    <StudentToolsPageClient
      data={rows}
      categories={categories}
      filters={filters}
      pagination={pagination}
    />
  )
}
