import test from "node:test"
import assert from "node:assert/strict"

import { createInMemoryLoginRateLimiter } from "@/lib/auth/login-rate-limit"

test("login rate limiter memblokir setelah 5 kali gagal", async () => {
  const limiter = createInMemoryLoginRateLimiter()
  const id = "P27834021001"

  for (let i = 0; i < 4; i++) {
    await limiter.recordLoginFailure(id)
    const state = await limiter.isLoginRateLimited(id)
    assert.equal(state.limited, false)
  }

  await limiter.recordLoginFailure(id)
  const blocked = await limiter.isLoginRateLimited(id)
  assert.equal(blocked.limited, true)
  assert.ok((blocked.retryAfterMs ?? 0) > 0)
})

test("clearLoginFailures menghapus blokir percobaan login", async () => {
  const limiter = createInMemoryLoginRateLimiter()
  const id = "admin"

  for (let i = 0; i < 5; i++) {
    await limiter.recordLoginFailure(id)
  }
  assert.equal((await limiter.isLoginRateLimited(id)).limited, true)

  await limiter.clearLoginFailures(id)
  assert.equal((await limiter.isLoginRateLimited(id)).limited, false)
})

