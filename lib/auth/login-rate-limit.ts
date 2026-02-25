type Entry = {
  count: number
  firstAttemptAt: number
  blockedUntil: number | null
}

const attempts = new Map<string, Entry>()

const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 5
const BLOCK_MS = 15 * 60 * 1000

function now() {
  return Date.now()
}

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase()
}

function getEntry(identifier: string) {
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

export function isLoginRateLimited(identifier: string) {
  const { entry } = getEntry(identifier)
  const current = now()
  if (!entry) return { limited: false as const }
  if (entry.blockedUntil && entry.blockedUntil > current) {
    return { limited: true as const, retryAfterMs: entry.blockedUntil - current }
  }
  return { limited: false as const }
}

export function recordLoginFailure(identifier: string) {
  const current = now()
  const { key, entry } = getEntry(identifier)

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
}

export function clearLoginFailures(identifier: string) {
  attempts.delete(normalizeIdentifier(identifier))
}
