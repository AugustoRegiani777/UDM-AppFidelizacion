import { expect, test } from '@playwright/test'
import { openAdminSession } from './support/session'

test('el administrador ve cuánto cuestan los premios sobre las ventas', async ({ browser }) => {
  const { page, context } = await openAdminSession(browser)
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Economía de puntos' })).toBeVisible()
  await expect(page.getByTestId('economy-cost')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/partidas oficiales/)).toBeVisible()
  await context.close()
})
