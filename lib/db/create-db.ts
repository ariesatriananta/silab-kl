import { neon } from "@neondatabase/serverless"
import { drizzle } from "drizzle-orm/neon-http"

import { getServerEnv } from "../env/get-server-env"
import * as schema from "./schema"

export function createDb() {
  const env = getServerEnv()
  const sql = neon(env.DATABASE_URL)

  return drizzle(sql, { schema, casing: "snake_case" })
}
