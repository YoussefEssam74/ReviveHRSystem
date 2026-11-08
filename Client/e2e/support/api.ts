import { request as pwRequest, type APIRequestContext } from '@playwright/test'

/**
 * Shared API plumbing for the Playwright suite.
 *
 * The dev API rate-limits POST /api/auth/login to 10/min per IP, so every
 * token is acquired through a process-wide cache keyed by email+gym. A single
 * Playwright worker reuses one token for the whole run instead of re-logging-in
 * per test.
 */

export const API_BASE = 'http://localhost:5248'
export const PASSWORD = 'Revive!2026'

/** Seeded gyms (DevelopmentDataSeeder). */
export const GYM1 = 1 // Revive Main Gym
export const GYM2 = 2 // Revive Second Gym

interface CachedToken {
  accessToken: string
}

const tokenCache = new Map<string, CachedToken>()

async function newContext(): Promise<APIRequestContext> {
  return pwRequest.newContext({ baseURL: API_BASE })
}

/** POST /api/auth/login -> the raw body (accessToken, or tempSessionToken + gyms). */
export async function login(email: string): Promise<Record<string, unknown>> {
  const ctx = await newContext()
  try {
    const res = await ctx.post('/api/auth/login', { data: { email, password: PASSWORD } })
    if (!res.ok()) {
      throw new Error(`login ${email} failed: ${res.status()} ${await res.text()}`)
    }
    return (await res.json()) as Record<string, unknown>
  } finally {
    await ctx.dispose()
  }
}

/**
 * Logs in and, if the account spans gyms, completes the challenge for `gymId`.
 * Returns a bearer token. Single-gym accounts ignore gymId.
 */
export async function tokenFor(email: string, gymId?: number): Promise<string> {
  const key = `${email}::${gymId ?? 'auto'}`
  const cached = tokenCache.get(key)
  if (cached) return cached.accessToken

  // POST /api/auth/login is rate-limited (10/min per IP on the dev API). The
  // suite logs in once per account and reuses the token, but a busy minute can
  // still land a 429, so retry once after the fixed window rolls over.
  for (let attempt = 1; ; attempt++) {
    const ctx = await newContext()
    try {
      const loginRes = await ctx.post('/api/auth/login', { data: { email, password: PASSWORD } })
      if (loginRes.status() === 429 && attempt === 1) {
        await new Promise((r) => setTimeout(r, 62_000))
        continue
      }
      if (!loginRes.ok()) {
        throw new Error(`login ${email} failed: ${loginRes.status()} ${await loginRes.text()}`)
      }
      const body = (await loginRes.json()) as Record<string, unknown>

      let accessToken: string | undefined
      if (body.requiresGymSelection && body.tempSessionToken) {
        const gyms = (body.gyms ?? []) as Array<{ gymId?: number }>
        const target = gymId ?? gyms[0]?.gymId
        if (target == null) throw new Error(`${email}: no gym to select`)
        // select-gym shares the auth-login budget with login, so retry it too.
        let sel;
        for (let attempt = 1; ; attempt++) {
          sel = await ctx.post('/api/auth/login/select-gym', {
            data: { tempSessionToken: body.tempSessionToken, gymId: target },
          })
          if (sel.status() === 429 && attempt < 3) {
            await new Promise((r) => setTimeout(r, 62_000))
            continue
          }
          break
        }
        if (!sel.ok()) {
          throw new Error(`select-gym ${email} -> ${target} failed: ${sel.status()} ${await sel.text()}`)
        }
        accessToken = ((await sel.json()) as Record<string, unknown>).accessToken as string | undefined
      } else {
        accessToken = body.accessToken as string | undefined
      }

      if (!accessToken) throw new Error(`login ${email} returned no accessToken`)
      tokenCache.set(key, { accessToken })
      return accessToken
    } finally {
      await ctx.dispose()
    }
  }
}

/**
 * A bearer-token API context for the given account/gym. Caller must dispose().
 *
 * APIRequestContext takes default options at construction (there is no
 * setExtraHTTPHeaders on the request context — that method lives on
 * BrowserContext), so auth is supplied as the default `extraHTTPHeaders`.
 * Per-call `headers` still override/merge on top of these.
 */
export async function authedApi(email: string, gymId?: number): Promise<APIRequestContext> {
  const accessToken = await tokenFor(email, gymId)
  const ctx = await pwRequest.newContext({
    baseURL: API_BASE,
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
  })
  return ctx
}

/** Authorization headers for the given account/gym, for one-off calls. */
export async function authHeaders(email: string, gymId?: number): Promise<Record<string, string>> {
  const accessToken = await tokenFor(email, gymId)
  return { Authorization: `Bearer ${accessToken}` }
}

/**
 * A fresh token scoped to `gymId` obtained via POST /api/auth/switch-gym (the
 * ADR-002 Amendment 1 path), deliberately reusing an existing cached login so
 * the switch test exercises the real endpoint without spending another login on
 * the shared 10/min auth budget. Cached per account+gym.
 */
export async function switchedTokenFor(email: string, fromGym: number, toGym: number): Promise<string> {
  const key = `switch::${email}::${fromGym}->${toGym}`
  const cached = tokenCache.get(key)
  if (cached) return cached.accessToken

  const base = await tokenFor(email, fromGym)
  const ctx = await newContext()
  try {
    const res = await ctx.post('/api/auth/switch-gym', {
      headers: { Authorization: `Bearer ${base}` },
      data: { gymId: toGym },
    })
    if (!res.ok()) {
      throw new Error(`switch-gym ${email} ${fromGym}->${toGym} failed: ${res.status()} ${await res.text()}`)
    }
    const accessToken = ((await res.json()) as Record<string, unknown>).accessToken as string | undefined
    if (!accessToken) throw new Error(`switch-gym ${email} returned no accessToken`)
    tokenCache.set(key, { accessToken })
    return accessToken
  } finally {
    await ctx.dispose()
  }
}

/** The manager multi-gym account used across the schedule/reminder flows. */
export const OMAR = 'omar@revive.hr'
export const KARIM = 'karim@revive.hr'
export const HRMANAGER = 'hrmanager@revive.hr'

/**
 * Every account/gym pair the suite authenticates as. Kept in one place so the
 * global setup can warm the cache (and its logins fit under the rate limit)
 * before any test runs.
 */
export const ACCOUNTS: Array<[string, number | undefined]> = [
  [OMAR, GYM1],
  [OMAR, GYM2],
  [HRMANAGER, GYM1],
  [KARIM, undefined],
]
