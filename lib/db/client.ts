import "server-only"

import { createDb } from "@/lib/db/create-db"

declare global {
  var __silabDb: ReturnType<typeof createDb> | undefined
}

export const db = globalThis.__silabDb ?? createDb()

if (process.env.NODE_ENV !== "production") {
  globalThis.__silabDb = db
}
