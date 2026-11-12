import { Tutorial, tutorialSeen, TUTORIAL_STEPS } from './tutorial.ts'

describe('tutorial interactivo', () => {
  beforeEach(() => window.localStorage.clear())

  it('avanza con los eventos de la fisica, en orden, y se recuerda al terminar', () => {
    const t = new Tutorial(false)
    expect(t.step).toBe('ollie')
    expect(t.onEvent({ t: 'flip' })).toBe(false) // fuera de orden no cuenta
    expect(t.onEvent({ t: 'pop' })).toBe(true)
    expect(t.step).toBe('flip')
    expect(t.onEvent({ t: 'flip' })).toBe(true)
    expect(t.step).toBe('catch')
    expect(t.progress).toEqual({ index: 2, total: TUTORIAL_STEPS.length })
    expect(tutorialSeen()).toBe(false)
    expect(t.onEvent({ t: 'catch' })).toBe(true)
    expect(t.step).toBeNull()
    expect(t.finished).toBe(true)
    expect(tutorialSeen()).toBe(true)
  })

  it('se puede saltear y no se vuelve a mostrar', () => {
    const t = new Tutorial(false)
    t.skip()
    expect(t.step).toBeNull()
    expect(tutorialSeen()).toBe(true)
    expect(new Tutorial(tutorialSeen()).step).toBeNull()
  })
})
