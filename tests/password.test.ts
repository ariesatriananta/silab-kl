import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"

import { hashPassword, isLegacySeedHash, verifyPassword } from "@/lib/auth/password"

test("hashPassword menghasilkan bcrypt hash yang bisa diverifikasi", async () => {
  const password = "SandiKuat123!"
  const hashed = await hashPassword(password)

  assert.ok(hashed.startsWith("$2"))
  assert.equal(await verifyPassword(password, hashed), true)
  assert.equal(await verifyPassword("salah", hashed), false)
})

test("verifyPassword tetap mendukung legacy seed hash", async () => {
  const password = "password"
  const digest = createHash("sha256").update(password).digest("hex")
  const legacy = `seed-sha256:${digest}`

  assert.equal(isLegacySeedHash(legacy), true)
  assert.equal(await verifyPassword(password, legacy), true)
  assert.equal(await verifyPassword("salah", legacy), false)
})
