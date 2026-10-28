// Dibujo de "Miga Racers" sobre canvas 2D, vista desde arriba, en el lugar del local de cada pista
// (vitrina, obrador, cafetera, bollería, fiambrera). La simulación no sabe nada de esto: acá viven la
// cámara, el humo, las chispas y el zoom del turbo.

import { buildTrack, type SceneId, type Track } from './tracks.ts'
import {
  CAR_RADIUS,
  playerOf,
  sweeperPos,
  type Car,
  type RaceEvent,
  type RaceState,
} from './sim.ts'
import { SCENES, drawBlade, drawSolid, drawZone, type SceneStyle } from './scenes.ts'

/** Color de las salpicaduras al pisar un charco, según el lugar. */
const SPLASH: Record<SceneId, string[]> = {
  vitrina: ['#ffffff'],
  obrador: ['#bfe3f4', '#8cc8e8'],
  cafetera: ['#6b4128', '#4a2c1c'],
  boleria: ['#c98838', '#a8651f'],
  fiambrera: ['#f0d98a', '#d9b85a'],
}

interface Particle {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  grow: number
}

interface Prop {
  kind: number
  x: number
  y: number
  r: number
}

const MAX_PARTICLES = 140
/** Ancho de mundo que se ve a lo ancho (en vertical) y alto de mundo que se ve a lo alto (en horizontal). */
const VIEW_W = 560
const VIEW_H = 440
const INK = '#2a1a14'

function mulberry(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeProps(track: Track): Prop[] {
  const random = mulberry(track.def.id.length * 7919 + track.count)
  const { minX, minY, maxX, maxY } = track.bounds
  const props: Prop[] = []
  let attempts = 0
  while (props.length < 34 && attempts++ < 900) {
    const x = minX - 260 + random() * (maxX - minX + 520)
    const y = minY - 260 + random() * (maxY - minY + 520)
    let near = Infinity
    for (let i = 0; i < track.count; i += 3) {
      near = Math.min(near, Math.hypot(x - track.xs[i]!, y - track.ys[i]!))
    }
    if (near < track.half + 46) continue
    props.push({ kind: Math.floor(random() * 4), x, y, r: 9 + random() * 8 })
  }
  return props
}

function makeTile(style: SceneStyle): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = style.tileSize
  style.tile(canvas.getContext('2d')!, style.tileSize)
  return canvas
}

export class RacingRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private readonly floor: CanvasPattern | null
  private readonly style: SceneStyle
  private readonly trackPath = new Path2D()
  private readonly props: Prop[]
  private particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 3,
    color: '#fff',
    grow: 0,
  }))
  private prev: { x: number; y: number; h: number }[] = []
  private width = 1
  private height = 1
  private dpr = 1
  private cam = { x: 0, y: 0, zoom: 1, init: false }
  private shake = 0
  private lastRender = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    track: Track,
    private readonly reducedMotion: boolean,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!
    this.style = SCENES[track.def.scene]
    this.floor = this.ctx.createPattern(makeTile(this.style), 'repeat')
    this.floor?.setTransform(new DOMMatrix().scale(0.5))
    const t = buildTrack(track.def)
    this.trackPath.moveTo(t.xs[0]!, t.ys[0]!)
    for (let i = 1; i < t.count; i++) this.trackPath.lineTo(t.xs[i]!, t.ys[i]!)
    this.trackPath.closePath()
    this.props = makeProps(t)
  }

  resize(width: number, height: number, dpr: number) {
    this.width = width
    this.height = height
    this.dpr = dpr
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
  }

  /** Guarda las posiciones del paso anterior para poder suavizar entre pasos. */
  snapshot(state: RaceState) {
    this.prev = state.cars.map((c) => ({ x: c.x, y: c.y, h: c.h }))
  }

  private emit(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    color: string,
    grow = 0,
  ) {
    const slot = this.particles.find((p) => !p.active)
    if (!slot) return
    slot.active = true
    slot.x = x
    slot.y = y
    slot.vx = vx
    slot.vy = vy
    slot.maxLife = slot.life = life
    slot.size = size
    slot.color = color
    slot.grow = grow
  }

  private burst(x: number, y: number, colors: string[], count: number, speed: number) {
    const amount = this.reducedMotion ? Math.ceil(count / 3) : count
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2
      const v = speed * (0.3 + Math.random() * 0.9)
      this.emit(
        x,
        y,
        Math.cos(angle) * v,
        Math.sin(angle) * v,
        0.3 + Math.random() * 0.3,
        2 + Math.random() * 2.5,
        colors[Math.floor(Math.random() * colors.length)] ?? '#fff',
      )
    }
  }

  ingest(events: readonly RaceEvent[], state: RaceState) {
    for (const event of events) {
      if (event.t === 'bump') {
        this.burst(event.x, event.y, ['#fff', '#ffe58a', '#ff9d5c'], 9, 120)
        if (event.own && !this.reducedMotion) this.shake = Math.max(this.shake, 5)
      } else if (event.t === 'boost') {
        this.burst(event.x, event.y, ['#ffe58a', '#ff9d5c', '#fff'], event.own ? 14 : 6, 150)
      } else if (event.t === 'splash') {
        this.burst(event.x, event.y, SPLASH[state.track.def.scene], 10, 90)
      } else if (event.t === 'finish') {
        const p = playerOf(state)
        this.burst(p.x, p.y, ['#f7c948', '#c8102e', '#fff'], 30, 200)
      }
    }
  }

  private drawCar(car: Car, x: number, y: number, h: number, now: number) {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(x, y)
    ctx.fillStyle = 'rgba(42,26,20,0.22)'
    ctx.beginPath()
    ctx.ellipse(2, 4, 16, 9, h, 0, Math.PI * 2)
    ctx.fill()
    ctx.rotate(h)

    if (car.boost > 0) {
      ctx.fillStyle = Math.floor(now / 50) % 2 === 0 ? '#ffd45c' : '#ff7a2f'
      ctx.beginPath()
      ctx.moveTo(-14, -4)
      ctx.lineTo(-14 - 12 - Math.random() * 6, 0)
      ctx.lineTo(-14, 4)
      ctx.fill()
    }
    // Ruedas.
    ctx.fillStyle = INK
    for (const [wx, wy] of [
      [-8, -8],
      [8, -8],
      [-8, 8],
      [8, 8],
    ] as const) {
      ctx.fillRect(wx - 3.5, wy - 1.6, 7, 3.2)
    }
    // Carrocería.
    ctx.fillStyle = car.flash > 0 ? '#ffffff' : car.color
    ctx.beginPath()
    ctx.roundRect(-14, -7, 28, 14, 5)
    ctx.fill()
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.4
    ctx.stroke()
    // Franja y cabina.
    ctx.fillStyle = 'rgba(255,246,224,0.85)'
    ctx.fillRect(-12, -1.4, 24, 2.8)
    ctx.fillStyle = '#fff6e0'
    ctx.beginPath()
    ctx.roundRect(-4, -4.5, 9, 9, 3)
    ctx.fill()
    ctx.fillStyle = INK
    ctx.fillRect(10, -5, 2, 2.4)
    ctx.fillRect(10, 2.6, 2, 2.4)
    ctx.restore()
  }

  private drawProp(p: Prop) {
    const ctx = this.ctx
    const draw = this.style.props[p.kind % this.style.props.length]!
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.x * 0.013)
    draw(ctx, p.r)
    ctx.restore()
  }

  private drawTrack(state: RaceState) {
    const ctx = this.ctx
    const t = state.track
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.setLineDash([])
    const palette = this.style.track
    ctx.strokeStyle = palette.shadow
    ctx.lineWidth = t.def.width + 22
    ctx.stroke(this.trackPath)
    ctx.strokeStyle = palette.edge
    ctx.lineWidth = t.def.width + 14
    ctx.stroke(this.trackPath)
    ctx.strokeStyle = palette.base
    ctx.lineWidth = t.def.width
    ctx.stroke(this.trackPath)
    ctx.strokeStyle = palette.inner
    ctx.lineWidth = t.def.width - 22
    ctx.stroke(this.trackPath)
    ctx.strokeStyle = palette.dash
    ctx.lineWidth = 3
    ctx.setLineDash([14, 18])
    ctx.lineCap = 'butt'
    ctx.stroke(this.trackPath)
    ctx.setLineDash([])

    // Parches de turbo.
    for (const idx of t.boostIdx) {
      ctx.save()
      ctx.translate(t.xs[idx]!, t.ys[idx]!)
      ctx.rotate(Math.atan2(t.ty[idx]!, t.tx[idx]!))
      ctx.fillStyle = 'rgba(247,201,72,0.9)'
      ctx.fillRect(-14, -t.half * 0.42, 28, t.half * 0.84)
      ctx.strokeStyle = '#8a5a00'
      ctx.lineWidth = 3.2
      ctx.lineCap = 'round'
      for (const dx of [-8, 2]) {
        ctx.beginPath()
        ctx.moveTo(dx, -8)
        ctx.lineTo(dx + 7, 0)
        ctx.lineTo(dx, 8)
        ctx.stroke()
      }
      ctx.restore()
    }

    // Línea de largada a cuadros.
    ctx.save()
    ctx.translate(t.xs[0]!, t.ys[0]!)
    ctx.rotate(Math.atan2(t.ty[0]!, t.tx[0]!))
    const cell = 9
    const rows = Math.ceil(t.def.width / cell)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 2; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#fff6e0' : INK
        ctx.fillRect(c * cell - cell, -t.half + r * cell, cell, cell)
      }
    }
    ctx.restore()
  }

  /** Charcos, obstáculos y la hoja que gira (solo lo que se ve en pantalla). */
  private drawHazards(state: RaceState, halfW: number, halfH: number) {
    const ctx = this.ctx
    const t = state.track
    const visible = (x: number, y: number, r: number) =>
      Math.abs(x - this.cam.x) < halfW + r + 30 && Math.abs(y - this.cam.y) < halfH + r + 30
    for (const z of t.zones) {
      if (!visible(z.x, z.y, z.r)) continue
      ctx.save()
      ctx.translate(z.x, z.y)
      drawZone(ctx, z.kind, z.r)
      ctx.restore()
    }
    for (const o of t.solids) {
      if (!visible(o.x, o.y, o.r)) continue
      ctx.save()
      ctx.translate(o.x, o.y)
      drawSolid(ctx, o.kind, o.r)
      ctx.restore()
    }
    for (const sw of t.sweepers) {
      const p = sweeperPos(sw, state.tick)
      if (!visible(p.x, p.y, sw.r)) continue
      ctx.save()
      ctx.translate(p.x, p.y)
      drawBlade(ctx, sw.r, state.tick * 0.35)
      ctx.restore()
    }
  }

  render(state: RaceState, alpha: number, now: number) {
    const ctx = this.ctx
    const dt = this.lastRender ? Math.min((now - this.lastRender) / 1000, 0.05) : 0.016
    this.lastRender = now
    const lerp = (a: number, b: number) => a + (b - a) * alpha

    const player = playerOf(state)
    const pi = state.cars.indexOf(player)
    const pp = this.prev[pi] ?? player
    const px = lerp(pp.x, player.x)
    const py = lerp(pp.y, player.y)

    // Cámara: sigue al jugador mirando un poco hacia donde va, y se aleja un poco con el turbo.
    const targetX = px + player.vx * 0.28
    const targetY = py + player.vy * 0.28
    const follow = 1 - Math.exp(-7 * dt)
    if (!this.cam.init) {
      this.cam = { x: targetX, y: targetY, zoom: 1, init: true }
    } else {
      this.cam.x += (targetX - this.cam.x) * follow
      this.cam.y += (targetY - this.cam.y) * follow
    }
    const zoomTarget = player.boost > 0 && !this.reducedMotion ? 0.92 : 1
    this.cam.zoom += (zoomTarget - this.cam.zoom) * (1 - Math.exp(-5 * dt))

    const base = Math.min(this.width / VIEW_W, this.height / VIEW_H)
    const scale = base * this.dpr * this.cam.zoom
    let ox = 0
    let oy = 0
    if (this.shake > 0.05) {
      ox = (Math.random() - 0.5) * this.shake * this.dpr
      oy = (Math.random() - 0.5) * this.shake * this.dpr
      this.shake *= Math.pow(0.001, dt)
    } else {
      this.shake = 0
    }
    ctx.setTransform(
      scale,
      0,
      0,
      scale,
      this.canvas.width / 2 - this.cam.x * scale + ox,
      this.canvas.height / 2 - this.cam.y * scale + oy,
    )

    // Mantel: se pinta solo la parte visible del mundo.
    const halfW = this.canvas.width / 2 / scale + 4
    const halfH = this.canvas.height / 2 / scale + 4
    ctx.fillStyle = this.floor ?? '#fff3d6'
    ctx.fillRect(this.cam.x - halfW, this.cam.y - halfH, halfW * 2, halfH * 2)

    for (const prop of this.props) {
      if (Math.abs(prop.x - this.cam.x) < halfW + 30 && Math.abs(prop.y - this.cam.y) < halfH + 30)
        this.drawProp(prop)
    }
    this.drawTrack(state)
    this.drawHazards(state, halfW, halfH)

    // Humo de las gomas al derrapar y chispas del turbo.
    const smoke = !this.reducedMotion
    for (let i = 0; i < state.cars.length; i++) {
      const car = state.cars[i]!
      if (smoke && state.status === 'racing' && car.slip > 70 && state.tick % 2 === 0) {
        this.emit(
          car.x - Math.cos(car.h) * 10,
          car.y - Math.sin(car.h) * 10,
          (Math.random() - 0.5) * 14,
          (Math.random() - 0.5) * 14,
          0.5,
          3,
          'rgba(255,246,224,0.65)',
          14,
        )
      }
    }

    for (const part of this.particles) {
      if (!part.active) continue
      part.life -= dt
      if (part.life <= 0) {
        part.active = false
        continue
      }
      part.x += part.vx * dt
      part.y += part.vy * dt
      part.vx *= 0.94
      part.vy *= 0.94
      part.size += part.grow * dt
      ctx.globalAlpha = Math.min(1, (part.life / part.maxLife) * 1.3)
      ctx.fillStyle = part.color
      ctx.beginPath()
      ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Autos, de arriba hacia abajo para que se tapen bien.
    const order = state.cars.map((_, i) => i).sort((a, b) => state.cars[a]!.y - state.cars[b]!.y)
    for (const i of order) {
      const car = state.cars[i]!
      const prev = this.prev[i] ?? car
      // El rumbo se interpola por el camino corto.
      let dh = car.h - prev.h
      while (dh > Math.PI) dh -= Math.PI * 2
      while (dh < -Math.PI) dh += Math.PI * 2
      this.drawCar(car, lerp(prev.x, car.x), lerp(prev.y, car.y), prev.h + dh * alpha, now)
    }

    // Marcador sobre el auto del jugador.
    const bob = Math.sin(now / 150) * 2
    ctx.fillStyle = '#fff6e0'
    ctx.strokeStyle = INK
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(px - 6, py - CAR_RADIUS - 16 + bob)
    ctx.lineTo(px + 6, py - CAR_RADIUS - 16 + bob)
    ctx.lineTo(px, py - CAR_RADIUS - 7 + bob)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    ctx.setTransform(1, 0, 0, 1, 0, 0)
  }
}
