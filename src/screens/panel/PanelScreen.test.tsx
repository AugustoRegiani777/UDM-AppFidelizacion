import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { Dashboard } from '@/features/dashboard/useDashboard'
import { PanelScreen } from './PanelScreen'

let dashboardState: { isPending: boolean; isError: boolean; data?: Dashboard; refetch: () => void }

vi.mock('@/features/dashboard/useDashboard', () => ({ useDashboard: () => dashboardState }))

const reward = (over: Partial<Dashboard['rewards'][number]>): Dashboard['rewards'][number] => ({
  id: '1',
  name: 'Un café',
  description: 'Un café a elección.',
  kind: 'points',
  threshold: 150,
  image_url: null,
  current: 0,
  remaining: 150,
  unlocked: false,
  active_redemption: null,
  ...over,
})

const base: Dashboard = {
  profile: { display_name: 'Lucía', avatar_url: null, onboarded: true },
  balance: 0,
  purchase_count: 0,
  streak_weeks: 0,
  pending_count: 0,
  rewards: [reward({})],
  recent_claims: [],
}

function renderPanel(data: Dashboard) {
  dashboardState = { isPending: false, isError: false, data, refetch: vi.fn() }
  render(
    <MemoryRouter>
      <PanelScreen />
    </MemoryRouter>,
  )
}

describe('PanelScreen', () => {
  it('cliente nuevo: invita a la primera compra y muestra cuánto falta', () => {
    renderPanel(base)
    expect(screen.getByText('¡Hola, Lucía!')).toBeInTheDocument()
    expect(screen.getByText('Tu primera compra suma puntos')).toBeInTheDocument()
    expect(screen.getByText('Te faltan 150 puntos')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Escanear mi compra' })).toHaveAttribute(
      'href',
      '/escanear',
    )
  })

  it('con compras: saldo, premios con "te faltan", racha y últimas compras', () => {
    renderPanel({
      ...base,
      balance: 179,
      streak_weeks: 3,
      pending_count: 1,
      rewards: [
        reward({ current: 150, remaining: 0, unlocked: true }),
        reward({
          id: '2',
          name: 'Un sanguche de miga',
          threshold: 300,
          current: 179,
          remaining: 121,
        }),
        reward({
          id: '3',
          name: 'Media docena',
          kind: 'purchases',
          threshold: 50,
          current: 3,
          remaining: 47,
        }),
      ],
      recent_claims: [
        {
          id: 'a',
          status: 'confirmed',
          points: 62,
          sale_total_cents: 6200,
          sale_at: '2026-10-22T12:00:00Z',
          created_at: '2026-10-22T12:01:00Z',
        },
        {
          id: 'b',
          status: 'pending',
          points: 0,
          sale_total_cents: null,
          sale_at: null,
          created_at: '2026-10-22T13:00:00Z',
        },
      ],
    })
    expect(screen.queryByText('Tu primera compra suma puntos')).not.toBeInTheDocument()
    expect(screen.getByText('Desbloqueado')).toBeInTheDocument()
    expect(screen.getByText('Te faltan 121 puntos')).toBeInTheDocument()
    expect(screen.getByText('Te faltan 47 compras')).toBeInTheDocument()
    expect(screen.getByText('🔥 3 semanas seguidas')).toBeInTheDocument()
    expect(screen.getByText('1 compra esperando confirmación')).toBeInTheDocument()
    expect(screen.getByText('+62')).toBeInTheDocument()
    expect(screen.getAllByRole('progressbar')).toHaveLength(3)
  })

  it('muestra un esqueleto mientras carga', () => {
    dashboardState = { isPending: true, isError: false, refetch: vi.fn() }
    const { container } = render(
      <MemoryRouter>
        <PanelScreen />
      </MemoryRouter>,
    )
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
  })
})
