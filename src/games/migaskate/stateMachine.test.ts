import { SKATE_STATES, SkateStateMachine, TRANSITIONS, type SkateState } from './stateMachine.ts'

const ALLOWED: [SkateState, SkateState][] = [
  ['grounded', 'popping'],
  ['grounded', 'airborne'],
  ['grounded', 'bailed'],
  ['popping', 'airborne'],
  ['airborne', 'grounded'],
  ['airborne', 'popping'],
  ['airborne', 'grinding'],
  ['airborne', 'bailed'],
  ['grinding', 'airborne'],
  ['grinding', 'popping'],
  ['grinding', 'bailed'],
  ['bailed', 'grounded'],
]

describe('maquina de estados de la tabla', () => {
  it('tiene los cuatro estados de la especificacion mas la recuperacion', () => {
    expect([...SKATE_STATES]).toEqual(['grounded', 'popping', 'airborne', 'grinding', 'bailed'])
  })

  it('acepta todas las transiciones documentadas', () => {
    for (const [from, to] of ALLOWED) {
      const m = new SkateStateMachine()
      m.reset(from)
      expect(m.canTransition(to)).toBe(true)
      expect(m.transition(to)).toBe(true)
      expect(m.state).toBe(to)
    }
  })

  it('rechaza todas las demas (y no cambia de estado)', () => {
    for (const from of SKATE_STATES) {
      for (const to of SKATE_STATES) {
        if (ALLOWED.some(([a, b]) => a === from && b === to)) continue
        const m = new SkateStateMachine()
        m.reset(from)
        expect(m.transition(to)).toBe(false)
        expect(m.state).toBe(from)
      }
    }
  })

  it('las prohibidas que importan: no se pasa del riel al suelo ni del pop al suelo de golpe', () => {
    expect(TRANSITIONS.grinding).not.toContain('grounded')
    expect(TRANSITIONS.popping).not.toContain('grounded')
    expect(TRANSITIONS.grounded).not.toContain('grinding')
    expect(TRANSITIONS.bailed).toEqual(['grounded'])
  })

  it('avisa los cambios, cuenta el tiempo en el estado y se puede desuscribir', () => {
    const m = new SkateStateMachine()
    const seen: string[] = []
    const off = m.onChange((from, to) => seen.push(`${from}>${to}`))
    m.tick(0.5)
    expect(m.elapsed).toBeCloseTo(0.5)
    m.transition('popping')
    expect(m.elapsed).toBe(0)
    m.transition('airborne')
    off()
    m.transition('grounded')
    expect(seen).toEqual(['grounded>popping', 'popping>airborne'])
  })
})
