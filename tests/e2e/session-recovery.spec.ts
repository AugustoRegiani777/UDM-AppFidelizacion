import { expect, test } from '@playwright/test'
import { admin } from '../integration/helpers'
import { signUp } from './support/session'

test('si la cuenta se borra con la sesión abierta, la app vuelve a la entrada y no se rompe', async ({
  page,
}) => {
  const email = await signUp(page)

  // Se borra el usuario por detrás (como una limpieza de invitados o una base reiniciada).
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 })
  const user = data.users.find((u) => u.email === email)
  await admin.auth.admin.deleteUser(user!.id)

  await page.reload()

  // Nada de pantallas de error técnico: se vuelve a la entrada para ingresar de nuevo.
  await expect(page.getByText(/unexpected application error/i)).toHaveCount(0)
  await expect(page.getByRole('heading', { name: copyHome })).toBeVisible({ timeout: 15_000 })
})

const copyHome = 'Entrá en un toque'
