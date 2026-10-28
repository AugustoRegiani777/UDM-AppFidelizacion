import { expect, test } from '@playwright/test'
import { LEVEL_DATA } from '../../src/games/sokoban/levels.data'
import { signUp } from './support/session'

const KEY: Record<string, string> = {
  U: 'ArrowUp',
  D: 'ArrowDown',
  L: 'ArrowLeft',
  R: 'ArrowRight',
}

test('Entregas de Miga: se juega el nivel 1 con el teclado, da estrellas y abre el nivel 2', async ({
  page,
}) => {
  await signUp(page)
  await page.goto('/juegos')
  await page.getByRole('button', { name: /^Entregas de Miga/ }).click()
  await expect(page.getByRole('heading', { name: 'Entregas de Miga' })).toBeVisible()
  // Solo el primer nivel está abierto.
  await expect(page.getByText('Terminá el nivel anterior para abrirlo')).toHaveCount(11)
  await page.getByRole('button', { name: /La puerta del local/ }).click()

  const intro = page.getByRole('dialog', { name: 'La puerta del local' })
  await expect(intro.getByText('Hoy manejás el auto.')).toBeVisible()
  await intro.getByRole('button', { name: '¡Vamos!' }).click()
  await expect(page.getByRole('status')).toContainText('0 mov')

  // Un paso contra una pared no cuenta; deshacer y reiniciar andan.
  const keys = LEVEL_DATA[0]!.keys
  await page.keyboard.press(KEY[keys[0]!]!)
  await expect(page.getByRole('status')).toContainText('1 mov')
  await page.getByRole('button', { name: 'Deshacer' }).click()
  await expect(page.getByRole('status')).toContainText('0 mov')

  // La solución de referencia del nivel (las mismas teclas que usaría una persona).
  for (const key of keys) await page.keyboard.press(KEY[key]!)
  const won = page.getByRole('dialog', { name: '¡Nivel completo!' })
  await expect(won).toBeVisible({ timeout: 5_000 })
  await expect(won.getByRole('img', { name: '3 de 3 estrellas' })).toBeVisible()

  // Siguiente nivel: otro lugar y otro vehículo.
  await won.getByRole('button', { name: 'Siguiente nivel' }).click()
  const second = page.getByRole('dialog', { name: 'Mercado Central' })
  await expect(second.getByText('Hoy manejás la moto.')).toBeVisible()
  await second.getByRole('button', { name: 'Salir' }).click()

  // El avance quedó guardado: el nivel 2 está abierto y el 1 muestra sus estrellas.
  await expect(page.getByText('Terminá el nivel anterior para abrirlo')).toHaveCount(10)
  await expect(page.getByRole('img', { name: '3 de 3 estrellas' })).toHaveCount(1)
})
