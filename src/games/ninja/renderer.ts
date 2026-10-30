// Dibujo de "Miga Ninja" en canvas 2D. Las cosas son sprites prehechos (ver art.ts), así que cada
// cuadro es solo copiar imágenes. Las mitades, las gotas, los destellos y los carteles salen de
// pools de tamaño fijo: no se crean objetos nuevos mientras se juega.

import {
  FIELD_W,
  ITEM_RADIUS,
  timeScale,
  type GameEvent,
  type GameState,
  type ItemKind,
} from './engine.ts'
import { CREAM, GOLD, RED, SPLASH, drawHalf, drawWhole } from './art.ts'
import type { SceneId } from './levels.ts'
import { drawScene } from './scenes.ts'

const KINDS: ItemKind[] = [
  'sandwich',
  'medialuna',
  'chipa',
  'cinnamon',
  'cafe',
  'golden',
  'ice',
  'ant',
]

interface Sprites {
  whole: HTMLCanvasElement
  top: HTMLCanvasElement
  bottom: HTMLCanvasElement
}

interface Half {
  active: boolean
  kind: ItemKind
  side: -1 | 1
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  spin: number
  life: number
}

interface Particle {
  active: boolean
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  color: string
  rect: boolean
  rot: number
}

interface Flash {
  active: boolean
  x: number
  y: number
  angle: number
  life: number
}

interface Popup {
  active: boolean
  x: number
  y: number
  life: number
  max: number
  text: string
  color: string
  size: number
}

export interface PopupLabels {
  miss: string
  life: string
  frenzy: string
  freeze: string
  goal: string
  stroke: (n: number, bonus: number) => string
}

const HALF_MAX = 20
const PARTICLE_MAX = 240
const FLASH_MAX = 8
const POPUP_MAX = 10
const TRAIL_MAX = 16
const TRAIL_MS = 220

function make<T>(n: number, create: () => T): T[] {
  return Array.from({ length: n }, create)
}

export class NinjaRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private readonly bg = document.createElement('canvas')
  private readonly frost = document.createElement('canvas')
  private readonly glow = document.createElement('canvas')
  private sprites = new Map<ItemKind, Sprites>()
  private spriteScale = 0
  private width = 0
  private height = 0
  private scale = 1
  private offX = 0
  private offY = 0

  private readonly halves = make<Half>(HALF_MAX, () => ({
    active: false,
    kind: 'sandwich',
    side: -1,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    rot: 0,
    spin: 0,
    life: 0,
  }))
  private readonly particles = make<Particle>(PARTICLE_MAX, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    max: 1,
    size: 1,
    color: '#fff',
    rect: false,
    rot: 0,
  }))
  private readonly flashes = make<Flash>(FLASH_MAX, () => ({
    active: false,
    x: 0,
    y: 0,
    angle: 0,
    life: 0,
  }))
  private readonly popups = make<Popup>(POPUP_MAX, () => ({
    active: false,
    x: 0,
    y: 0,
    life: 0,
    max: 1,
    text: '',
    color: '#fff',
    size: 1,
  }))
  private readonly trailX = new Float32Array(TRAIL_MAX)
  private readonly trailY = new Float32Array(TRAIL_MAX)
  private readonly trailT = new Float64Array(TRAIL_MAX)
  private trailHead = 0
  private trailCount = 0
  private shake = 0
  private redFlash = 0
  private lastTime = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly scene: SceneId,
    private readonly reduced: boolean,
    private readonly labels: PopupLabels,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!
  }

  /** Medidas en píxeles CSS; `dpr` es la definición que se usa (baja sola si el celular va lento). */
  resize(cssW: number, cssH: number, dpr: number, fieldH: number) {
    this.width = Math.max(1, Math.round(cssW * dpr))
    this.height = Math.max(1, Math.round(cssH * dpr))
    this.canvas.width = this.width
    this.canvas.height = this.height
    this.canvas.style.width = `${cssW}px`
    this.canvas.style.height = `${cssH}px`
    this.scale = Math.min(this.width / FIELD_W, this.height / fieldH)
    this.offX = (this.width - FIELD_W * this.scale) / 2
    // Alineado abajo: lo que sobra arriba es lugar para el HUD y los objetos salen "de abajo".
    this.offY = this.height - fieldH * this.scale
    this.buildBackground()
    this.buildSprites()
  }

  private buildBackground() {
    this.bg.width = this.width
    this.bg.height = this.height
    const b = this.bg.getContext('2d')!
    drawScene(b, this.width, this.height, this.scene)
    for (const [canvas, inner, outer] of [
      [this.frost, 'rgba(120,200,255,0)', 'rgba(120,200,255,0.5)'],
      [this.glow, 'rgba(255,200,60,0)', 'rgba(255,190,40,0.5)'],
    ] as const) {
      canvas.width = this.width
      canvas.height = this.height
      const g = canvas.getContext('2d')!
      const grad = g.createRadialGradient(
        this.width / 2,
        this.height / 2,
        Math.min(this.width, this.height) * 0.25,
        this.width / 2,
        this.height / 2,
        Math.max(this.width, this.height) * 0.7,
      )
      grad.addColorStop(0, inner)
      grad.addColorStop(1, outer)
      g.fillStyle = grad
      g.fillRect(0, 0, this.width, this.height)
    }
  }

  private buildSprites() {
    const radius = ITEM_RADIUS * this.scale
    if (Math.abs(radius - this.spriteScale) < 0.5 && this.sprites.size) return
    this.spriteScale = radius
    const size = Math.ceil(radius * 2 * 1.5)
    const paint = (draw: (ctx: CanvasRenderingContext2D) => void) => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const c = canvas.getContext('2d')!
      c.translate(size / 2, size / 2)
      c.scale(radius, radius)
      draw(c)
      return canvas
    }
    this.sprites = new Map()
    for (const kind of KINDS) {
      this.sprites.set(kind, {
        whole: paint((c) => drawWhole(c, kind)),
        top: paint((c) => drawHalf(c, kind, -1)),
        bottom: paint((c) => drawHalf(c, kind, 1)),
      })
    }
  }

  /** De la pantalla (px CSS relativos al canvas) al campo de juego. */
  toField(cssX: number, cssY: number, dpr: number): [number, number] {
    return [(cssX * dpr - this.offX) / this.scale, (cssY * dpr - this.offY) / this.scale]
  }

  // ---- estela del dedo -------------------------------------------------------------------

  addTrail(x: number, y: number, now: number) {
    this.trailX[this.trailHead] = x
    this.trailY[this.trailHead] = y
    this.trailT[this.trailHead] = now
    this.trailHead = (this.trailHead + 1) % TRAIL_MAX
    this.trailCount = Math.min(TRAIL_MAX, this.trailCount + 1)
  }

  endTrail() {
    this.trailCount = 0
  }

  // ---- eventos del motor -----------------------------------------------------------------

  ingest(events: readonly GameEvent[], state: GameState) {
    for (const event of events) {
      switch (event.t) {
        case 'cut':
          this.splitItem(event.kind, event.x, event.y, event.vx, event.vy, event.angle, 1)
          this.addFlash(event.x, event.y, event.angle)
          this.addPopup(
            event.x,
            event.y - 6,
            event.mult > 1 ? `+${event.points} x${event.mult}` : `+${event.points}`,
            event.kind === 'golden' ? GOLD : CREAM,
            event.mult > 1 ? 1.25 : 1,
          )
          break
        case 'bomb':
          this.splitItem('ant', event.x, event.y, event.vx, event.vy, event.angle, 1.4)
          this.addFlash(event.x, event.y, event.angle)
          this.redFlash = 1
          if (!this.reduced) this.shake = 1
          break
        case 'combo':
          this.addPopup(event.x, event.y - 16, this.labels.stroke(event.n, event.bonus), GOLD, 1.5)
          break
        case 'miss':
          this.addPopup(
            Math.max(14, Math.min(FIELD_W - 14, event.x)),
            state.height - 14,
            this.labels.miss,
            '#ffb4a8',
            1,
          )
          break
        case 'life':
          this.addPopup(FIELD_W / 2, state.height * 0.4, this.labels.life, '#ffd0d6', 1.4)
          break
        case 'frenzy':
          this.addPopup(FIELD_W / 2, state.height * 0.34, this.labels.frenzy, GOLD, 2)
          break
        case 'freeze':
          this.addPopup(FIELD_W / 2, state.height * 0.34, this.labels.freeze, '#bfe6fb', 1.7)
          break
        case 'goal':
          this.addPopup(FIELD_W / 2, state.height * 0.3, this.labels.goal, '#c9f2a6', 1.7)
          break
        default:
      }
    }
  }

  private splitItem(
    kind: ItemKind,
    x: number,
    y: number,
    vx: number,
    vy: number,
    angle: number,
    power: number,
  ) {
    // La normal del tajo: cada mitad se va para su lado.
    const nx = -Math.sin(angle)
    const ny = Math.cos(angle)
    for (const side of [-1, 1] as const) {
      const half = this.halves.find((h) => !h.active)
      if (!half) break
      half.active = true
      half.kind = kind
      half.side = side
      half.x = x
      half.y = y
      half.vx = vx * 0.5 + nx * side * 16 * power
      half.vy = vy * 0.5 + ny * side * 16 * power - 6
      half.rot = angle
      half.spin = side * (2.5 + Math.abs(vx) * 0.04) * (this.reduced ? 0.3 : 1)
      half.life = 1.6
    }
    // Gotas, migas y el café que se derrama.
    const colors = SPLASH[kind]
    const count = this.reduced ? 6 : kind === 'cafe' || kind === 'ice' ? 22 : 16
    for (let i = 0; i < count; i++) {
      const p = this.particles.find((q) => !q.active)
      if (!p) break
      const a = (i / count) * Math.PI * 2 + angle
      const speed = 12 + ((i * 37) % 23)
      p.active = true
      p.x = x
      p.y = y
      p.vx = Math.cos(a) * speed + vx * 0.3
      p.vy = Math.sin(a) * speed - 8
      p.max = p.life = 0.5 + ((i * 13) % 6) * 0.1
      p.size = 0.8 + ((i * 7) % 5) * 0.35
      p.color = colors[i % 2]!
      p.rect = kind === 'sandwich' || kind === 'chipa' ? i % 3 === 0 : false
      p.rot = i
    }
  }

  private addFlash(x: number, y: number, angle: number) {
    const f = this.flashes.find((q) => !q.active)
    if (!f) return
    f.active = true
    f.x = x
    f.y = y
    f.angle = angle
    f.life = 1
  }

  private addPopup(x: number, y: number, text: string, color: string, size: number) {
    // Si todos están ocupados se reutiliza el más viejo.
    let p = this.popups.find((q) => !q.active)
    if (!p) p = this.popups.reduce((a, b) => (a.life < b.life ? a : b))
    p.active = true
    p.x = Math.max(24, Math.min(FIELD_W - 24, x))
    p.y = y
    p.text = text
    p.color = color
    p.size = size
    p.max = p.life = size > 1.4 ? 1.3 : 0.8
  }

  // ---- cuadro ----------------------------------------------------------------------------

  render(state: GameState, now: number) {
    const dtReal = this.lastTime ? Math.min((now - this.lastTime) / 1000, 0.05) : 0
    this.lastTime = now
    const dt = dtReal * timeScale(state)
    const { ctx, scale } = this

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = 1
    ctx.drawImage(this.bg, 0, 0)

    let sx = 0
    let sy = 0
    if (this.shake > 0) {
      sx = (Math.random() - 0.5) * this.shake * 14
      sy = (Math.random() - 0.5) * this.shake * 14
      this.shake = Math.max(0, this.shake - dtReal * 3.5)
    }
    const ox = this.offX + sx
    const oy = this.offY + sy

    // Cosas enteras.
    for (const item of state.items) {
      if (!item.active) continue
      const sprite = this.sprites.get(item.kind)!.whole
      const c = Math.cos(item.rot)
      const s = Math.sin(item.rot)
      ctx.setTransform(c, s, -s, c, ox + item.x * scale, oy + item.y * scale)
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2)
    }

    // Mitades.
    const g = state.gravity
    for (const h of this.halves) {
      if (!h.active) continue
      h.vy += g * dt
      h.x += h.vx * dt
      h.y += h.vy * dt
      h.rot += h.spin * dt
      h.life -= dtReal
      if (h.life <= 0 || h.y > state.height + 20) {
        h.active = false
        continue
      }
      const sprites = this.sprites.get(h.kind)!
      const sprite = h.side < 0 ? sprites.top : sprites.bottom
      const c = Math.cos(h.rot)
      const s = Math.sin(h.rot)
      ctx.setTransform(c, s, -s, c, ox + h.x * scale, oy + h.y * scale)
      ctx.globalAlpha = Math.min(1, h.life * 2.5)
      ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2)
    }
    ctx.globalAlpha = 1

    // Gotas y migas.
    ctx.setTransform(1, 0, 0, 1, ox, oy)
    for (const p of this.particles) {
      if (!p.active) continue
      p.vy += g * 0.55 * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.life -= dtReal
      if (p.life <= 0) {
        p.active = false
        continue
      }
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.6)
      ctx.fillStyle = p.color
      if (p.rect) {
        ctx.fillRect(
          (p.x - p.size) * scale,
          (p.y - p.size * 0.6) * scale,
          p.size * 2 * scale,
          p.size * 1.2 * scale,
        )
      } else {
        ctx.beginPath()
        ctx.arc(p.x * scale, p.y * scale, p.size * scale, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1

    // Destello del corte.
    ctx.lineCap = 'round'
    for (const f of this.flashes) {
      if (!f.active) continue
      f.life -= dtReal * 6
      if (f.life <= 0) {
        f.active = false
        continue
      }
      const len = ITEM_RADIUS * (1.4 + (1 - f.life) * 1.4)
      const dx = Math.cos(f.angle) * len * scale
      const dy = Math.sin(f.angle) * len * scale
      ctx.globalAlpha = f.life
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = Math.max(2, scale * 1.4 * f.life)
      ctx.beginPath()
      ctx.moveTo(f.x * scale - dx, f.y * scale - dy)
      ctx.lineTo(f.x * scale + dx, f.y * scale + dy)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // Estela del dedo.
    if (this.trailCount > 1) {
      for (let pass = 0; pass < 2; pass++) {
        ctx.strokeStyle = pass === 0 ? 'rgba(255,255,255,0.28)' : CREAM
        for (let i = 1; i < this.trailCount; i++) {
          const a = (this.trailHead - 1 - i + TRAIL_MAX * 2) % TRAIL_MAX
          const b = (a + 1) % TRAIL_MAX
          const age = now - this.trailT[b]!
          if (age > TRAIL_MS) break
          const k = 1 - age / TRAIL_MS
          ctx.lineWidth = Math.max(1.5, scale * (pass === 0 ? 3.6 : 1.5) * k)
          ctx.beginPath()
          ctx.moveTo(this.trailX[a]! * scale, this.trailY[a]! * scale)
          ctx.lineTo(this.trailX[b]! * scale, this.trailY[b]! * scale)
          ctx.stroke()
        }
      }
    }

    // Carteles.
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const p of this.popups) {
      if (!p.active) continue
      p.life -= dtReal
      if (p.life <= 0) {
        p.active = false
        continue
      }
      const t = 1 - p.life / p.max
      const pop = this.reduced ? 1 : Math.min(1, t * 6) * 0.35 + 0.65
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 2.5)
      ctx.font = `${Math.round(scale * 4.6 * p.size * pop)}px "Bebas Neue", Poppins, system-ui, sans-serif`
      const y = (p.y - t * (this.reduced ? 0 : 7)) * scale
      ctx.lineWidth = scale * 1.1
      ctx.strokeStyle = 'rgba(42,26,20,0.85)'
      ctx.lineJoin = 'round'
      ctx.strokeText(p.text, p.x * scale, y)
      ctx.fillStyle = p.color
      ctx.fillText(p.text, p.x * scale, y)
    }
    ctx.globalAlpha = 1

    // Capas de ambiente: frenesí dorado, cámara lenta helada y golpe de hormiga.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    if (state.frenzyTicks > 0) {
      const pulse = this.reduced ? 0.6 : 0.65 + 0.35 * Math.sin(now / 120)
      ctx.globalAlpha = Math.min(1, state.frenzyTicks / 30) * pulse
      ctx.drawImage(this.glow, 0, 0)
    }
    if (state.freezeTicks > 0) {
      ctx.globalAlpha = Math.min(1, state.freezeTicks / 30)
      ctx.drawImage(this.frost, 0, 0)
      ctx.fillStyle = 'rgba(120,190,255,0.12)'
      ctx.fillRect(0, 0, this.width, this.height)
    }
    if (this.redFlash > 0) {
      ctx.globalAlpha = this.redFlash * (this.reduced ? 0.25 : 0.45)
      ctx.fillStyle = RED
      ctx.fillRect(0, 0, this.width, this.height)
      this.redFlash = Math.max(0, this.redFlash - dtReal * 3)
    }
    ctx.globalAlpha = 1
  }

  /** Vuelve todo a cero (al reiniciar el nivel). */
  reset() {
    for (const h of this.halves) h.active = false
    for (const p of this.particles) p.active = false
    for (const f of this.flashes) f.active = false
    for (const p of this.popups) p.active = false
    this.trailCount = 0
    this.shake = 0
    this.redFlash = 0
    this.lastTime = 0
  }
}
