import { test, expect } from '@playwright/test'
import { OMAR, GYM1, authedApi } from '../support/api'

/**
 * Swagger-driven enumeration: pull the live OpenAPI document and walk every GET
 * operation, substituting the seeded dev IDs for path parameters. This proves
 * request/response connectivity for the whole readable surface — every route
 * answers a well-formed HTTP status and never a 5xx (a crash is the only
 * unacceptable outcome). 401/403/404 are legitimate business answers here: many
 * surfaces are permission-gated or leader-only scoped, so an out-of-scope read
 * correctly 404s, and a few swagger paths are stale relative to the running app.
 */

/** Dev-seed substitutions for the 11 path parameter names the API uses. */
const PATH_PARAMS: Record<string, string> = {
  gymId: String(GYM1),
  employeeId: '3', // a seeded team member
  employeeReference: '1',
  teamId: '1',
  cycleId: '1',
  templateId: '1',
  periodId: '1',
  entryId: '1',
  docId: '1',
  evaluationId: '1',
  id: '1',
}

interface SwaggerOp {
  parameters?: Array<{ name: string; in: string; required?: boolean }>
  responses?: Record<string, unknown>
}

function fillParams(template: string): string {
  return template.replace(/\{(\w+)\}/g, (_m, name: string) => {
    const v = PATH_PARAMS[name]
    if (!v) throw new Error(`no seeded substitution for path param {${name}}`)
    return v
  })
}

test.describe('swagger enumeration', () => {
  test('swagger.json is served and well-formed', async ({ request }) => {
    const res = await request.get('/swagger/v1/swagger.json')
    expect(res.status()).toBe(200)
    const doc = await res.json()
    expect(doc.openapi).toMatch(/^3\./)
    expect(Object.keys(doc.paths).length).toBeGreaterThan(100)
  })

  test('every documented GET route answers a well-formed status', async ({ request }) => {
    const doc = await (await request.get('/swagger/v1/swagger.json')).json()
    const api = await authedApi(OMAR, GYM1)

    const routes: Array<{ method: string; path: string }> = []
    for (const [path, item] of Object.entries<Record<string, SwaggerOp>>(doc.paths)) {
      const get = item.get
      if (!get) continue
      // Skip operations that require a required path param we cannot seed.
      const required = (get.parameters ?? []).filter((p) => p.in === 'path' && p.required)
      if (required.some((p) => !PATH_PARAMS[p.name])) continue
      routes.push({ method: 'GET', path })
    }
    expect(routes.length).toBeGreaterThan(60)

    const bad: string[] = []
    for (const route of routes) {
      const url = fillParams(route.path)
      const res = await api.get(url)
      const status = res.status()
      // Connectivity contract: whatever the scope/permission answer, the route
      // must never crash. 401/403/404/405/422 are acceptable business answers.
      if (status >= 500) {
        bad.push(`${route.method} ${url} -> ${status}`)
      }
    }
    expect(bad, `routes answering 5xx:\n${bad.join('\n')}`).toEqual([])
  })

  test('a documented collection GET returns a JSON shape', async () => {
    const api = await authedApi(OMAR, GYM1)
    const res = await api.get(`/api/gyms/${GYM1}/shift-templates`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('the API rejects an unauthenticated call', async ({ request }) => {
    const res = await request.get(`/api/gyms/${GYM1}/shift-cycles`)
    expect([401, 403]).toContain(res.status())
  })
})
