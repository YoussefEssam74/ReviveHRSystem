import { test, expect } from '@playwright/test'
import { OMAR, PASSWORD } from '../support/api'

/**
 * Reproduces the user's tab state exactly:
 * 1. A leftover schema-v2 session from yesterday, whose refresh chain is now
 *    dead (swept by server-side revocation) — stored with gym2 as the user
 *    left it, but the page was closed before any cleanup.
 * 2. Opening the app: auto-restore → all API calls 401 → refresh refused →
 *    session cleared → login page appears.
 * 3. Logging in and picking Second Gym must land in Second Gym and STAY.
 */

test('recovery from a dead stale session ends up in the picked gym', async ({ page }) => {
  // Seed the stale-but-executable session blob (schema v2, gym2, dead chain).
  await page.goto('/login')
  await page.evaluate(() => {
    window.localStorage.setItem('revive.session', JSON.stringify({
      version: 2,
      accessToken: 'stale.dead.access.token',
      refreshToken: 'stale.dead.refresh.chain',
      expiresAt: Date.now() - 60_000, // expired access
      refreshExpiresAt: Date.now() + 26 * 24 * 3600_000,
      user: { id: 3, email: 'omar@revive.hr', userName: 'omar', userType: 'Employee', gymName: 'Revive Second Gym', gymId: 2, gymAccess: [{ gymId: 1, gymName: 'Revive Main Gym' }, { gymId: 2, gymName: 'Revive Second Gym' }] },
    }))
  })

  // Open the app with the stale session present.
  await page.goto('/employee/dashboard')
  // The dead session must be discarded: the login page (or challenge) appears.
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })
  console.log('stale dead session -> app sent user to the login page ✔')

  // Fresh login picking Second Gym.
  await page.getByLabel('Email').fill(OMAR)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('heading', { name: 'Choose your gym' })).toBeVisible()
  await page.getByRole('button', { name: 'Revive Second Gym' }).click()

  await expect(page).toHaveURL(/\/employee\/dashboard/, { timeout: 15_000 })
  const switcher = page.getByRole('button', { name: 'Switch gym' })
  await expect(switcher).toBeVisible()
  const afterLogin = (await switcher.textContent())?.trim() ?? '?'
  console.log('AFTER LOGIN (picked Second Gym) header shows:', afterLogin)

  // The dashboard body shows the caller's employment record, which is homed in
  // Main Gym. With the active gym being Second Gym the page must SAY so instead
  // of only showing "Fitness Trainer · Revive Main Gym" (the exact line that
  // made the user believe the switch had failed).
  const mismatchBadge = page.getByText(/Employment record is from .+ — you are working in .+ today/)
  await expect(mismatchBadge).toBeVisible({ timeout: 15_000 })
  console.log('record/active-gym mismatch badge visible on the dashboard ✔')

  // Audience-proof: persist across a hard reload.
  await page.reload()
  await expect(page).toHaveURL(/\/employee\/dashboard/, { timeout: 15_000 })
  await page.waitForTimeout(1500)
  const afterReload = (await switcher.textContent())?.trim() ?? '?'
  console.log('AFTER RELOAD header shows:', afterReload)

  await expect(switcher).toContainText('Revive Second Gym')
})
