import { expect, test, type Page } from '@playwright/test'
import { createMockSale } from '../integration/helpers'

async function signUpAndAccept(page: Page) {
  await page.getByLabel('Email').fill(`e2e-${crypto.randomUUID()}@test.local`)
  await page.getByLabel('Contraseña').fill('secret-123456')
  await page.getByRole('button', { name: 'Entrar con email' }).click()
  await page.getByRole('checkbox', { name: /reglas del programa/i }).check()
  await page.getByRole('button', { name: 'Empezar a sumar' }).click()
}

const OUTCOME = /¡Ganaste \d+ puntos!|Esta vez no hubo premio/

test('raspadita y ruleta: el servidor decide, se juega una vez y se explican las probabilidades', async ({
  page,
}) => {
  const sale = await createMockSale({ total_cents: 3000 })
  await page.goto(`/s/${sale}`)
  await signUpAndAccept(page)

  // Raspadita ganada con la compra: se raspa con el dedo (arrastre sobre el canvas).
  await expect(page.getByText('¡Sumaste 300 puntos!')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('link', { name: '¡Raspá tu premio!' }).click()
  const canvas = page.getByTestId('scratch-canvas')
  await expect(canvas).toBeVisible()
  // Un dedo que recorre la capa de lado a lado (eventos de puntero, como los emite un celular).
  await canvas.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const fire = (type: string, x: number, y: number) =>
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: 1,
          pointerType: 'touch',
          clientX: x,
          clientY: y,
        }),
      )
    fire('pointerdown', rect.left + 5, rect.top + 5)
    for (let row = 0; row <= 12; row++) {
      const y = rect.top + 5 + (row * (rect.height - 10)) / 12
      for (let step = 0; step <= 10; step++)
        fire('pointermove', rect.left + 5 + (step * (rect.width - 10)) / 10, y)
    }
    fire('pointerup', rect.right - 5, rect.bottom - 5)
  })
  await expect(page.getByText(OUTCOME)).toBeVisible({ timeout: 10_000 })

  // "¿Cómo funciona?" muestra las probabilidades reales.
  await page.getByRole('button', { name: '¿Cómo funciona?' }).click()
  const rules = page.getByRole('dialog', { name: '¿Cómo funciona?' })
  await expect(rules.getByText('60 %')).toBeVisible()
  await rules.getByRole('button', { name: 'Cerrar' }).click()

  // Ruleta diaria: un giro por día.
  await page.getByRole('link', { name: 'Ir a mi panel' }).click()
  await page.getByRole('link', { name: /Ruleta diaria/ }).click()
  await page.getByRole('button', { name: 'Girar' }).click()
  await expect(page.getByText(OUTCOME)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Girar' })).toHaveCount(0)

  await page.goto('/ruleta')
  await expect(page.getByText('Hoy ya giraste. Mañana hay otro giro.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Girar' })).toBeDisabled()
})
