import { test, expect } from '@playwright/test'
import { API_BASE, OMAR, PASSWORD } from '../support/api'
import type { StoredSession } from '../../src/lib/session-store'

/**
 * Multi-tab eviction race (the "normal Chrome" report).
 *
 * All tabs of one browser profile share `revive.session` in localStorage.
 * When a STALE tab (session minted earlier, refresh chain then swept by a
 * newer login) has a request in flight and that request finally 401s, the old
 * behavior cleared shared storage — evicting the NEWER session the user had
 * just established in another tab and bouncing them to the login page.
 *
 * The fix: a 401 challenge may only clear storage when the failing credential
 * is still the stored one. A stale holder must not evict a newer session.
 */

interface SelectResponse {
  accessToken: string
  refreshToken?: string
  expiresInSeconds?: number
  refreshExpiresInSeconds?: number
  user?: {
    id?: number
    email?: string
    userName?: string
    userType?: string
    gymName?: string | null
    gymId?: number | null
    gymAccess?: Array<{ gymId: number; gymName: string }>
  }
}

/** Full login for one gym, through the challenge flow (also sweeps other chains). */
async function mintSession(gymNamePart: RegExp): Promise<{ blob: StoredSession; accessToken: string }> {
  const login = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: OMAR, password: PASSWORD }),
  }).then((r) => r.json() as Promise<{ requiresGymSelection?: boolean; tempSessionToken?: string; gyms?: Array<{ gymId: number; gymName: string }> }>)
  if (!login.requiresGymSelection || !login.tempSessionToken || !login.gyms) throw new Error(`no gym challenge: ${JSON.stringify(login)}`)
  const gym = login.gyms.find((g) => gymNamePart.test(g.gymName))
  if (!gym) throw new Error(`gym ${gymNamePart} not in ${JSON.stringify(login.gyms)}`)
  const session = (await fetch(`${API_BASE}/api/auth/login/select-gym`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gymId: gym.gymId, tempSessionToken: login.tempSessionToken }),
  }).then((r) => r.json() as Promise<SelectResponse>))
  if (!session.accessToken) throw new Error('select-gym returned no access token')

  const blob: StoredSession = {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: Date.now() + (session.expiresInSeconds ?? 3600) * 1000,
    refreshExpiresAt: session.refreshExpiresInSeconds ? Date.now() + session.refreshExpiresInSeconds * 1000 : undefined,
    user: {
      id: session.user?.id ?? 0,
      email: session.user?.email ?? OMAR,
      userName: session.user?.userName ?? OMAR.split('@')[0] ?? 'omar',
      userType: session.user?.userType ?? 'Employee',
      gymName: session.user?.gymName ?? gym.gymName,
      gymId: session.user?.gymId ?? gym.gymId,
      gymAccess: session.user?.gymAccess?.filter((g) => typeof g.gymId === 'number') ?? [],
    },
  }
  return { blob, accessToken: session.accessToken }
}

test('a stale tab in-flight 401 must not evict a newer session from shared storage', async ({ browser }) => {
  const stale = await mintSession(/Main/) // chain gets swept by the next mint
  const fresh = await mintSession(/Second/) // single-live-chain sweeps the stale chain

  const context = await browser.newContext()
  const staleTab = await context.newPage()

  // Hold me/profile responses so the stale tab cannot clear storage before the
  // newer session exists (the eviction needs the 401 to land AFTER a takeover).
  let releaseMe: () => void
  const held = new Promise<void>((resolve) => (releaseMe = resolve))
  const HOLD = '**/api/me'
  const HOLD_USER = '**/api/auth/me'
  // Only STALE-credential requests get the forced 401 (after `held`), like a
  // swept-chain refusal would be. Requests that already carry the newer
  // session's token pass through to the real API and succeed.
  const staleGate = async (route: { request(): { headers(): Record<string, string> }, fulfill(response: { status: number; headers?: Record<string, string>; contentType?: string; body?: string }): Promise<unknown>, continue(): Promise<unknown> }) => {
    const auth = route.request().headers()['authorization'] ?? ''
    if (auth.endsWith(stale.accessToken)) {
      await held
      await route.fulfill({
        status: 401,
        headers: { 'WWW-Authenticate': 'Bearer' },
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 401, message: 'Your session is invalid. Please sign in again.' }),
      })
    } else {
      await route.continue()
    }
  }
  await staleTab.route(HOLD, staleGate)
  await staleTab.route(HOLD_USER, staleGate)

  // Open the stale tab with the swept session whose ACCESS token is expired
  // (the client keeps such a session while its refresh credential looks alive).
  await staleTab.addInitScript((blob) => {
    window.localStorage.setItem('revive.session', JSON.stringify({ version: 2, ...blob, expiresAt: Date.now() - 1000 }))
  }, stale.blob)
  await staleTab.goto('/employee/dashboard', { waitUntil: 'domcontentloaded' })

  // A second tab of the same profile (same shared storage) lands the fresh gym.
  const freshTab = await context.newPage()
  await freshTab.addInitScript((blob) => window.localStorage.setItem('revive.session', JSON.stringify({ version: 2, ...blob })), fresh.blob)
  await freshTab.goto('/employee/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(freshTab.getByRole('button', { name: 'Switch gym' })).toContainText('Revive Second Gym', { timeout: 15_000 })
  console.log('fresh tab established the Second Gym session ✔')

  // Now let the stale tab's held requests settle: the (expired-access) capture
  // 401s like a swept chain would. Old behavior: clearSession() — wiping the
  // fresh session. New behavior: the guard sees the stored token differs and
  // leaves storage alone.
  releaseMe()

  await expect.poll(async () => staleTab.evaluate(() => Boolean(window.localStorage.getItem('revive.session')))).toBe(true)
  const stored = await staleTab.evaluate(() => JSON.parse(window.localStorage.getItem('revive.session') ?? 'null') as { accessToken: string } | null)
  expect(stored?.accessToken).toBe(fresh.accessToken)
  expect(await staleTab.evaluate(() => window.localStorage.getItem('revive.session'))).toBeTruthy()
  console.log('shared storage still holds the FRESH session after the stale 401 ✔')

  // The stale tab adopts the newer session (same storage) and heals into the
  // fresh gym instead of collapsing to a login bounce.
  await expect(staleTab.getByRole('button', { name: 'Switch gym' })).toContainText('Revive Second Gym', { timeout: 20_000 })
  console.log('stale tab adopted the newer session instead of evicting it ✔')

  await context.close()
})
