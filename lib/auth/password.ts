import { createHash } from "node:crypto"

import { compare, hash } from "bcryptjs"

const BCRYPT_ROUNDS = 12

export function isLegacySeedHash(storedHash: string) {
  return storedHash.startsWith("seed-sha256:")
}

export async function hashPassword(password: string) {
  return hash(password, BCRYPT_ROUNDS)
}

export async function verifyPassword(password: string, storedHash: string) {
  if (!storedHash) return false

  // Legacy seed format used during early setup.
  if (isLegacySeedHash(storedHash)) {
    const digest = createHash("sha256").update(password).digest("hex")
    return storedHash === `seed-sha256:${digest}`
  }

  return compare(password, storedHash)
}
