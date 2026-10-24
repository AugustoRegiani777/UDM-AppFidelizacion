import { expect, test } from '@playwright/test'
import { signUp } from './support/session'

test('sala de juegos: los niveles arrancan bloqueados y el 1 se puede jugar', async ({ page }) => {
  await signUp(page)
  await page.getByRole('link', { name: /Sala de juegos/ }).click()
  await expect(page.getByRole('heading', { name: 'Sala de juegos' })).toBeVisible()

  // Solo el nivel 1 está abierto.
  await expect(page.getByText('Ganá el nivel anterior para abrirlo')).toHaveCount(5)
  await page.getByRole('button', { name: /Nivel 1/ }).click()

  const ready = page.getByRole('dialog', { name: 'Sobreviví a las migas' })
  await expect(ready).toBeVisible()
  await expect(ready.getByText('Nivel 1 · La cocina')).toBeVisible()

  // Se puede salir sin jugar y volver al menú.
  await ready.getByRole('button', { name: 'Salir' }).click()
  await expect(page.getByRole('heading', { name: 'Sala de juegos' })).toBeVisible()
})
