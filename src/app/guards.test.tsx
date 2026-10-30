import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { RequireOnboarded } from './guards'

let profileData: Record<string, unknown>
let requiredVersion: { isPending: boolean; data?: string }

vi.mock('@/features/profile/useProfile', () => ({
  useProfile: () => ({ isPending: false, isError: false, data: profileData }),
}))
vi.mock('@/features/profile/legalConsent', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/profile/legalConsent')>()),
  useRequiredLegalVersion: () => requiredVersion,
}))
vi.mock('@/features/auth/useAuth', () => ({ useAuth: () => ({ session: {}, loading: false }) }))

const accepted = {
  display_name: 'Ana',
  program_consent_at: '2026-11-01T10:00:00Z',
  adult_confirmed_at: '2026-11-01T10:00:00Z',
  privacy_accepted_at: '2026-11-01T10:00:00Z',
  terms_accepted_at: '2026-11-01T10:00:00Z',
  legal_version: '2026-11-01',
}

function renderGuard() {
  render(
    <MemoryRouter initialEntries={['/panel']}>
      <Routes>
        <Route path="/bienvenida" element={<p>BIENVENIDA</p>} />
        <Route element={<RequireOnboarded />}>
          <Route path="/panel" element={<p>PANEL</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

describe('RequireOnboarded con versión legal', () => {
  beforeEach(() => {
    profileData = { ...accepted }
    requiredVersion = { isPending: false, data: '2026-11-01' }
  })

  it('deja pasar a quien aceptó la versión vigente', () => {
    renderGuard()
    expect(screen.getByText('PANEL')).toBeInTheDocument()
  })

  it('lleva a la bienvenida si la versión vigente es más nueva que la aceptada', () => {
    requiredVersion = { isPending: false, data: '2026-12-01' }
    renderGuard()
    expect(screen.getByText('BIENVENIDA')).toBeInTheDocument()
  })

  it('deja pasar si la aceptada es igual o más nueva', () => {
    profileData = { ...accepted, legal_version: '2027-01-01' }
    renderGuard()
    expect(screen.getByText('PANEL')).toBeInTheDocument()
  })

  it('lleva a la bienvenida a quien aceptó las reglas antes de las casillas nuevas', () => {
    profileData = {
      ...accepted,
      adult_confirmed_at: null,
      privacy_accepted_at: null,
      terms_accepted_at: null,
      legal_version: null,
    }
    renderGuard()
    expect(screen.getByText('BIENVENIDA')).toBeInTheDocument()
  })

  it('lleva a la bienvenida a quien nunca aceptó nada', () => {
    profileData = { display_name: 'Ana', program_consent_at: null }
    renderGuard()
    expect(screen.getByText('BIENVENIDA')).toBeInTheDocument()
  })

  it('espera a conocer la versión vigente antes de decidir', () => {
    requiredVersion = { isPending: true }
    renderGuard()
    expect(screen.queryByText('PANEL')).not.toBeInTheDocument()
    expect(screen.queryByText('BIENVENIDA')).not.toBeInTheDocument()
  })
})
