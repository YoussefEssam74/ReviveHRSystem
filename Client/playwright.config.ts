import { defineConfig, devices } from '@playwright/test'

/**
 * Two surfaces are under test:
 *   ui  - the SPA served by Vite on :5173 (proxies /api -> :5248)
 *   api - the ASP.NET Core backend on :5248, driven directly via request context
 *
 * The API is expected to be running already (`dotnet run` on 5248) because the
 * suite asserts against the live dev seed (gyms 1/2, the seeded manager logins).
 * Vite is started here via webServer so the UI project is self-contained.
 */
const API_BASE = 'http://localhost:5248'

export default defineConfig({
  testDir: './e2e',
  // The dev seed + auth rate limits are shared: run serially and reuse the one API.
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'api',
      testMatch: /e2e\/api\/.*\.spec\.ts/,
      globalSetup: './e2e/global-setup.ts',
      use: { baseURL: API_BASE, ...devices['Desktop Chrome'] },
    },
    {
      name: 'ui',
      testMatch: /e2e\/ui\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
