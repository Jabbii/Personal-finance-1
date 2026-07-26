import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir:             './tests/e2e',
  fullyParallel:       true,
  forbidOnly:          !!process.env.CI,
  retries:             process.env.CI ? 1 : 0,
  reporter:            'html',

  use: {
    baseURL:           'http://localhost:3000',
    trace:             'on-first-retry',
    screenshot:        'only-on-failure',
  },

  // Mobile first — test mobile before desktop
  projects: [
    {
      name:  'Mobile Chrome',
      use:   { ...devices['Pixel 5'] },      // 393×851, standard Android
    },
    {
      name:  'Mobile Safari',
      use:   { ...devices['iPhone 13'] },    // 390×844, iOS Safari
    },
    {
      name:  'Desktop Chrome',
      use:   { ...devices['Desktop Chrome'] },
    },
  ],

  // Starts Next.js dev server automatically before E2E tests
  webServer: {
    command:              'npm run dev',
    url:                  'http://localhost:3000',
    reuseExistingServer:  !process.env.CI,
    timeout:              60_000,
  },
})
