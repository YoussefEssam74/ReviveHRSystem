import { test, expect } from '@playwright/test'
import { authedApi, tokenFor, switchedTokenFor, OMAR, GYM1, GYM2 } from '../support/api'

/**
 * Regression coverage for the two reported API bugs:
 *   1. Creating a shift template from the SPA sent "HH:mm" (<input type="time">)
 *      and the TimeOnly binder demanded "HH:mm:ss" -> 400 "validation error".
 *   2. Reminding/messaging an employee hit "Employee not found." out of scope.
 */

test.describe('shift templates — HH:mm binding', () => {
  test('creates a template from the browser HH:mm payload and returns HH:mm:ss', async () => {
    const api = await authedApi(OMAR, GYM1)
    const name = `PW HHmm ${Date.now()}`

    // Exactly what the SPA's <input type="time"> produces.
    const create = await api.post(`/api/gyms/${GYM1}/shift-templates`, {
      data: { name, start: '08:00', end: '16:00' },
    })
    expect(create.status()).toBe(201)
    const created = await create.json()
    expect(created.start).toBe('08:00:00')
    expect(created.end).toBe('16:00:00')
    const id = created.id as number

    // Update with the same short format also binds.
    const update = await api.put(`/api/gyms/${GYM1}/shift-templates/${id}`, {
      data: { name: `${name} v2`, start: '09:30', end: '17:45' },
    })
    expect(update.status()).toBe(200)
    expect((await update.json()).start).toBe('09:30:00')

    // It is listed, then removed.
    const list = await api.get(`/api/gyms/${GYM1}/shift-templates`)
    expect((await list.json()).some((t: { id: number }) => t.id === id)).toBe(true)

    const del = await api.delete(`/api/gyms/${GYM1}/shift-templates/${id}`)
    expect(del.status()).toBe(204)
  })

  test('a full HH:mm:ss payload still binds (backward compatible)', async () => {
    const api = await authedApi(OMAR, GYM1)
    const res = await api.post(`/api/gyms/${GYM1}/shift-templates`, {
      data: { name: `PW HHmmss ${Date.now()}`, start: '07:15:00', end: '15:45:00' },
    })
    expect(res.status()).toBe(201)
    const created = await res.json()
    expect(created.start).toBe('07:15:00')
    await api.delete(`/api/gyms/${GYM1}/shift-templates/${created.id}`)
  })

  test('a backwards window is still rejected with 400', async () => {
    const api = await authedApi(OMAR, GYM1)
    const res = await api.post(`/api/gyms/${GYM1}/shift-templates`, {
      data: { name: `PW backwards ${Date.now()}`, start: '18:00', end: '09:00' },
    })
    expect(res.status()).toBe(400)
  })
})

test.describe('reminders — scope rules', () => {
  test('a Branch Manager can remind an in-gym employee (204)', async () => {
    const api = await authedApi(OMAR, GYM1)
    // Omar is BM of gym1; employee 2 belongs to gym1.
    const res = await api.post('/api/teams/members/2/reminders')
    expect(res.status()).toBe(204)
  })

  test('an unknown employee is a 404, not a 500', async () => {
    const api = await authedApi(OMAR, GYM1)
    const res = await api.post('/api/teams/members/999999/reminders')
    expect(res.status()).toBe(404)
  })

  test('a Team Leader is fail-closed on an out-of-team target (404)', async () => {
    // Omar is Team Leader of team 1 in gym2; employee 4 is not on his team.
    const api = await authedApi(OMAR, GYM2)
    const res = await api.post('/api/teams/members/4/reminders')
    expect(res.status()).toBe(404)
  })

  test('a Team Leader can remind his own team member (204)', async () => {
    const api = await authedApi(OMAR, GYM2)
    // Employee 3 is on team 1 (gym2) that Omar leads.
    const res = await api.post('/api/teams/members/3/reminders')
    expect(res.status()).toBe(204)
  })
})

test.describe('auth + gym switching', () => {
  test('login, per-gym role, and switch-gym all answer', async ({ request }) => {
    // Read the cached token WITHOUT logging in again: the auth-login budget is
    // 10/min per IP and shared across login + select-gym + switch-gym, so the
    // suite must not spend a fresh login per test.
    const token = await tokenFor(OMAR, GYM1)

    const me = await request.get('/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(me.status()).toBe(200)
    const meBody = await me.json()
    expect(meBody.activeGym.gymId).toBe(GYM1)
    expect(meBody.roleInActiveGym).toBe('Branch Manager')

    // Switch to gym2 via the real switch-gym endpoint (reuses the cached login).
    const switched = await switchedTokenFor(OMAR, GYM1, GYM2)
    const me2 = await request.get('/api/me', {
      headers: { Authorization: `Bearer ${switched}` },
    })
    expect(me2.status()).toBe(200)
    const me2Body = await me2.json()
    expect(me2Body.activeGym.gymId).toBe(GYM2)
    expect(me2Body.roleInActiveGym).toBe('Team Leader')
  })
})
