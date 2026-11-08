import { expect } from '@playwright/test'
import { ACCOUNTS, API_BASE, tokenFor } from './support/api'

/**
 * Acquires one token per account/gym BEFORE any test runs, so the per-test
 * authedApi() calls are pure cache hits. This keeps the whole run to a handful
 * of POST /api/auth/login calls, comfortably under the dev API's 10/min cap,
 * instead of one login per test file.
 *
 * It also asserts the login/me contract once, here, so that coverage does not
 * cost an extra login per test.
 */
export default async function globalSetup(): Promise<void> {
  for (const [email, gymId] of ACCOUNTS) {
    const token = await tokenFor(email, gymId)

    // GET /api/auth/me must answer 200 with a permissions[] array for a valid token.
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status(), `/api/auth/me for ${email}`).toBe(200)
    const body = (await res.json()) as { permissions?: unknown[] }
    expect(Array.isArray(body.permissions), `/api/auth/me permissions for ${email}`).toBe(true)

    // Small gap so a re-run against a still-counted window doesn't burst.
    await new Promise((r) => setTimeout(r, 300))
  }
}
