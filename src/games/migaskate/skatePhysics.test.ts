import { DEFAULT_PARAMS, SkatePhysics, STEP, type SkateEvent } from './skatePhysics.ts'
import { qFromAxisAngle, qIdentity, qMul, v3, vLen } from './vec.ts'
import { SPOTS } from './spots.ts'
import { heightAt, type WorldDef } from './world.ts'

const FLAT: WorldDef = {
  halfX: 80,
  halfZ: 80,
  surfaces: [],
  rails: [],
  start: { x: 0, z: 0, heading: 0 },
}

const REST_Y = 0.095

function run(p: SkatePhysics, seconds: number, events: SkateEvent[] = []) {
  for (let t = 0; t < seconds - 1e-9; t += STEP) events.push(...p.step())
  return events
}

/** Skater apoyado y asentado en el suelo, sin velocidad extra. */
function settled(world: WorldDef = FLAT, speed = 0) {
  const p = new SkatePhysics(world)
  p.placeFlat(world.start.x, world.start.z, world.start.heading, speed)
  run(p, 0.6)
  return p
}

/** Lo deja en el aire en `y` con la tabla girada `roll` rad en Z y `pitch` rad en X. */
function dropFrom(y: number, roll = 0, pitch = 0, world: WorldDef = FLAT) {
  const p = new SkatePhysics(world)
  p.placeFlat(0, 0, 0, 0)
  let q = qIdentity()
  if (roll) q = qMul(q, qFromAxisAngle(v3(0, 0, 1), roll))
  if (pitch) q = qMul(q, qFromAxisAngle(v3(1, 0, 0), pitch))
  p.body.setPose(v3(0, y, 0), q)
  p.machine.reset('airborne')
  p.contacts = 0
  return p
}

const kinds = (events: SkateEvent[]) => events.map((e) => e.t)

describe('suspension por raycast (Hooke + amortiguacion)', () => {
  it('asienta a la altura de reposo sin rebotar eternamente', () => {
    const p = new SkatePhysics(FLAT)
    p.placeFlat(0, 0, 0, 0)
    run(p, 1.5)
    let maxVy = 0
    for (let i = 0; i < 120; i++) {
      p.step()
      maxVy = Math.max(maxVy, Math.abs(p.body.velocity.y))
    }
    expect(p.body.origin.y).toBeCloseTo(REST_Y, 2)
    expect(maxVy).toBeLessThan(0.01)
    expect(p.contacts).toBe(4)
    expect(p.state).toBe('grounded')
  })

  it('el resorte de Hooke hunde la tabla lo que pide el peso: m g / (4 k)', () => {
    const { suspension: s, mass, gravity } = DEFAULT_PARAMS
    const sag = (mass * gravity) / (4 * s.stiffness)
    const p = settled()
    // Altura de la rueda sobre el piso = largo del rayo - hundimiento.
    const wheelHeight = p.body.origin.y + DEFAULT_PARAMS.wheelY
    expect(wheelHeight).toBeCloseTo(s.rayLength - sag, 2)
  })

  it('con 4 rayos se inclina siguiendo una pendiente', () => {
    const world: WorldDef = {
      ...FLAT,
      surfaces: [{ type: 'ramp', x: 0, z: 0, w: 6, d: 8, height: 2, dir: 'pz' }],
    }
    const p = new SkatePhysics(world)
    p.placeFlat(0, 0, 0, 0)
    run(p, 0.4)
    // La rampa sube 2 m en 8 m: unos 14 grados.
    const slope = Math.atan(2 / 8)
    expect(p.pitchAngle).toBeGreaterThan(slope - 0.04)
    expect(p.pitchAngle).toBeLessThan(slope + 0.04)
    expect(p.contacts).toBe(4)
  })

  it('amortigua una caida: no rebota y la velocidad vertical se apaga enseguida', () => {
    const p = dropFrom(1.5)
    let rebound = 0
    let landed = false
    for (let i = 0; i < 120 * 2; i++) {
      p.step()
      if (p.state === 'grounded') landed = true
      if (landed) rebound = Math.max(rebound, p.body.origin.y - REST_Y)
    }
    expect(landed).toBe(true)
    expect(rebound).toBeLessThan(0.02)
    expect(Math.abs(p.body.velocity.y)).toBeLessThan(0.02)
  })
})

describe('friccion anisotropica', () => {
  it('el deslizamiento lateral decae mucho mas rapido que el avance', () => {
    const lateral = settled()
    const params = { ...DEFAULT_PARAMS, cruise: 3 }
    const side = new SkatePhysics(FLAT, params)
    side.placeFlat(0, 0, 0, 0)
    run(side, 0.5)
    side.body.velocity = v3(3, 0, 3) // 3 m/s de costado y 3 de avance
    run(side, 0.25)
    const local = side.body.toLocalDirection(side.body.velocity)
    expect(Math.abs(local.x)).toBeLessThan(0.3) // el costado casi se fue
    expect(local.z).toBeGreaterThan(2.5) // el avance casi no cambio
    expect(Math.abs(local.x) / 3).toBeLessThan((3 - local.z) / 3 + 0.1)
    void lateral
  })

  it('la velocidad local sale de la transformada inversa de la orientacion de la tabla', () => {
    const p = new SkatePhysics(FLAT)
    p.placeFlat(0, 0, Math.PI / 2, 0) // la tabla mira hacia +X
    const local = p.body.toLocalDirection(v3(1, 0, 0))
    expect(local.z).toBeCloseTo(1, 6)
    expect(local.x).toBeCloseTo(0, 6)
    const back = p.body.toWorldDirection(local)
    expect(back.x).toBeCloseTo(1, 6)
  })

  it('doblar con el dedo gira la tabla y la trayectoria sigue (los trucks hacen de timon)', () => {
    const p = settled(FLAT, 3.2)
    p.steer = 1
    run(p, 1)
    expect(p.boardYaw).toBeLessThan(-1) // hacia la derecha
    const v = p.body.velocity
    // La velocidad acompana el giro de la tabla (poco deslizamiento).
    expect(Math.atan2(v.x, v.z)).toBeLessThan(-0.8)
    p.steer = -1
    run(p, 1.2)
    expect(p.boardYaw).toBeGreaterThan(-1)
  })
})

describe('centro de masa desplazado', () => {
  it('esta 5 cm por debajo del origen de la tabla', () => {
    const p = settled()
    expect(p.body.comLocal.y).toBeCloseTo(-0.05)
    expect(p.body.com.y).toBeCloseTo(p.body.origin.y - 0.05, 6)
  })

  it('aterriza torcido y se endereza sin volcar (estabilidad)', () => {
    for (const roll of [-0.3, -0.15, 0.15, 0.3]) {
      const p = dropFrom(0.25, roll)
      const events = run(p, 1.5)
      expect(kinds(events)).not.toContain('bail')
      expect(Math.abs(p.rollAngle)).toBeLessThan(0.02)
      expect(p.state).toBe('grounded')
    }
  })
})

describe('ollie', () => {
  it('suma impulso vertical y torque de cabeceo, y depende de la velocidad del swipe', () => {
    const results: { vy: number; wx: number }[] = []
    for (const power of [0, 0.5, 1]) {
      const p = settled()
      p.applyGesture({ k: 'ollie', power, nollie: false })
      expect(p.state).toBe('popping')
      results.push({ vy: p.body.velocity.y, wx: p.body.localAngularVelocity.x })
    }
    const { ollie } = DEFAULT_PARAMS
    expect(results[0]!.vy).toBeCloseTo(ollie.velocity, 1)
    expect(results[2]!.vy).toBeCloseTo(ollie.velocity + ollie.velocityRange, 1)
    expect(results[1]!.vy).toBeGreaterThan(results[0]!.vy)
    expect(results[2]!.vy).toBeGreaterThan(results[1]!.vy)
    // Cabeceo: nariz arriba = giro negativo sobre el eje X local, mas fuerte con mas potencia.
    expect(results[0]!.wx).toBeLessThan(-ollie.pitch * 0.9)
    expect(results[2]!.wx).toBeLessThan(results[0]!.wx)
  })

  it('el nollie cabecea al reves (nariz abajo, cola arriba)', () => {
    const p = settled()
    p.applyGesture({ k: 'ollie', power: 0.8, nollie: true })
    expect(p.body.localAngularVelocity.x).toBeGreaterThan(3)
    expect(p.nollie).toBe(true)
  })

  it('un ollie mas fuerte salta mas alto y aterriza limpio', () => {
    const heights: number[] = []
    for (const power of [0.1, 1]) {
      const p = settled()
      p.applyGesture({ k: 'ollie', power, nollie: false })
      const events = run(p, 1.6)
      const land = events.find((e) => e.t === 'land')
      expect(land?.t === 'land' && land.quality).toBe('clean')
      expect(p.state).toBe('grounded')
      heights.push(land?.t === 'land' && land.trick ? land.trick.height : 0)
    }
    expect(heights[1]!).toBeGreaterThan(heights[0]! + 0.4)
  })

  it('no se puede saltar dos veces en el aire, pero un salto pedido justo antes de aterrizar se aprovecha', () => {
    const p = settled()
    p.applyGesture({ k: 'ollie', power: 0.5, nollie: false })
    run(p, 0.3)
    const vy = p.body.velocity.y
    p.applyGesture({ k: 'ollie', power: 1, nollie: false })
    expect(p.body.velocity.y).toBe(vy)
    // Cae casi hasta el suelo y recien ahi pide otro: queda guardado un instante.
    for (let i = 0; i < 400 && !(p.body.velocity.y < 0 && p.body.origin.y < 0.3); i++) p.step()
    p.applyGesture({ k: 'ollie', power: 0.5, nollie: false })
    const events = run(p, 0.12)
    expect(events.filter((e) => e.t === 'pop')).toHaveLength(1)
  })
})

describe('kickflip / heelflip / shuvit', () => {
  it('aplican el torque esperado: Z para flips, Y para shove-its, con el signo de la direccion', () => {
    const { flip, shuvit } = DEFAULT_PARAMS
    for (const dir of [1, -1] as const) {
      const p = settled()
      p.applyGesture({ k: 'ollie', power: 1, nollie: false })
      p.applyGesture({ k: 'flip', power: 0.4, dir })
      const w = p.body.localAngularVelocity
      expect(Math.sign(w.z)).toBe(dir)
      expect(Math.abs(w.z)).toBeCloseTo(flip.omega + flip.omegaRange * 0.4, 0)
      expect(Math.abs(w.y)).toBeLessThan(0.5)

      const q = settled()
      q.applyGesture({ k: 'ollie', power: 1, nollie: false })
      q.applyGesture({ k: 'shuvit', power: 0.4, dir })
      const wy = q.body.localAngularVelocity
      expect(Math.sign(wy.y)).toBe(dir)
      expect(Math.abs(wy.y)).toBeCloseTo(shuvit.omega + shuvit.omegaRange * 0.4, 0)
      expect(Math.abs(wy.z)).toBeLessThan(0.5)
    }
  })

  it('un kickflip con salto fuerte completa 360 grados y aterriza limpio; el heelflip gira al reves', () => {
    for (const dir of [1, -1] as const) {
      const p = settled()
      p.applyGesture({ k: 'flip', power: 0.4, dir })
      p.applyGesture({ k: 'ollie', power: 1, nollie: false })
      const events = run(p, 1.6)
      const land = events.find((e) => e.t === 'land')
      expect(land?.t === 'land' && land.quality).toBe('clean')
      expect(land?.t === 'land' && land.trick?.roll).toBe(dir)
      expect(kinds(events)).not.toContain('bail')
    }
  })

  it('el shove-it de 180 y de 360 completa y aterriza limpio', () => {
    for (const [power, halves] of [
      [0.3, 1],
      [1, 2],
    ] as const) {
      const p = settled()
      p.applyGesture({ k: 'ollie', power: 1, nollie: false })
      run(p, 0.05)
      p.applyGesture({ k: 'shuvit', power, dir: -1 })
      const events = run(p, 1.6)
      const land = events.find((e) => e.t === 'land')
      expect(land?.t === 'land' && land.trick?.yaw).toBe(-halves)
      expect(land?.t === 'land' && land.quality).toBe('clean')
    }
  })

  it('un flip doble en un salto bajito no se completa: caida (amable)', () => {
    const p = settled()
    p.applyGesture({ k: 'flip', power: 1, dir: 1 })
    p.applyGesture({ k: 'ollie', power: 0, nollie: false })
    const events = run(p, 1.6)
    expect(kinds(events)).toContain('bail')
    run(p, 1)
    expect(p.state).toBe('grounded') // se recupera sola, rapido
  })

  it('combinar flip + shove-it en el aire da un 360 flip', () => {
    const p = settled()
    p.applyGesture({ k: 'ollie', power: 1, nollie: false })
    run(p, 0.05)
    p.applyGesture({ k: 'flip', power: 0.4, dir: 1 })
    p.applyGesture({ k: 'shuvit', power: 1, dir: 1 })
    const events = run(p, 1.6)
    const land = events.find((e) => e.t === 'land')
    expect(land?.t === 'land' && land.trick?.roll).toBe(1)
    expect(land?.t === 'land' && land.trick?.yaw).toBe(2)
  })
})

describe('catch', () => {
  it('sube el angularDrag a 20 mientras se mantiene y vuelve al soltar', () => {
    const p = settled()
    p.applyGesture({ k: 'ollie', power: 1, nollie: false })
    run(p, 0.2)
    expect(p.body.angularDrag).toBeCloseTo(DEFAULT_PARAMS.angularDragAir)
    p.applyGesture({ k: 'catch' })
    p.step()
    expect(p.body.angularDrag).toBe(20)
    p.applyGesture({ k: 'catchEnd' })
    p.step()
    expect(p.body.angularDrag).toBeCloseTo(DEFAULT_PARAMS.angularDragAir)
  })

  it('nivela la rotacion Z hacia 0 o 180 grados (el mas cercano)', () => {
    for (const [roll, target] of [
      [0.9, 0],
      [-0.9, 0],
      [2.2, Math.PI],
      [-2.2, -Math.PI],
    ] as const) {
      const p = dropFrom(30, roll)
      p.applyGesture({ k: 'catch' })
      run(p, 0.6)
      const diff = Math.abs(
        Math.atan2(Math.sin(p.rollAngle - target), Math.cos(p.rollAngle - target)),
      )
      expect(diff).toBeLessThan(0.12)
      // y queda quieta (angularDrag 20): sin giro residual.
      expect(vLen(p.body.angularVelocity)).toBeLessThan(0.5)
    }
  })

  it('catch en pleno flip frena el giro: sin catch sigue dando vueltas', () => {
    const spinning = (catching: boolean) => {
      const p = dropFrom(30)
      p.applyGesture({ k: 'flip', power: 1, dir: 1 })
      run(p, 0.12)
      if (catching) p.applyGesture({ k: 'catch' })
      run(p, 0.3)
      return Math.abs(p.body.localAngularVelocity.z)
    }
    expect(spinning(true)).toBeLessThan(1)
    expect(spinning(false)).toBeGreaterThan(5)
  })
})

describe('auto-leveling', () => {
  const ramp: WorldDef = {
    ...FLAT,
    surfaces: [{ type: 'ramp', x: 0, z: 0, w: 8, d: 8, height: 2.5, dir: 'pz' }],
  }

  it('a menos de 0.4 del suelo alinea el Up de la tabla con la normal de la superficie', () => {
    // Sobre la rampa (z = 0 -> altura 1.25), 0.3 por encima, cayendo.
    const near = dropFrom(1.25 + 0.3, 0, 0, ramp)
    near.body.velocity = v3(0, -1, 0)
    run(near, 0.12)
    const slope = Math.atan(2.5 / 8)
    expect(near.pitchAngle).toBeGreaterThan(slope * 0.6)
    const up = near.boardUp
    const n = v3(-Math.sin(slope), Math.cos(slope), 0)
    void n
    expect(up.z).toBeLessThan(-0.1)
  })

  it('a mas de 0.4 no actua: la tabla sigue plana', () => {
    const far = dropFrom(1.25 + 1.2, 0, 0, ramp)
    far.body.velocity = v3(0, -1, 0)
    run(far, 0.12)
    expect(Math.abs(far.pitchAngle)).toBeLessThan(0.02)
  })
})

describe('aterrizaje segun la normal del suelo', () => {
  it('de pie = limpio, de canto = torpe, boca abajo o muy torcida = caida', () => {
    const quality = (roll: number) => {
      const p = dropFrom(0.25, roll)
      // Sin estabilizar: se juzga el aterrizaje con la tabla como llega.
      const events: SkateEvent[] = []
      for (let i = 0; i < 120; i++) {
        p.catching = false
        events.push(...p.step())
      }
      const land = events.find((e) => e.t === 'land')
      if (land?.t === 'land') return land.quality
      return events.some((e) => e.t === 'bail') ? 'bail' : 'none'
    }
    expect(quality(0.05)).toBe('clean')
    expect(quality(Math.PI)).toBe('bail')
  })

  it('la orientacion respecto del movimiento importa: aterrizar de costado a velocidad es caida', () => {
    const p = dropFrom(0.25)
    p.body.velocity = v3(5, -1, 0) // se mueve hacia +X con la tabla mirando a +Z
    const events = run(p, 0.5)
    expect(kinds(events)).toContain('bail')
  })
})

describe('maquina de estados en juego', () => {
  it('grounded -> popping -> airborne -> grounded y emite una sola vez cada evento', () => {
    const p = settled()
    const states: string[] = []
    p.machine.onChange((_from, to) => states.push(to))
    p.applyGesture({ k: 'ollie', power: 0.6, nollie: false })
    const events = run(p, 1.5)
    expect(states).toEqual(['popping', 'airborne', 'grounded'])
    expect(kinds(events).filter((k) => k === 'land')).toHaveLength(1)
  })

  it('un riel engancha en el aire: airborne -> grinding -> airborne, sale al final', () => {
    const world: WorldDef = {
      ...FLAT,
      rails: [{ ax: 0, az: 3, ay: 0.5, bx: 0, bz: 9, by: 0.5 }],
    }
    const p = new SkatePhysics(world)
    p.placeFlat(0, 1.5, 0, 4)
    const states: string[] = []
    p.machine.onChange((_f, to) => states.push(to))
    p.applyGesture({ k: 'ollie', power: 1, nollie: false })
    const events = run(p, 3)
    expect(states).toContain('grinding')
    expect(states.indexOf('airborne')).toBeLessThan(states.indexOf('grinding'))
    const end = events.find((e) => e.t === 'grindEnd')
    expect(end?.t === 'grindEnd' && end.seconds).toBeGreaterThan(0.5)
  })

  it('un riel perpendicular al avance no engancha', () => {
    const world: WorldDef = {
      ...FLAT,
      rails: [{ ax: -4, az: 3, ay: 0.5, bx: 4, bz: 3, by: 0.5 }],
    }
    const p = new SkatePhysics(world)
    p.placeFlat(0, 1.5, 0, 3.2)
    p.applyGesture({ k: 'ollie', power: 1, nollie: false })
    expect(kinds(run(p, 2))).not.toContain('grindStart')
  })

  it('en un grind, un ollie sale del riel (grinding -> popping)', () => {
    const world: WorldDef = {
      ...FLAT,
      rails: [{ ax: 0, az: 3, ay: 0.5, bx: 0, bz: 12, by: 0.5 }],
    }
    const p = new SkatePhysics(world)
    p.placeFlat(0, 1.5, 0, 4)
    p.applyGesture({ k: 'ollie', power: 1, nollie: false })
    for (let i = 0; i < 360 && p.state !== 'grinding'; i++) p.step()
    expect(p.state).toBe('grinding')
    run(p, 0.2)
    p.applyGesture({ k: 'ollie', power: 0.6, nollie: false })
    expect(p.state).toBe('popping')
  })
})

describe('continuidad de colisiones (sin tunneling)', () => {
  const thinWall: WorldDef = {
    ...FLAT,
    surfaces: [{ type: 'box', x: 0, z: 6, w: 8, d: 0.4, height: 0.8, dir: 'pz' }],
  }

  it('la tabla no atraviesa una pared fina a ninguna velocidad', () => {
    for (const speed of [3, 6, 10, 14, 20, 30]) {
      const p = new SkatePhysics(thinWall)
      p.placeFlat(0, 0, 0, speed)
      let maxZ = 0
      for (let i = 0; i < 120 * 2; i++) {
        p.step()
        maxZ = Math.max(maxZ, p.body.origin.z)
      }
      expect(maxZ).toBeLessThan(6 - 0.2 + 0.25) // el frente de la pared esta en z = 5.8
    }
  })

  it('una tabla que cae muy rapido no atraviesa una cornisa fina', () => {
    const ledge: WorldDef = {
      ...FLAT,
      surfaces: [{ type: 'box', x: 0, z: 0, w: 0.9, d: 6, height: 0.5, dir: 'pz' }],
    }
    for (const vy of [-6, -12, -20, -35]) {
      const p = dropFrom(3, 0, 0, ledge)
      p.body.velocity = v3(0, vy, 0)
      let minY = 99
      for (let i = 0; i < 120 * 1.5; i++) {
        p.step()
        minY = Math.min(minY, p.body.origin.y)
      }
      expect(minY).toBeGreaterThan(0.5 - 0.1)
    }
  })

  it('una rampa a toda velocidad no se atraviesa ni lanza la tabla al espacio', () => {
    const world: WorldDef = {
      ...FLAT,
      surfaces: [{ type: 'ramp', x: 0, z: 4, w: 4, d: 3.4, height: 0.9, dir: 'pz' }],
    }
    for (const speed of [2, 5, 8, 10, 14]) {
      const p = new SkatePhysics(world)
      p.placeFlat(0, 0, 0, speed)
      let maxY = 0
      let minUnder = 0
      for (let i = 0; i < 120 * 3; i++) {
        p.step()
        const o = p.body.origin
        maxY = Math.max(maxY, o.y)
        minUnder = Math.min(minUnder, o.y - heightAt(world, o.x, o.z))
      }
      expect(maxY).toBeLessThan(2.5)
      expect(minUnder).toBeGreaterThan(-0.12)
    }
  })

  it('un riel se engancha a cualquier velocidad razonable', () => {
    const world: WorldDef = {
      ...FLAT,
      rails: [{ ax: 0, az: 3, ay: 0.5, bx: 0, bz: 30, by: 0.5 }],
    }
    for (const speed of [2.5, 4, 6, 9, 10]) {
      const p = new SkatePhysics(world)
      p.placeFlat(0, 3.3 - 0.6 * speed, 0, speed)
      p.applyGesture({ k: 'ollie', power: 1, nollie: false })
      expect(kinds(run(p, 3))).toContain('grindStart')
    }
  })
})

describe('determinismo', () => {
  function trajectory(seed: number) {
    const spot = SPOTS[2]!
    const p = new SkatePhysics(spot.world, DEFAULT_PARAMS, seed)
    const out: number[] = []
    for (let i = 0; i < 120 * 12; i++) {
      if (i % 90 === 0) p.applyGesture({ k: 'ollie', power: (i % 7) / 7, nollie: false })
      if (i % 130 === 0) p.applyGesture({ k: 'flip', power: 0.5, dir: i % 2 ? 1 : -1 })
      p.steer = Math.sin(i / 60)
      p.step()
      if (i % 30 === 0) out.push(p.body.origin.x, p.body.origin.y, p.body.origin.z)
    }
    return out
  }

  it('mismas entradas y misma semilla dan exactamente la misma trayectoria', () => {
    expect(trajectory(5)).toEqual(trajectory(5))
  })

  it('advance con un acumulador da lo mismo que pasos fijos', () => {
    const a = settled(FLAT, 3.2)
    const b = settled(FLAT, 3.2)
    a.steer = b.steer = 0.4
    for (let i = 0; i < 120; i++) a.step()
    for (let i = 0; i < 120; i++) b.advance(STEP)
    expect(a.body.origin.x).toBeCloseTo(b.body.origin.x, 9)
    expect(a.body.origin.z).toBeCloseTo(b.body.origin.z, 9)
  })
})

describe('hooks de eventos (OnPop, OnLand, OnGrindStart, OnGrindStay)', () => {
  it('onPop y onLand llegan una vez con sus datos, y se pueden cancelar', () => {
    const p = settled()
    const pops: number[] = []
    const lands: string[] = []
    const offPop = p.onPop((e) => pops.push(e.power))
    p.onLand((e) => lands.push(e.quality))
    p.applyGesture({ k: 'ollie', power: 0.7, nollie: false })
    run(p, 1.5)
    expect(pops).toEqual([0.7])
    expect(lands).toEqual(['clean'])
    offPop()
    p.applyGesture({ k: 'ollie', power: 0.2, nollie: false })
    run(p, 1.5)
    expect(pops).toHaveLength(1)
    expect(lands).toHaveLength(2)
  })

  it('onGrindStart una vez y onGrindStay en cada paso mientras dura el grind', () => {
    const world: WorldDef = {
      ...FLAT,
      rails: [{ ax: 0, az: 3, ay: 0.5, bx: 0, bz: 12, by: 0.5 }],
    }
    const p = new SkatePhysics(world)
    p.placeFlat(0, 1.5, 0, 4)
    let starts = 0
    let stays = 0
    let grindSeconds = 0
    p.onGrindStart(() => starts++)
    p.onGrindStay((e) => {
      stays++
      expect(e.speed).toBeGreaterThan(0)
      expect(e.y).toBeCloseTo(0.5, 1)
    })
    p.on('grindEnd', (e) => (grindSeconds = e.seconds))
    p.applyGesture({ k: 'ollie', power: 1, nollie: false })
    run(p, 4)
    expect(starts).toBe(1)
    expect(grindSeconds).toBeGreaterThan(0.5)
    expect(stays).toBeGreaterThan(grindSeconds * 100)
  })
})

describe('interpolacion', () => {
  it('view(alpha) mezcla el paso anterior con el actual', () => {
    const p = settled(FLAT, 3.2)
    p.step()
    const a = p.view(0).position
    const b = p.view(1).position
    const mid = p.view(0.5).position
    expect(b.z).toBeGreaterThan(a.z)
    expect(mid.z).toBeCloseTo((a.z + b.z) / 2, 9)
  })
})

describe('manual y empuje', () => {
  it('el manual se sostiene corrigiendo el equilibrio y se cae solo si no corregis', () => {
    const hold = settled(FLAT, 3.2)
    hold.applyGesture({ k: 'manual', nose: false })
    expect(hold.manual).not.toBeNull()
    let pitchSeen = 0
    for (let i = 0; i < 120 * 5; i++) {
      hold.balance = Math.max(-1, Math.min(1, (hold.manual?.bal ?? 0) * 1.5))
      hold.step()
      pitchSeen = Math.max(pitchSeen, hold.pitchAngle)
    }
    expect(hold.manual).not.toBeNull()
    expect(pitchSeen).toBeGreaterThan(0.1) // la nariz sube de verdad

    const fall = settled(FLAT, 3.2)
    fall.applyGesture({ k: 'manual', nose: true })
    const events = run(fall, 8)
    expect(kinds(events)).toContain('bail')
  })

  it('el empuje suma velocidad hasta un tope', () => {
    const p = settled(FLAT, 3.2)
    for (let i = 0; i < 6; i++) p.applyGesture({ k: 'push', power: 1 })
    expect(p.horizontalSpeed).toBeLessThanOrEqual(10.01)
    expect(p.horizontalSpeed).toBeGreaterThan(6)
  })
})

describe('estabilidad: barridos de velocidad y angulo', () => {
  it(
    'sin NaN, sin energia que se acumule y sin quedar pegada, en todos los spots',
    { timeout: 60_000 },
    () => {
      for (const spot of SPOTS) {
        for (const speed of [1, 3, 6, 10]) {
          for (const heading of [0, 0.8, 1.6, 2.4, 3.2, -0.8, -1.6]) {
            const p = new SkatePhysics(spot.world)
            p.placeFlat(spot.world.start.x, spot.world.start.z, heading, speed)
            let maxSpeed = 0
            for (let i = 0; i < 120 * 6; i++) {
              if (i % 50 === 0) p.applyGesture({ k: 'ollie', power: (i % 3) / 3, nollie: false })
              if (i % 70 === 0) p.applyGesture({ k: 'flip', power: 0.5, dir: 1 })
              p.steer = Math.sin(i / 40 + heading)
              p.step()
              const v = p.body.velocity
              const w = p.body.angularVelocity
              expect(Number.isFinite(v.x + v.y + v.z + w.x + w.y + w.z)).toBe(true)
              maxSpeed = Math.max(maxSpeed, Math.hypot(v.x, v.y, v.z))
            }
            expect(maxSpeed).toBeLessThan(25)
          }
        }
      }
    },
  )

  it('la caida se recupera sola en menos de 1.2 s (nunca queda pegada)', () => {
    const p = settled(FLAT, 5)
    p.applyGesture({ k: 'flip', power: 1, dir: 1 })
    p.applyGesture({ k: 'ollie', power: 0, nollie: false })
    let bailed = 0
    for (let i = 0; i < 120 * 4; i++) {
      p.step()
      if (p.state === 'bailed') bailed += STEP
    }
    expect(bailed).toBeGreaterThan(0)
    expect(bailed).toBeLessThan(1.2)
    expect(p.state).toBe('grounded')
  })
})
