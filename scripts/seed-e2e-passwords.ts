import { config as loadDotenv } from "dotenv"
import { eq } from "drizzle-orm"

import { hashPassword } from "../lib/auth/password"
import { createDb } from "../lib/db/create-db"
import { users } from "../lib/db/schema"

loadDotenv({ path: ".env.local" })
loadDotenv()

const db = createDb()

async function updatePassword(username: string, plainPassword: string) {
  const passwordHash = await hashPassword(plainPassword)
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.username, username))
}

async function main() {
  await updatePassword("admin", "Admin#12345")
  await updatePassword("dosen.rahma", "Dosen#12345")
  await updatePassword("plp.suryani", "Plp#12345")
}

main().catch((error) => {
  console.error("seed-e2e-passwords gagal:", error)
  process.exitCode = 1
})

