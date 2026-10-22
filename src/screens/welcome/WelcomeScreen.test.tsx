import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { WelcomeScreen } from './WelcomeScreen'

const completeOnboarding = vi.fn().mockResolvedValue(undefined)

vi.mock('@/features/profile/profileApi', () => ({
  completeOnboarding: (...args: unknown[]) => completeOnboarding(...args),
}))
vi.mock('@/features/profile/useProfile', () => ({
  useProfile: () => ({
    isPending: false,
    isError: false,
    data: { display_name: 'Lucía Pérez', program_consent_at: null },
  }),
  useInvalidateProfile: () => () => Promise.resolve(),
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

describe('WelcomeScreen', () => {
  beforeEach(() => {
    localStorage.clear()
    completeOnboarding.mockClear()
  })

  it('no deja empezar sin aceptar el programa y precarga el nombre de Google', async () => {
    renderWelcome()
    expect(screen.getByLabelText(/cómo te llamamos/i)).toHaveValue('Lucía Pérez')
    expect(screen.getByRole('button', { name: /empezar a sumar/i })).toBeDisabled()

    await userEvent.click(screen.getByRole('checkbox', { name: /reglas del programa/i }))
    expect(screen.getByRole('button', { name: /empezar a sumar/i })).toBeEnabled()
  })

  it('guarda los consentimientos por separado y va al panel', async () => {
    renderWelcome()
    await userEvent.click(screen.getByRole('checkbox', { name: /reglas del programa/i }))
    await userEvent.click(screen.getByRole('button', { name: /empezar a sumar/i }))

    await waitFor(() => expect(screen.getByText('PANEL')).toBeInTheDocument())
    expect(completeOnboarding).toHaveBeenCalledWith('Lucía Pérez', false)
  })

  it('retoma la compra pendiente después de la bienvenida', async () => {
    localStorage.setItem('pending_sale_uuid', '3f2b8c1e-5d4a-4b7e-9a10-1c2d3e4f5a6b')
    renderWelcome()
    await userEvent.click(screen.getByRole('checkbox', { name: /reglas del programa/i }))
    await userEvent.click(screen.getByRole('checkbox', { name: /novedades y promos/i }))
    await userEvent.click(screen.getByRole('button', { name: /empezar a sumar/i }))

    await waitFor(() => expect(screen.getByText('VENTA')).toBeInTheDocument())
    expect(completeOnboarding).toHaveBeenCalledWith('Lucía Pérez', true)
  })
})
