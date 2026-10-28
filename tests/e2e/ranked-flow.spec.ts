import { expect, test } from '@playwright/test'
import { configureRanked, QUICK_GAME } from '../integration/helpers'
import { signUp } from './support/session'

// El juego real dura un minuto más la pelea con la Reina; para el e2e se usa una partida de 2 s sin enemigos.
test.beforeAll(() => configureRanked(QUICK_GAME))
test.afterAll(() => configureRanked({}))

test('partida oficial: el servidor la chequea, da monedas y un pase, y entra al ranking', async ({
  page,
}) => {
  await signUp(page)
  await page.goto('/juegos')
  await expect(page.getByText('0 monedas')).toBeVisible()
  await expect(page.getByText('0 pases')).toBeVisible()

  await page.getByRole('button', { name: /^Sobreviví a las migas/ }).click()
  await page.getByRole('radio', { name: 'Oficial' }).click()
  await page.getByRole('button', { name: /Nivel 1/ }).click()

  const ready = page.getByRole('dialog', { name: 'Sobreviví a las migas' })
  await expect(ready.getByText('Sobreviví 2 segundos')).toBeVisible({ timeout: 15_000 })
  await ready.getByRole('button', { name: '¡Jugar!' }).click()

  // El servidor reproduce la partida y recién entonces suma monedas y el pase.
  const summary = page.getByTestId('official-summary')
  await expect(summary).toBeVisible({ timeout: 30_000 })
  await expect(summary.getByText('+15 monedas')).toBeVisible()
  await expect(summary.getByText(/pase de desafío/i)).toBeVisible()

  // Aparece en el ranking de ese juego y nivel.
  await summary.getByRole('link', { name: 'Ver el ranking' }).click()
  await expect(page.getByRole('heading', { name: 'Ranking' })).toBeVisible()
  await expect(page.getByText('· Vos')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Estás en el puesto \d+/)).toBeVisible()

  // La billetera de la sala de juegos refleja lo ganado.
  await page.getByRole('link', { name: 'Volver a los juegos' }).click()
  await expect(page.getByText('15 monedas')).toBeVisible()
  await expect(page.getByText("1 pase", { exact: false }).first()).toBeVisible()
})
