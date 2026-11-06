import { test, expect } from '@playwright/test'
import { OMAR, PASSWORD } from '../support/api'

/**
 * Final confirmation run for the reported bugs. Drives the real SPA on :5173:
 * login picking Second Gym, switch to Main, reload. The header must follow the
 * chosen gym at every step.
 */

async function login(page: import('@playwright/test').Page, email: string, gymName?: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.locator('#password').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  if (gymName) {
    await expect(page.getByRole('heading', { name: 'Choose your gym' })).toBeVisible()
    await page.getByRole('button', { name: gymName }).click()
  }
}

test('login -> pick Second Gym -> switch -> reload keeps the gym', async ({ page }) => {
  await login(page, OMAR, 'Revive Second Gym')
  await expect(page).toHaveURL(/\/employee\/dashboard/, { timeout: 15_000 })

  const switcher = page.getByRole('button', { name: 'Switch gym' })
  await expect(switcher).toBeVisible()
  const afterLogin = (await switcher.textContent())?.trim() ?? '?'
  console.log('AFTER LOGIN (picked Second Gym) header shows:', afterLogin)

  await switcher.click()
  await page.getByRole('button', { name: 'Revive Main Gym' }).click()
  await expect(page).toHaveURL(/\/employee\/dashboard/, { timeout: 15_000 })
  await page.waitForTimeout(2000)
  const afterSwitch = (await switcher.textContent())?.trim() ?? '?'
  console.log('AFTER SWITCH to Main Gym header shows:', afterSwitch)

  await page.reload()
  await expect(page).toHaveURL(/\/employee\/dashboard/, { timeout: 15_000 })
  await page.waitForTimeout(2000)
  const afterReload = (await switcher.textContent())?.trim() ?? '?'
  console.log('AFTER RELOAD header shows:', afterReload)

  await expect(switcher).toContainText('Revive Main Gym')
})
