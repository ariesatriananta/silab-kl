import { defineConfig } from "drizzle-kit"
import { config as loadDotenv } from "dotenv"

loadDotenv({ path: ".env.local" })
loadDotenv()

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL belum diset. Isi .env.local atau environment Vercel.")
}

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  verbose: true,
  strict: true,
})
