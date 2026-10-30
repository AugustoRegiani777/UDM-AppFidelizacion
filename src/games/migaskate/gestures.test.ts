import { GestureRecognizer, zoneOf, type Gesture } from './gestures.ts'

/** Dibuja un trazo de un dedo: de (u0, v0) a (u1, v1) en `ms` milisegundos. */
function swipe(
  rec: GestureRecognizer,
  from: [number, number],
  to: [number, number],
  ms = 140,
  id = 1,
): Gesture[] {
  const steps = 6
  rec.down(id, from[0], from[1], 0)
  for (let i = 1; i <= steps; i++) {
    const k = i / steps
    rec.move(id, from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, ms * k)
  }
  rec.up(id, to[0], to[1], ms)
  return rec.update(ms + 1)
}

describe('zonas de la tabla', () => {
  it('distingue cola, nariz, centro y costado', () => {
    expect(zoneOf(0, -0.6)).toBe('tail')
    expect(zoneOf(0.1, 0.6)).toBe('nose')
    expect(zoneOf(0, 0)).toBe('middle')
    expect(zoneOf(0.6, 0)).toBe('side')
    expect(zoneOf(-0.5, -0.7)).toBe('side')
  })
})

describe('gestos de salto', () => {
  it('cola + deslizar hacia arriba es un ollie, y mas rapido da mas potencia', () => {
    const slow = swipe(new GestureRecognizer(), [0, -0.6], [0, 0.1], 500)
    const fast = swipe(new GestureRecognizer(), [0, -0.6], [0, 0.4], 90)
    expect(slow[0]).toMatchObject({ k: 'ollie', nollie: false })
    expect(fast[0]).toMatchObject({ k: 'ollie', nollie: false })
    if (slow[0]?.k !== 'ollie' || fast[0]?.k !== 'ollie') throw new Error('se esperaba un ollie')
    expect(fast[0].power).toBeGreaterThan(slow[0].power)
    expect(fast[0].power).toBeLessThanOrEqual(1)
  })

  it('cola + diagonal es un pop shove-it hacia el lado del latigazo', () => {
    const right = swipe(new GestureRecognizer(), [0, -0.6], [0.5, 0.1])
    const left = swipe(new GestureRecognizer(), [0, -0.6], [-0.5, 0.1])
    expect(right[0]).toMatchObject({ k: 'popShuvit', dir: 1 })
    expect(left[0]).toMatchObject({ k: 'popShuvit', dir: -1 })
  })

  it('nariz + deslizar hacia abajo es un nollie', () => {
    const out = swipe(new GestureRecognizer(), [0, 0.6], [0, -0.1])
    expect(out[0]).toMatchObject({ k: 'ollie', nollie: true })
  })

  it('un toque corto no hace nada', () => {
    const out = swipe(new GestureRecognizer(), [0, -0.6], [0, -0.55], 60)
    expect(out).toEqual([])
  })

  it('el costado de la tabla + diagonal es un flip: izquierda kickflip, derecha heelflip', () => {
    const kick = swipe(new GestureRecognizer(), [0.55, 0], [0.2, 0.6])
    const heel = swipe(new GestureRecognizer(), [-0.55, 0], [-0.1, 0.6])
    expect(kick[0]).toMatchObject({ k: 'flip', dir: 1 })
    expect(heel[0]).toMatchObject({ k: 'flip', dir: -1 })
  })

  it('el costado + latigazo de lado es un shove-it', () => {
    const out = swipe(new GestureRecognizer(), [0.5, 0], [-0.3, 0.02])
    expect(out[0]).toMatchObject({ k: 'shuvit', dir: -1 })
  })
})

describe('gestos en el centro', () => {
  it('deslizar hacia abajo en el suelo es empujar', () => {
    const out = swipe(new GestureRecognizer(() => ({ airborne: false })), [0, 0.1], [0, -0.5])
    expect(out[0]).toMatchObject({ k: 'push' })
  })

  it('un latigazo de lado en el aire gira el cuerpo', () => {
    const out = swipe(new GestureRecognizer(() => ({ airborne: true })), [-0.1, 0], [0.6, 0])
    expect(out[0]).toMatchObject({ k: 'spin', dir: 1 })
  })

  it('arrastrar de lado en el suelo dobla y sigue valiendo (no se corta)', () => {
    const rec = new GestureRecognizer(() => ({ airborne: false }))
    rec.down(1, 0, 0, 0)
    rec.move(1, 0.3, 0, 100)
    expect(rec.steer).toBeGreaterThan(0.5)
    rec.move(1, 1.2, 0, 200)
    expect(rec.steer).toBe(1)
    rec.move(1, -0.5, 0, 300)
    expect(rec.steer).toBeLessThan(0)
    rec.up(1, -0.5, 0, 400)
    expect(rec.steer).toBe(0)
  })
})

describe('mantener apretado', () => {
  it('en el aire, mantener el dedo quieto agarra la tabla y soltarlo la suelta', () => {
    const rec = new GestureRecognizer(() => ({ airborne: true }))
    rec.down(1, -0.1, 0, 0)
    expect(rec.update(50)).toEqual([])
    expect(rec.update(200)).toEqual([{ k: 'grab', name: 'indy' }])
    rec.up(1, -0.1, 0, 400)
    expect(rec.update(410)).toEqual([{ k: 'grabEnd' }])
  })

  it('el agarre depende de donde se apoya: nariz, cola o mano derecha', () => {
    const nose = new GestureRecognizer(() => ({ airborne: true }))
    nose.down(1, 0, 0.6, 0)
    expect(nose.update(200)).toEqual([{ k: 'grab', name: 'nose' }])
    const melon = new GestureRecognizer(() => ({ airborne: true }))
    melon.down(1, 0.1, 0, 0)
    expect(melon.update(200)).toEqual([{ k: 'grab', name: 'melon' }])
  })

  it('en el suelo, mantener la cola es un manual y el dedo vertical es el equilibrio', () => {
    const rec = new GestureRecognizer(() => ({ airborne: false }))
    rec.down(1, 0, -0.6, 0)
    expect(rec.update(100)).toEqual([])
    expect(rec.update(300)).toEqual([{ k: 'manual', nose: false }])
    // El dedo se desliza un poco hacia arriba: equilibrio positivo.
    rec.move(1, 0, -0.5, 400)
    expect(rec.balance).toBeGreaterThan(0)
    rec.up(1, 0, -0.5, 500)
    expect(rec.update(510)).toEqual([{ k: 'manualEnd' }])
    expect(rec.balance).toBe(0)
  })
})

describe('varios dedos', () => {
  it('un dedo dobla mientras el otro hace el ollie', () => {
    const rec = new GestureRecognizer(() => ({ airborne: false }))
    rec.down(1, 0, 0, 0)
    rec.move(1, 0.4, 0, 50)
    const out = swipe(rec, [0, -0.6], [0, 0.3], 100, 2)
    expect(out[0]).toMatchObject({ k: 'ollie' })
    expect(rec.steer).toBeGreaterThan(0)
  })
})

describe('apoyar y despues deslizar', () => {
  it('apoyar un rato el dedo en la cola y recien despues tirar hacia arriba sigue siendo un ollie', () => {
    const rec = new GestureRecognizer(() => ({ airborne: false }))
    rec.down(1, 0, -0.6, 0)
    // Se apoya 1,5 s (arranca el manual) y despues se desliza rapido.
    expect(rec.update(300)).toEqual([{ k: 'manual', nose: false }])
    rec.update(1500)
    rec.move(1, 0, -0.4, 1520)
    rec.move(1, 0, 0.1, 1560)
    rec.move(1, 0, 0.3, 1600)
    rec.up(1, 0, 0.3, 1620)
    const out = rec.update(1630)
    expect(out.some((g) => g.k === 'ollie')).toBe(true)
  })
})
