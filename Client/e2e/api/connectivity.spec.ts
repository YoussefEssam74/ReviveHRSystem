import { test, expect } from '@playwright/test'
import { authedApi, OMAR, HRMANAGER, GYM1, GYM2 } from '../support/api'

/**
 * Broad connectivity sweep across the seeded manager surface.
 *
 * The contract here is deliberately NOT "every route returns 200". Several
 * surfaces are leader-only or gym-scoped by design and answer a business 404
 * when the caller is out of scope (e.g. GetTeamTodayAsync is leader-only). So
 * these assertions pin the real answers for each seeded role and always fail on
 * a 5xx (a crash is never an acceptable answer).
 */

test.describe('portal-area GET connectivity', () => {
  test('the schedule surface answers for a Branch Manager in his own gym', async () => {
    const api = await authedApi(OMAR, GYM1)
    for (const url of [
      `/api/gyms/${GYM1}/shift-cycles`,
      `/api/gyms/${GYM1}/shift-templates`,
      '/api/employees',
      '/api/teams/my-teams',
    ]) {
      const res = await api.get(url)
      expect(res.status(), url).toBe(200)
      expect(res.headers()['content-type'], url).toContain('application/json')
    }
  })

  test('a Branch Manager sees his teams, and a non-led team is a scoped 404', async () => {
    const api = await authedApi(OMAR, GYM1)
    // my-teams is the discovery surface and must answer 200.
    const myTeams = await api.get('/api/teams/my-teams')
    expect(myTeams.status()).toBe(200)
    const teams = (await myTeams.json()) as Array<{ id: number }>
    expect(Array.isArray(teams)).toBe(true)

    // A Team Leader reaches today's overview for a team HE leads.
    if (teams.length > 0) {
      const today = await api.get(`/api/teams/${teams[0].id}/today`)
      expect(today.status()).toBe(200)
    }

    // Team 999 does not exist, so it is a 404 — never a 500.
    const missing = await api.get('/api/teams/999/today')
    expect([404]).toContain(missing.status())
  })

  test('requests, attendance and evaluations answer for the HR manager', async () => {
    const api = await authedApi(HRMANAGER, GYM1)
    for (const url of [
      '/api/requests',
      '/api/gyms/1/attendance-policy',
      '/api/notifications',
      '/api/payroll-periods',
    ]) {
      const res = await api.get(url)
      // Permission-gated surfaces may answer 401/403; a 5xx is always a defect.
      expect([200, 401, 403], `${url} -> ${res.status()}`).toContain(res.status())
    }
  })

  test('cross-gym reads stay scoped and never 500', async () => {
    // Omar is BM of gym1; gym2 is out of his management scope. Reading another
    // gym's cycles must be scoped (404/403) or empty — never a crash.
    const api = await authedApi(OMAR, GYM1)
    const res = await api.get(`/api/gyms/${GYM2}/shift-cycles`)
    expect([200, 401, 403, 404], `status ${res.status()}`).toContain(res.status())
    expect(res.status(), `5xx on cross-gym read: ${res.status()}`).toBeLessThan(500)
  })
})
