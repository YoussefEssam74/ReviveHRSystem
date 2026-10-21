import { test, expect } from '@playwright/test'
import { OMAR, PASSWORD } from '../support/api'

/**
 * UI flows for the reported bugs, driven through the real SPA on :5173:
 *   - login + the multi-gym challenge
 *   - the "Assign Shifts" toolbar button now renders for a Branch Manager even
 *     on a Published cycle (disabled with an explanatory tooltip) instead of
 *     vanishing, and "New Template" is reachable
 *   - the template modal posts the <input type="time"> HH:mm payload and
 *     succeeds instead of a validation error
 *   - switching gyms remounts the portal with no "Employee not found" toast
 */

async function login(page: import('@playwright/test').Page, email: string, gymName?: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  if (gymName) {
    await expect(page.getByRole('heading', { name: 'Choose your gym' })).toBeVisible()
    await page.getByRole('button', { name: gymName }).click()
  }
}

test.describe('login + navigation', () => {
  test('a single-gym employee logs in and reaches the portal dashboard', async ({ page }) => {
    await login(page, 'karim@revive.hr')
    await expect(page).toHaveURL(/\/employee\/dashboard/, { timeout: 15_000 })
  })

  test('a multi-gym manager is challenged, then lands in the chosen gym', async ({ page }) => {
    await login(page, OMAR, 'Revive Main Gym')
    await expect(page).toHaveURL(/\/employee\/dashboard/, { timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Revive Main Gym' })).toBeVisible()
  })
})

test.describe('schedule page — reported bug regressions', () => {
  test('Branch Manager sees Assign Shifts + New Template on a Published cycle', async ({ page }) => {
    await login(page, OMAR, 'Revive Main Gym')
    await page.goto('/employee/team/schedule')
    await expect(page.getByRole('heading', { name: 'Branch Schedule' })).toBeVisible({ timeout: 15_000 })

    // The button must EXIST for a manager regardless of draft/publish state.
    const assign = page.getByRole('button', { name: /Assign Shifts/ })
    await expect(assign).toBeVisible()
    // gym1's current cycle is Published -> disabled but present, with the reason.
    await expect(assign).toBeDisabled()
    await expect(assign).toHaveAttribute('title', /read-only/)

    // "New Template" is reachable (the template manager opens).
    await page.getByRole('button', { name: 'New Template' }).click()
    await expect(page.getByText('Create new template')).toBeVisible()
  })

  test('creating a template from the time inputs succeeds (no validation error)', async ({ page }) => {
    await login(page, OMAR, 'Revive Main Gym')
    await page.goto('/employee/team/schedule')
    await expect(page.getByRole('heading', { name: 'Branch Schedule' })).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'New Template' }).click()

    const stamp = Date.now()
    await page.getByLabel('Template Name').fill(`PW UI ${stamp}`)
    // <input type="time"> posts HH:mm — the payload that used to 400.
    await page.getByLabel('Start Time').fill('08:00')
    await page.getByLabel('End Time').fill('16:00')
    await page.getByRole('button', { name: 'Create Template' }).click()

    // Success toast, not a validation error.
    await expect(page.getByText(/created/)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/validation/i)).toHaveCount(0)
  })
})

test.describe('gym switching', () => {
  test('switching gyms remounts the portal without an error toast', async ({ page }) => {
    await login(page, OMAR, 'Revive Main Gym')
    await expect(page).toHaveURL(/\/employee\/dashboard/, { timeout: 15_000 })

    await page.getByRole('button', { name: 'Switch gym' }).click()
    await page.getByRole('button', { name: 'Revive Second Gym' }).click()

    await expect(page).toHaveURL(/\/employee\/dashboard/, { timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Revive Second Gym' })).toBeVisible()
    // The reported symptom must not appear.
    await expect(page.getByText(/Employee not found/)).toHaveCount(0)
    await expect(page.getByText(/no employee profile/)).toHaveCount(0)
  })
})
