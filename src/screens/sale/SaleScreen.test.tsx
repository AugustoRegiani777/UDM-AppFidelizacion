import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { ClaimResult } from '@/features/claims/claimApi'
import { SaleScreen } from './SaleScreen'

let queryState: { isPending: boolean; isError: boolean; data?: ClaimResult; refetch: () => void }

vi.mock('@/motion/feedback', () => ({
  fireConfetti: vi.fn(),
  vibrate: vi.fn(),
  playChime: vi.fn(),
}))
vi.mock('@/features/games/gameApi', () => ({
  useGamesStatus: () => ({ isSuccess: true, isFetching: false, data: { scratch_claim_id: 'c1' } }),
}))
vi.mock('@/features/claims/useClaimSale', () => ({ useClaimSale: () => queryState }))

function renderSale(data: ClaimResult, code = '123e4567-e89b-12d3-a456-426614174000') {
  queryState = { isPending: false, isError: false, data, refetch: vi.fn() }
  render(
    <MemoryRouter initialEntries={[`/s/${code}`]}>
      <Routes>
        <Route path="/s/:uuid" element={<SaleScreen />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SaleScreen', () => {
  it('celebra la compra sumada con el premio desbloqueado', () => {
    renderSale({
      status: 'confirmed',
      points: 162,
      balance: 162,
      repeat: false,
      claim_id: 'c1',
      unlocked: [{ id: '1', name: 'Un café', kind: 'points' }],
    })
    expect(screen.getByText('¡Sumaste 162 puntos!')).toBeInTheDocument()
    expect(screen.getByText(/un café va por la casa/i)).toBeInTheDocument()
  })

  it('un código que no es un uuid explica que no es válido', () => {
    renderSale({ status: 'pending', points: 0 }, 'basura')
    expect(screen.getByText('Ese código de compra no es válido')).toBeInTheDocument()
  })

  it('avisa sin alarmar cuando la compra queda pendiente', () => {
    renderSale({ status: 'pending', points: 0 })
    expect(screen.getByText('Tu compra todavía no llegó')).toBeInTheDocument()
    expect(screen.getByText(/te la sumamos apenas aparezca/i)).toBeInTheDocument()
  })

  it.each([
    ['voided', /anulada/i],
    ['excluded_channel', /glovo y too good to go/i],
    ['too_old', /pasó el tiempo/i],
    ['already_claimed', /otra cuenta/i],
  ])('explica amablemente el rechazo %s', (reason, text) => {
    renderSale({ status: 'rejected', reason, points: 0 })
    expect(screen.getByText(text)).toBeInTheDocument()
  })

  it('no vuelve a celebrar una compra ya sumada', () => {
    renderSale({ status: 'confirmed', points: 62, balance: 62, repeat: true, claim_id: 'c1' })
    expect(screen.getByText('Esta compra ya estaba sumada')).toBeInTheDocument()
  })

  it('ofrece reintentar si falla la conexión', () => {
    queryState = { isPending: false, isError: true, refetch: vi.fn() }
    render(
      <MemoryRouter initialEntries={['/s/123e4567-e89b-12d3-a456-426614174000']}>
        <Routes>
          <Route path="/s/:uuid" element={<SaleScreen />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.getByRole('button', { name: /probar de nuevo/i })).toBeInTheDocument()
  })
})
