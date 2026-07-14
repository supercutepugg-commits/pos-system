import { expect, test } from '@playwright/test'

test('shows the login form', async ({ page }) => {
  await page.goto('/login')

  const heading = page.getByRole('heading', { level: 1 })
  await expect(heading).toBeVisible()
  await expect(heading).toHaveText('POS \uC804\uC0B0 \uC2DC\uC2A4\uD15C')
  await expect(page.locator('input[type="text"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  await expect(page.getByRole('button')).toBeVisible()
})
