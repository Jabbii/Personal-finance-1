import { test, expect } from '@playwright/test'

test('design preview page renders every token with no console errors', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('pageerror', (err) => consoleErrors.push(err.message))

  await page.goto('/design/preview')

  await expect(page.getByRole('heading', { name: 'Design tokens', level: 1 })).toBeVisible()
  await expect(page.getByText('accent #4B4EDE')).toBeVisible()
  await expect(page.getByRole('button', { name: /switch to dark/i })).toBeVisible()

  expect(consoleErrors).toEqual([])
})

test('theme toggle flips to dark mode', async ({ page }) => {
  await page.goto('/design/preview')

  const toggle = page.getByRole('button', { name: /switch to dark/i })
  await toggle.click()

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.getByRole('button', { name: /switch to light/i })).toBeVisible()
})

test('home page links to the design preview', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Personal Finance' })).toBeVisible()
  await page.getByRole('link', { name: '/design/preview' }).click()
  await expect(page).toHaveURL(/\/design\/preview$/)
})
