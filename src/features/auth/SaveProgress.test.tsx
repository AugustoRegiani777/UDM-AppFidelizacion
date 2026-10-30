import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AuthContext } from './authContext'
import { LinkConflictNotice } from './LinkConflictNotice'
import { SaveProgress, SaveProgressHint } from './SaveProgress'

const linkGoogleToGuest = vi.fn().mockResolvedValue(undefined)
const signInWithGoogle = vi.fn().mockResolvedValue(undefined)
const redirectError = { current: null as { code: string; description: string } | null }

vi.mock('./signIn', () => ({
  linkGoogleToGuest: (...args: unknown[]) => linkGoogleToGuest(...args),
  signInWithGoogle: (...args: unknown[]) => signInWithGoogle(...args),
}))
vi.mock('./linkErrors', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./linkErrors')>()),
  readAuthRedirectError: () => redirectError.current,
  clearAuthRedirectError: () => {
    redirectError.current = null
  },
}))

function withSession(isAnonymous: boolean, ui: React.ReactNode) {
  const session = { user: { id: 'u1', is_anonymous: isAnonymous } } as never
  return render(
    <MemoryRouter>
      <AuthContext value={{ session, loading: false }}>{ui}</AuthContext>
    </MemoryRouter>,
  )
}

describe('guardar el progreso del invitado', { timeout: 30_000 }, () => {
  beforeEach(() => {
    linkGoogleToGuest.mockClear()
    signInWithGoogle.mockClear()
    redirectError.current = null
  })

  it('un invitado ve el botón y vincula su cuenta a Google', async () => {
    withSession(true, <SaveProgress />)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar mi progreso con Google' }))
    expect(linkGoogleToGuest).toHaveBeenCalledWith('/perfil')
  })

  it('quien ya entró con Google no ve nada', () => {
    withSession(
      false,
      <>
        <SaveProgress />
        <SaveProgressHint />
      </>,
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('si Google no responde, avisa con amabilidad y deja reintentar', async () => {
    linkGoogleToGuest.mockRejectedValueOnce(new Error('provider_disabled'))
    withSession(true, <SaveProgress />)
    await userEvent.click(screen.getByRole('button', { name: 'Guardar mi progreso con Google' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/tu progreso sigue acá/i)
    expect(screen.getByRole('button', { name: 'Guardar mi progreso con Google' })).toBeEnabled()
  })

  it('el panel le recuerda a un invitado que guarde su progreso', () => {
    withSession(true, <SaveProgressHint />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/perfil')
  })
})

describe('Google que ya tenía cuenta', { timeout: 30_000 }, () => {
  beforeEach(() => {
    signInWithGoogle.mockClear()
  })

  it('explica que no se mezcla ni se borra nada y ofrece entrar con esa cuenta', async () => {
    redirectError.current = { code: 'identity_already_exists', description: '' }
    withSession(true, <LinkConflictNotice />)
    expect(await screen.findByText(/no podemos mezclar/i)).toBeInTheDocument()
    expect(screen.getByText(/No se borró nada/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar con esa cuenta de Google' }))
    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledWith('/panel'))
  })

  it('permite seguir como invitado', async () => {
    redirectError.current = { code: 'identity_already_exists', description: '' }
    withSession(true, <LinkConflictNotice />)
    await userEvent.click(await screen.findByRole('button', { name: 'Seguir como invitado' }))
    await waitFor(() => expect(screen.queryByText(/no podemos mezclar/i)).toBeNull())
    expect(signInWithGoogle).not.toHaveBeenCalled()
  })

  it('otro error (por ejemplo, cancelar Google) avisa que no se perdió nada', async () => {
    redirectError.current = { code: 'access_denied', description: 'cancelled' }
    withSession(true, <LinkConflictNotice />)
    expect(await screen.findByText(/No se perdió nada/i)).toBeInTheDocument()
  })

  it('si la persona no es invitada, no muestra nada', () => {
    redirectError.current = { code: 'access_denied', description: '' }
    withSession(false, <LinkConflictNotice />)
    expect(screen.queryByText(/No se perdió nada/i)).toBeNull()
  })
})
