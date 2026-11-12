import { BOARD_HALF_WIDTH, type Gesture } from './gestures.ts'
import type { SkateState } from './stateMachine.ts'
import {
  hitboxHalfWidth,
  HITBOX_SCALE,
  inHitbox,
  padToBoard,
  projectToBoard,
  SkateTouchController,
  zoneAt,
  zoneOfZ,
  type TouchContext,
} from './touchController.ts'

function make(state: SkateState = 'grounded', patch: Partial<TouchContext> = {}) {
  const ctx: TouchContext = { state, boardYaw: 0, cameraYaw: 0, ...patch }
  const ctl = new SkateTouchController(() => ctx)
  return { ctl, ctx }
}

/** Un trazo de un dedo: de (u0, v0) a (u1, v1) en `ms` milisegundos. */
function swipe(
  ctl: SkateTouchController,
  from: [number, number],
  to: [number, number],
  ms = 140,
  id = 1,
  t0 = 0,
): Gesture[] {
  const steps = 6
  ctl.down(id, from[0], from[1], t0)
  for (let i = 1; i <= steps; i++) {
    const k = i / steps
    ctl.move(id, from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, t0 + ms * k)
  }
  ctl.up(id, to[0], to[1], t0 + ms)
  return ctl.update(t0 + ms + 1)
}

describe('zonas de la tabla en coordenadas locales', () => {
  it('Nose (z > 0.3), Center (-0.3 <= z <= 0.3) y Tail (z < -0.3), con los bordes exactos', () => {
    expect(zoneOfZ(0.3001)).toBe('nose')
    expect(zoneOfZ(0.3)).toBe('center')
    expect(zoneOfZ(0)).toBe('center')
    expect(zoneOfZ(-0.3)).toBe('center')
    expect(zoneOfZ(-0.3001)).toBe('tail')
    expect(zoneOfZ(5)).toBe('nose')
    expect(zoneOfZ(-5)).toBe('tail')
  })

  it('los puntos del pad se pasan a la tabla (2 unidades de pad = 1 metro) y se clasifican', () => {
    expect(padToBoard(0.4, 1.2)).toEqual({ x: 0.2, z: 0.6 })
    expect(zoneAt(0, -0.7)).toBe('tail')
    expect(zoneAt(0.1, 0.7)).toBe('nose')
    expect(zoneAt(0, 0)).toBe('center')
    expect(zoneAt(0.6, 0)).toBeNull() // fuera del hitbox
  })
})

describe('TouchHitbox: 40 % mas ancho que la tabla visual', () => {
  it('el ancho del hitbox es 1.4 veces el de la tabla', () => {
    expect(HITBOX_SCALE).toBe(1.4)
    expect(hitboxHalfWidth()).toBeCloseTo(BOARD_HALF_WIDTH * 1.4, 10)
  })

  it('toma toques que caen al costado de la tabla dibujada pero dentro del 40 % extra', () => {
    const justOutsideBoard = BOARD_HALF_WIDTH * 1.3
    const justOutsideHitbox = BOARD_HALF_WIDTH * 1.5
    expect(inHitbox(BOARD_HALF_WIDTH * 0.9, 0)).toBe(true)
    expect(inHitbox(justOutsideBoard, 0)).toBe(true)
    expect(inHitbox(justOutsideHitbox, 0)).toBe(false)
    expect(inHitbox(-justOutsideBoard, -0.5)).toBe(true)
  })
})

describe('proyeccion del swipe al plano de la camara y a la tabla', () => {
  it('con la camara detras de la tabla es la identidad', () => {
    const { a, b } = projectToBoard(0.5, 0.2, 0.7, 0.7)
    expect(a).toBeCloseTo(0.5, 10)
    expect(b).toBeCloseTo(0.2, 10)
  })

  it('si la tabla giro 90 grados respecto de la camara, un swipe lateral pasa a ser a lo largo de la tabla', () => {
    // Tabla girada hacia la izquierda de la camara (yaw +90): la derecha de la pantalla apunta hacia su cola.
    const { a, b } = projectToBoard(0.5, 0, 0, Math.PI / 2)
    expect(Math.abs(a)).toBeLessThan(1e-9)
    expect(b).toBeCloseTo(-0.5, 9)
  })
})

describe('gestos de salto', () => {
  it('cola + deslizar hacia arriba es un ollie, y mas rapido da mas potencia', () => {
    const slow = swipe(make().ctl, [0, -0.7], [0, 0.1], 500)
    const fast = swipe(make().ctl, [0, -0.7], [0, 0.4], 90)
    expect(slow[0]).toMatchObject({ k: 'ollie', nollie: false })
    expect(fast[0]).toMatchObject({ k: 'ollie', nollie: false })
    if (slow[0]?.k !== 'ollie' || fast[0]?.k !== 'ollie') throw new Error('se esperaba un ollie')
    expect(fast[0].power).toBeGreaterThan(slow[0].power)
    expect(fast[0].power).toBeLessThanOrEqual(1)
  })

  it('centro + deslizar rapido hacia abajo hasta la cola tambien es un ollie', () => {
    const g = swipe(make().ctl, [0, 0.1], [0, -0.75], 120)
    expect(g[0]).toMatchObject({ k: 'ollie', nollie: false })
  })

  it('nariz + deslizar hacia abajo es un nollie (y centro hacia la nariz tambien)', () => {
    expect(swipe(make().ctl, [0, 0.7], [0, -0.1], 140)[0]).toMatchObject({
      k: 'ollie',
      nollie: true,
    })
    expect(swipe(make().ctl, [0, -0.1], [0, 0.75], 120)[0]).toMatchObject({
      k: 'ollie',
      nollie: true,
    })
  })

  it('cola + arriba y al costado es un pop shove-it hacia ese lado', () => {
    const right = swipe(make().ctl, [0, -0.7], [0.55, 0.0], 130)
    const left = swipe(make().ctl, [0, -0.7], [-0.55, 0.0], 130)
    expect(right[0]).toMatchObject({ k: 'popShuvit', dir: 1 })
    expect(left[0]).toMatchObject({ k: 'popShuvit', dir: -1 })
  })
})

describe('flips y shove-its en el aire (vector del swipe -> ejes Z e Y)', () => {
  it('diagonal hacia adelante desde el centro: izquierda = kickflip, derecha = heelflip', () => {
    const air = () => make('airborne').ctl
    expect(swipe(air(), [0, 0], [-0.5, 0.5], 110)[0]).toMatchObject({ k: 'flip', dir: 1 })
    expect(swipe(air(), [0, 0], [0.5, 0.5], 110)[0]).toMatchObject({ k: 'flip', dir: -1 })
  })

  it('de lado puro es un shove-it hacia el lado del swipe', () => {
    const air = () => make('airborne').ctl
    expect(swipe(air(), [0, 0.1], [0.6, 0.1], 110)[0]).toMatchObject({ k: 'shuvit', dir: 1 })
    expect(swipe(air(), [0, 0.1], [-0.6, 0.1], 110)[0]).toMatchObject({ k: 'shuvit', dir: -1 })
  })

  it('desde la cola, de lado, es shove-it; con avance tambien flip (360 flip)', () => {
    const air = () => make('airborne').ctl
    const side = swipe(air(), [0, -0.7], [0.6, -0.7], 110)
    expect(side.map((g) => g.k)).toEqual(['shuvit'])
    const diag = swipe(air(), [0, -0.7], [0.6, -0.1], 110)
    expect(diag.map((g) => g.k)).toEqual(['shuvit', 'flip'])
  })

  it('un dedo que apoya fuera de la tabla en el aire tambien tira flips (costado)', () => {
    const g = swipe(make('airborne').ctl, [0.8, 0], [0.3, 0.6], 110)
    expect(g[0]).toMatchObject({ k: 'flip' })
  })

  it('usa el plano de la camara: con la tabla girada 90 grados, un swipe lateral ya no es un shove-it', () => {
    const { ctl } = make('airborne', { boardYaw: Math.PI / 2, cameraYaw: 0 })
    const g = swipe(ctl, [0, 0.1], [0.6, 0.1], 110)
    expect(g.map((x) => x.k)).not.toContain('shuvit')
  })
})

describe('catch, manual y agarre (dedo mantenido)', () => {
  it('en el aire, un dedo apoyado sobre el hitbox ataja la tabla y al soltar termina', () => {
    const { ctl } = make('airborne')
    ctl.down(1, 0, 0.1, 0)
    expect(ctl.update(50)).toEqual([])
    expect(ctl.update(130)).toEqual([{ k: 'catch' }])
    expect(ctl.catching).toBe(true)
    ctl.up(1, 0, 0.1, 400)
    expect(ctl.update(401)).toEqual([{ k: 'catchEnd' }])
    expect(ctl.catching).toBe(false)
  })

  it('en el suelo, mantener la cola o la nariz es un manual', () => {
    const tail = make().ctl
    tail.down(1, 0, -0.75, 0)
    expect(tail.update(300)).toEqual([{ k: 'manual', nose: false }])
    tail.up(1, 0, -0.75, 900)
    expect(tail.update(901)).toEqual([{ k: 'manualEnd' }])
    const nose = make().ctl
    nose.down(1, 0, 0.75, 0)
    expect(nose.update(300)).toEqual([{ k: 'manual', nose: true }])
  })

  it('en el aire, mantener un dedo fuera de la tabla agarra (indy a la izquierda, melon a la derecha)', () => {
    const left = make('airborne').ctl
    left.down(1, -0.8, 0, 0)
    expect(left.update(200)).toEqual([{ k: 'grab', name: 'indy' }])
    const right = make('airborne').ctl
    right.down(1, 0.8, 0, 0)
    expect(right.update(200)).toEqual([{ k: 'grab', name: 'melon' }])
    right.up(1, 0.8, 0, 500)
    expect(right.update(501)).toEqual([{ k: 'grabEnd' }])
  })
})

describe('multi-touch', () => {
  it('un dedo en la tabla (ollie) y otro al costado que dirige: los dos valen a la vez', () => {
    const { ctl } = make()
    // Dedo 2 (dirige): apoya a la derecha y se corre de lado.
    ctl.down(2, 0.8, 0, 0)
    ctl.move(2, 1.0, 0, 30)
    ctl.move(2, 1.2, 0, 60)
    expect(ctl.steer).toBeGreaterThan(0.8)
    // Dedo 1 (tabla): un ollie, mientras el dedo 2 sigue apoyado.
    ctl.down(1, 0, -0.7, 100)
    ctl.move(1, 0, -0.2, 160)
    ctl.move(1, 0, 0.3, 200)
    ctl.up(1, 0, 0.35, 220)
    const gestures = ctl.update(221)
    expect(gestures[0]).toMatchObject({ k: 'ollie' })
    expect(ctl.steer).toBeGreaterThan(0.8) // el dedo 2 no se perdio
    ctl.up(2, 1.2, 0, 400)
    ctl.update(401)
    expect(ctl.steer).toBe(0)
  })

  it('el dedo que dirige empuja al deslizar hacia arriba', () => {
    const g = swipe(make().ctl, [0.9, -0.4], [0.9, 0.3], 120)
    expect(g[0]).toMatchObject({ k: 'push' })
  })

  it('el dedo que se desliza no se pierde al salir de la tabla', () => {
    const { ctl } = make('airborne')
    ctl.down(1, 0, 0, 0)
    // El dedo se va muy afuera del hitbox (la captura del puntero sigue mandando eventos).
    ctl.move(1, -1.1, 0.2, 40)
    ctl.move(1, -1.6, 0.4, 90)
    ctl.up(1, -1.7, 0.5, 100)
    expect(ctl.update(101).length).toBeGreaterThan(0)
  })

  it('cancelar un dedo soltado limpia los estados (sin catch ni manual colgados)', () => {
    const { ctl } = make('airborne')
    ctl.down(1, 0, 0, 0)
    ctl.update(200)
    ctl.cancel(1)
    expect(ctl.update(201)).toEqual([{ k: 'catchEnd' }])
    expect(ctl.catching).toBe(false)
  })
})

describe('zurdos', () => {
  it('con el modo zurdo el pad se espeja: el swipe hacia la izquierda pasa a ser heelflip', () => {
    const righty = make('airborne').ctl
    const lefty = make('airborne').ctl
    lefty.leftHanded = true
    expect(swipe(righty, [0, 0], [-0.5, 0.5], 110)[0]).toMatchObject({ k: 'flip', dir: 1 })
    expect(swipe(lefty, [0, 0], [-0.5, 0.5], 110)[0]).toMatchObject({ k: 'flip', dir: -1 })
  })

  it('doblar tambien se invierte: arrastrar a la izquierda dobla a la derecha', () => {
    const lefty = make().ctl
    lefty.leftHanded = true
    lefty.down(1, -0.8, 0, 0)
    lefty.move(1, -1.2, 0, 50)
    expect(lefty.steer).toBeGreaterThan(0.8)
  })
})
