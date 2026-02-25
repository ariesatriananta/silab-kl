type Entry = {
  count: number
  firstAttemptAt: number
  blockedUntil: number | null
}

const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5
const BLOCK_MS = 15 * 60 * 1000
function now() {
  return Date.now()
}

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase()
}

function getEntry(attempts: Map<string, Entry>, identifier: string) {
  const key = normalizeIdentifier(identifier)
  const value = attempts.get(key)
  if (!value) return { key, entry: null as Entry | null }

  const current = now()
  if (value.blockedUntil && value.blockedUntil <= current) {
    attempts.delete(key)
    return { key, entry: null as Entry | null }
  }
  if (!value.blockedUntil && current - value.firstAttemptAt > WINDOW_MS) {
    attempts.delete(key)
    return { key, entry: null as Entry | null }
  }

  return { key, entry: value }
}

export function createInMemoryLoginRateLimiter() {
  const attempts = new Map<string, Entry>()

  return {
    async isLoginRateLimited(identifier: string) {
      const { entry } = getEntry(attempts, identifier)
      const current = now()
      if (!entry) return { limited: false as const }
      if (entry.blockedUntil && entry.blockedUntil > current) {
        return { limited: true as const, retryAfterMs: entry.blockedUntil - current }
      }
      return { limited: false as const }
    },
    async recordLoginFailure(identifier: string) {
      const current = now()
      const { key, entry } = getEntry(attempts, identifier)

      if (!entry) {
        attempts.set(key, {
          count: 1,
          firstAttemptAt: current,
          blockedUntil: null,
        })
        return
      }

      const nextCount = entry.count + 1
      const shouldBlock = nextCount >= MAX_ATTEMPTS
      attempts.set(key, {
        count: nextCount,
        firstAttemptAt: entry.firstAttemptAt,
        blockedUntil: shouldBlock ? current + BLOCK_MS : null,
      })
    },
    async clearLoginFailures(identifier: string) {
      attempts.delete(normalizeIdentifier(identifier))
    },
    _reset() {
      attempts.clear()
    },
  }
}

const memoryLimiter = createInMemoryLoginRateLimiter()

export async function isLoginRateLimited(identifier: string) {
  return await memoryLimiter.isLoginRateLimited(identifier)
}

export async function recordLoginFailure(identifier: string) {
  await memoryLimiter.recordLoginFailure(identifier)
}

export async function clearLoginFailures(identifier: string) {
  await memoryLimiter.clearLoginFailures(identifier)
}
