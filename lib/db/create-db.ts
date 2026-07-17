import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"
import { drizzle as drizzleNodePostgres, type NodePgDatabase } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import { getServerEnv } from "../env/get-server-env"
import * as schema from "./schema"

let localPostgresPool: Pool | undefined

// Both drivers expose the query builder used by the app. We type the shared
// instance as the PostgreSQL adapter because it includes transaction callbacks;
// the Neon HTTP path keeps its existing runtime fallback for unsupported
// transactions in the affected server actions.
export type AppDb = NodePgDatabase<typeof schema>

export function createDb(): AppDb {
  const env = getServerEnv()

  if (env.DB_DRIVER === "postgres") {
    localPostgresPool ??= new Pool({ connectionString: env.DATABASE_URL })
    return drizzleNodePostgres({ client: localPostgresPool, schema, casing: "snake_case" })
  }

  const sql = neon(env.DATABASE_URL)

  return drizzle(sql, { schema, casing: "snake_case" }) as unknown as AppDb
}
