import { fireEvent, render, screen } from '@testing-library/react'
import { HudOverlay, type HudData } from './HudOverlay'

const base: HudData = {
  hp: 4,
  maxHp: 5,
  phase: 'survive',
  secondsLeft: 42,
  totalSeconds: 60,
  queenRatio: null,
  level: 3,
  xpRatio: 0.5,
  powers: [
    { level: 0, charges: 0 },
    { level: 0, charges: 0 },
    { level: 0, charges: 0 },
  ],
}

const renderHud = (hud: Partial<HudData>, onCast = vi.fn()) => {
  render(<HudOverlay hud={{ ...base, ...hud }} banner={null} onPause={vi.fn()} onCast={onCast} />)
  return onCast
}

describe('HudOverlay de Sobreviví a las migas', () => {
  it('antes de elegir un poder no hay burbujas', () => {
    renderHud({})
    expect(screen.queryByRole('button', { name: /soltar|cargando/i })).toBeNull()
  })

  it('muestra una burbuja por cada poder elegido, con sus cargas', () => {
    renderHud({
      powers: [
        { level: 1, charges: 2 },
        { level: 0, charges: 0 },
        { level: 2, charges: 0 },
      ],
    })
    expect(screen.getByRole('button', { name: 'Soltar Soldados miga (2 listos)' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Medialuna de cebo: cargando' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /chipás/i })).toBeNull()
  })

  it('tocar una burbuja con carga suelta ese poder; una vacía no hace nada', () => {
    const onCast = renderHud({
      powers: [
        { level: 1, charges: 1 },
        { level: 1, charges: 0 },
        { level: 0, charges: 0 },
      ],
    })
    fireEvent.pointerDown(screen.getByRole('button', { name: /Soldados miga/ }))
    expect(onCast).toHaveBeenCalledExactlyOnceWith(0)
    fireEvent.pointerDown(screen.getByRole('button', { name: /Lluvia de chipás/ }))
    expect(onCast).toHaveBeenCalledTimes(1)
  })

  it('durante el minuto muestra cuánto falta para la Reina y, en la pelea, su vida', () => {
    renderHud({})
    expect(screen.getByText('Reina en')).toBeTruthy()
    expect(screen.getByRole('timer').textContent).toBe('0:42')
    expect(screen.queryByRole('img', { name: /Vida de la Reina/ })).toBeNull()
  })

  it('en la pelea con la Reina muestra su barra de vida', () => {
    renderHud({ phase: 'boss', secondsLeft: 75, totalSeconds: 90, queenRatio: 0.62 })
    expect(screen.getByText('Vencé a la Reina')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Vida de la Reina: 62 %' })).toBeTruthy()
  })
})
