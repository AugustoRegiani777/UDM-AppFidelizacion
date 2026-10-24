import { expect, test } from '@playwright/test'
import { signUp } from './support/session'

test('sala de juegos: se elige el juego, los niveles arrancan bloqueados y se puede salir', async ({
  page,
}) => {
  await signUp(page)
  await page.getByRole('link', { name: /Sala de juegos/ }).click()
  await expect(page.getByRole('heading', { name: 'Sala de juegos' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Skate de Miga/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Miga Racers/ })).toBeVisible()

  // Sobreviví a las migas: solo el nivel 1 está abierto.
  await page.getByRole('button', { name: /Sobreviví a las migas/ }).click()
  await expect(page.getByText('Ganá el nivel anterior para abrirlo')).toHaveCount(5)
  await page.getByRole('button', { name: /Nivel 1/ }).click()
  const ready = page.getByRole('dialog', { name: 'Sobreviví a las migas' })
  await expect(ready.getByText('Nivel 1 · La cocina')).toBeVisible()
  await ready.getByRole('button', { name: 'Salir' }).click()
  await page.getByRole('button', { name: 'Volver a los juegos' }).click()
  await expect(page.getByRole('button', { name: /Miga Racers/ })).toBeVisible()
})

test('Miga Racers: cuenta regresiva, la carrera arranca y se puede pausar', async ({ page }) => {
  await signUp(page)
  await page.goto('/juegos')
  await page.getByRole('button', { name: /Miga Racers/ }).click()
  await expect(page.getByText('Terminá 1º o 2º en la pista anterior para abrirla')).toHaveCount(2)
  await page.getByRole('button', { name: /Pista 1/ }).click()

  const ready = page.getByRole('dialog', { name: 'Miga Racers' })
  await expect(ready.getByText('La mesa de la cocina')).toBeVisible()
  await ready.getByRole('button', { name: '¡A correr!' }).click()

  // 3, 2, 1 y ¡YA!
  await expect(page.getByText('¡YA!')).toBeVisible({ timeout: 8000 })
  await expect(page.getByText(/Vuelta 1\/3/)).toBeVisible()

  await page.getByRole('button', { name: 'Pausar' }).click()
  const pause = page.getByRole('dialog', { name: 'Pausa' })
  await expect(pause).toBeVisible()
  await pause.getByRole('button', { name: 'Salir' }).click()
  await expect(page.getByRole('heading', { name: 'Miga Racers' })).toBeVisible()
})
