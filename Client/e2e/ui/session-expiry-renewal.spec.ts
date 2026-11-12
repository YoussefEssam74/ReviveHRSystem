import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { API_BASE, OMAR, PASSWORD } from '../support/api'

/**
 * Silent renewal must never be cancelled by the request that happened to start
 * it, and two tabs refreshing at once must not sign each other out.
 *
 * The bug this locks down: `tryRefreshSession` inherited the originating
 * request's AbortSignal, so a navigation aborted the refresh *after* the server
 * had already rotated the credential. The rotated token was discarded, the next
 * request re-presented the spent one, the server refused it (its rotation grace
 * answers a spent token with 401 without revoking the chain) and the client
 * cleared the shared session — every tab bounced to /login 15 minutes after
 * sign-in.
 */

interface SeededSession {
  version: number
  accessToken: string
  refreshToken: string
  expiresAt: number
  refreshExpiresAt: number
  user: {
    id: number
    email: string
    userName: string
    userType: string
    gymName: string | null
    gymId: number | null
    gymAccess: Array<{ gymId: number; gymName: string }>
  }
}

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

/**
 * Mints a real session (access + refresh credential) through the challenge flow.
 * The access token is then replaced with an unverifiable one so the API answers
 * 401/`invalid_token` — the client only cares that the bearer was refused, so no
 * JWT signing key is needed here.
 */
async function seedSession(): Promise<SeededSession> {
  const login = (await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: OMAR, password: PASSWORD }),
  }).then((r) => r.json())) as {
    requiresGymSelection?: boolean
    tempSessionToken?: string
    gyms?: Array<{ gymId: number; gymName: string }>
  }
  if (!login.requiresGymSelection || !login.tempSessionToken || !login.gyms) {
    throw new Error(`no gym challenge: ${JSON.stringify(login)}`)
  }

  const session = (await fetch(`${API_BASE}/api/auth/login/select-gym`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gymId: login.gyms[0].gymId, tempSessionToken: login.tempSessionToken }),
  }).then((r) => r.json())) as SelectResponse

  if (!session.accessToken || !session.refreshToken) throw new Error('select-gym returned no session')

  return {
    version: 2,
    accessToken: 'revive.renewal.spec.rejected.access.token',
    refreshToken: session.refreshToken,
    expiresAt: Date.now() - 60_000,
    refreshExpiresAt: Date.now() + (session.refreshExpiresInSeconds ?? 3600) * 1000,
    user: {
      id: session.user?.id ?? 0,
      email: session.user?.email ?? OMAR,
      userName: session.user?.userName ?? 'omar',
      userType: session.user?.userType ?? 'Employee',
      gymName: session.user?.gymName ?? login.gyms[0].gymName,
      gymId: session.user?.gymId ?? login.gyms[0].gymId,
      gymAccess: session.user?.gymAccess ?? [],
    },
  }
}

async function openWithSession(context: BrowserContext, session: SeededSession): Promise<Page> {
  const page = await context.newPage()
  await page.addInitScript((blob) => {
    // Only seed once: sibling tabs must start from the same blob and then share
    // whatever the first successful renewal writes.
    if (!window.localStorage.getItem('revive.session')) {
      window.localStorage.setItem('revive.session', JSON.stringify(blob))
    }
  }, session)
  return page
}

const storedToken = (page: Page) =>
  page.evaluate(() => {
    const raw = window.localStorage.getItem('revive.session')
    return raw ? (JSON.parse(raw) as { accessToken: string }).accessToken : null
  })

test('a slow silent renewal still persists the rotated token', async ({ browser }) => {
  const session = await seedSession()
  const context = await browser.newContext()
  const page = await openWithSession(context, session)

  let refreshReachedServer: () => void = () => {}
  const refreshStarted = new Promise<void>((resolve) => (refreshReachedServer = resolve))
  let releaseRefresh: () => void = () => {}
  const refreshGate = new Promise<void>((resolve) => (releaseRefresh = resolve))

  await page.route('**/api/auth/refresh', async (route) => {
    // Let the server rotate, then hold the answer. The originating request is
    // cancelled while the renewal is pending (dev StrictMode remounts query
    // observers, and any page unload does the same) — the old code aborted the
    // shared refresh with it, lost the rotated token, re-presented the spent one
    // and cleared the session.
    const response = await route.fetch()
    refreshReachedServer()
    await refreshGate
    await route.fulfill({ response }).catch(() => {
      /* client aborted the fetch: exactly the regression being guarded */
    })
  })

  await page.goto('/console/dashboard', { waitUntil: 'domcontentloaded' })
  await refreshStarted
  await page.waitForTimeout(1_500)

  // A navigation while the renewal is pending must not cancel it either.
  await page.getByRole('link', { name: 'Notifications' }).first().click()
  await expect(page).toHaveURL(/\/console\/notifications/)

  releaseRefresh()

  // The rotated credential must be persisted and the user must stay signed in.
  await expect.poll(() => storedToken(page), { timeout: 20_000 }).not.toBe(session.accessToken)
  await expect(page).not.toHaveURL(/\/login/)
  await expect(page.getByRole('link', { name: 'Notifications' }).first()).toBeVisible({ timeout: 20_000 })

  await context.close()
})

test('two tabs renewing at expiry keep the shared session', async ({ browser }) => {
  const session = await seedSession()
  const context = await browser.newContext()

  const first = await openWithSession(context, session)
  const second = await openWithSession(context, session)

  await Promise.all([
    first.goto('/employee/dashboard', { waitUntil: 'domcontentloaded' }),
    second.goto('/employee/requests', { waitUntil: 'domcontentloaded' }),
  ])

  // The loser of the rotation race presents a spent token, which the server
  // refuses without revoking the chain — it must adopt the winner's session.
  await expect.poll(() => storedToken(first), { timeout: 20_000 }).not.toBe(session.accessToken)
  await expect(first).not.toHaveURL(/\/login/)
  await expect(second).not.toHaveURL(/\/login/)
  await expect(first.getByRole('button', { name: 'Switch gym' })).toBeVisible({ timeout: 20_000 })
  await expect(second.getByRole('button', { name: 'Switch gym' })).toBeVisible({ timeout: 20_000 })

  await context.close()
})

test('a genuinely dead refresh credential still signs the user out', async ({ browser }) => {
  const session = await seedSession()
  const context = await browser.newContext()
  const page = await openWithSession(context, { ...session, refreshToken: 'dead.refresh.credential' })

  await page.goto('/employee/dashboard', { waitUntil: 'domcontentloaded' })

  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 })
  expect(await storedToken(page)).toBeNull()

  await context.close()
})
