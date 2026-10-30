import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { LEGAL_VERSION } from '@/legal/company'
import { WelcomeScreen } from './WelcomeScreen'

const completeOnboarding = vi.fn().mockResolvedValue(undefined)
const acceptLegal = vi.fn().mockResolvedValue(undefined)
let profileData: Record<string, unknown>

vi.mock('@/features/profile/profileApi', () => ({
  completeOnboarding: (...args: unknown[]) => completeOnboarding(...args),
  acceptLegal: (...args: unknown[]) => acceptLegal(...args),
}))
vi.mock('@/features/profile/useProfile', () => ({
  useProfile: () => ({ isPending: false, isError: false, data: profileData }),
  useInvalidateProfile: () => () => Promise.resolve(),
}))
vi.mock('@/features/profile/legalConsent', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/profile/legalConsent')>()),
  useRequiredLegalVersion: () => ({ isPending: false, isError: false, data: LEGAL_VERSION }),
}))

function renderWelcome() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/bienvenida']}>
        <Routes>
          <Route path="/bienvenida" element={<WelcomeScreen />} />
          <Route path="/panel" element={<p>PANEL</p>} />
          <Route path="/s/:uuid" element={<p>VENTA</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const adult = () => screen.getByRole('checkbox', { name: /18 años o más/i })
const privacy = () => screen.getByRole('checkbox', { name: /política de privacidad/i })
const terms = () => screen.getByRole('checkbox', { name: /bases del programa/i })
const promo = () => screen.getByRole('checkbox', { name: /novedades y promos/i })
const submit = () => screen.getByRole('button', { name: /empezar a sumar/i })

describe('WelcomeScreen', () => {
  beforeEach(() => {
    localStorage.clear()
    completeOnboarding.mockClear()
    acceptLegal.mockClear()
    profileData = { display_name: 'Lucía Pérez', program_consent_at: null }
  })

  it('arranca con todas las casillas desmarcadas y precarga el nombre de Google', () => {
    renderWelcome()
    expect(screen.getByLabelText(/cómo te llamamos/i)).toHaveValue('Lucía Pérez')
    for (const box of [adult(), privacy(), terms(), promo()]) expect(box).not.toBeChecked()
    expect(submit()).toBeDisabled()
  })

  it('no deja avanzar sin las tres obligatorias y explica el motivo con amabilidad', async () => {
    renderWelcome()
    expect(screen.getByText(/para continuar necesitamos que marques/i)).toBeInTheDocument()
    expect(screen.getByText(/tenés 18 años o más/i)).toBeInTheDocument()
    expect(screen.getByText(/aceptás la política de privacidad/i)).toBeInTheDocument()
    expect(screen.getByText(/aceptás las bases del programa y las normas/i)).toBeInTheDocument()

    await userEvent.click(adult())
    expect(submit()).toBeDisabled()
    expect(screen.queryByText(/tenés 18 años o más/i)).not.toBeInTheDocument()
    await userEvent.click(privacy())
    expect(submit()).toBeDisabled()
    expect(screen.getByText(/aceptás las bases del programa y las normas/i)).toBeInTheDocument()
    await userEvent.click(terms())
    expect(submit()).toBeEnabled()
    expect(screen.queryByText(/para continuar necesitamos/i)).not.toBeInTheDocument()
  })

  it('cada casilla obligatoria bloquea por sí sola', async () => {
    renderWelcome()
    await userEvent.click(adult())
    await userEvent.click(terms())
    expect(submit()).toBeDisabled() // falta la privacidad
  })

  it('la casilla opcional de promos no bloquea', async () => {
    renderWelcome()
    await userEvent.click(adult())
    await userEvent.click(privacy())
    await userEvent.click(terms())
    expect(promo()).not.toBeChecked()
    expect(submit()).toBeEnabled()
  })

  it('enlaza a la política, las bases y las normas desde las casillas', () => {
    renderWelcome()
    const links = (box: HTMLElement) =>
      Array.from(box.closest('label')!.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(links(privacy())).toEqual(['/privacidad'])
    expect(links(terms())).toEqual(['/bases', '/normas'])
  })

  it('guarda los consentimientos por separado y va al panel', async () => {
    renderWelcome()
    await userEvent.click(adult())
    await userEvent.click(privacy())
    await userEvent.click(terms())
    await userEvent.click(submit())

    await waitFor(() => expect(screen.getByText('PANEL')).toBeInTheDocument())
    expect(completeOnboarding).toHaveBeenCalledWith('Lucía Pérez', false, {
      adult: true,
      privacy: true,
      terms: true,
    })
  })

  it('retoma la compra pendiente después de la bienvenida', async () => {
    localStorage.setItem('pending_sale_uuid', '3f2b8c1e-5d4a-4b7e-9a10-1c2d3e4f5a6b')
    renderWelcome()
    await userEvent.click(adult())
    await userEvent.click(privacy())
    await userEvent.click(terms())
    await userEvent.click(promo())
    await userEvent.click(submit())

    await waitFor(() => expect(screen.getByText('VENTA')).toBeInTheDocument())
    expect(completeOnboarding).toHaveBeenCalledWith('Lucía Pérez', true, {
      adult: true,
      privacy: true,
      terms: true,
    })
  })

  it('quien ya había aceptado el programa vuelve a confirmar las casillas sin tocar nombre ni promos', async () => {
    profileData = {
      display_name: 'Lucía Pérez',
      program_consent_at: '2026-10-01T10:00:00Z',
      adult_confirmed_at: null,
      privacy_accepted_at: null,
      terms_accepted_at: null,
      legal_version: null,
    }
    renderWelcome()
    expect(screen.getByText(/actualizamos nuestros textos legales/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/cómo te llamamos/i)).not.toBeInTheDocument()
    const button = screen.getByRole('button', { name: /aceptar y continuar/i })
    expect(button).toBeDisabled()
    await userEvent.click(adult())
    await userEvent.click(privacy())
    await userEvent.click(terms())
    await userEvent.click(button)

    await waitFor(() => expect(screen.getByText('PANEL')).toBeInTheDocument())
    expect(acceptLegal).toHaveBeenCalledWith({ adult: true, privacy: true, terms: true })
    expect(completeOnboarding).not.toHaveBeenCalled()
  })

  it('si ya aceptó la versión vigente, no pasa por la bienvenida', () => {
    profileData = {
      display_name: 'Lucía Pérez',
      program_consent_at: '2026-11-01T10:00:00Z',
      adult_confirmed_at: '2026-11-01T10:00:00Z',
      privacy_accepted_at: '2026-11-01T10:00:00Z',
      terms_accepted_at: '2026-11-01T10:00:00Z',
      legal_version: LEGAL_VERSION,
    }
    renderWelcome()
    expect(screen.getByText('PANEL')).toBeInTheDocument()
  })
})
