import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SignInOptions } from './SignInOptions'

const signInAsGuest = vi.fn().mockResolvedValue(undefined)
const signInWithGoogle = vi.fn().mockResolvedValue(undefined)
const state = { guestMode: false }

vi.mock('@/lib/env', () => ({
  env: {
    get guestMode() {
      return state.guestMode
    },
    devTools: false,
  },
}))
vi.mock('./signIn', () => ({
  signInAsGuest: () => signInAsGuest(),
  signInWithGoogle: (...args: unknown[]) => signInWithGoogle(...args),
  signInWithEmailDev: vi.fn(),
}))

describe('opciones de ingreso', () => {
  beforeEach(() => {
    signInAsGuest.mockClear()
    signInWithGoogle.mockClear()
  })

  it('normalmente ofrece solo Google', async () => {
    state.guestMode = false
    render(<SignInOptions returnPath="/panel" />)
    expect(screen.queryByRole('button', { name: 'Probar la app' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar con Google' }))
    expect(signInWithGoogle).toHaveBeenCalledWith('/panel')
  })

  it('en modo de prueba ofrece Google y también entrar como invitado, y avisa que el avance queda en el celular', async () => {
    state.guestMode = true
    render(<SignInOptions returnPath="/panel" />)
    expect(screen.getByRole('button', { name: 'Entrar con Google' })).toBeVisible()
    expect(screen.getByText(/se guardan en este celular/i)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Probar la app' }))
    await waitFor(() => expect(signInAsGuest).toHaveBeenCalledTimes(1))
    expect(signInWithGoogle).not.toHaveBeenCalled()
  })

  it('si no se puede entrar, avisa con amabilidad', async () => {
    state.guestMode = true
    signInAsGuest.mockRejectedValueOnce(new Error('anonymous_provider_disabled'))
    render(<SignInOptions returnPath="/panel" />)
    await userEvent.click(screen.getByRole('button', { name: 'Probar la app' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/no pudimos entrar/i)
  })
})
