import { config as loadDotenv } from "dotenv"
import { count } from "drizzle-orm"

import { createDb } from "../lib/db/create-db"
import { consumableItems, labs, toolAssets, toolModels, users } from "../lib/db/schema"

loadDotenv({ path: ".env.local" })
loadDotenv()

async function main() {
  const db = createDb()

  const [labsCount, usersCount, toolModelsCount, toolAssetsCount, consumablesCount] =
    await Promise.all([
      db.select({ count: count() }).from(labs),
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(toolModels),
      db.select({ count: count() }).from(toolAssets),
      db.select({ count: count() }).from(consumableItems),
    ])

  console.log(
    JSON.stringify({
      labs: labsCount[0]?.count ?? 0,
      users: usersCount[0]?.count ?? 0,
      toolModels: toolModelsCount[0]?.count ?? 0,
      toolAssets: toolAssetsCount[0]?.count ?? 0,
      consumables: consumablesCount[0]?.count ?? 0,
    }),
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
