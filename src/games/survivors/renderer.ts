// Dibujo de "Sobreviví a las migas" sobre canvas 2D.
// La simulación (compartida con el servidor) no sabe nada de esto: acá viven los efectos que solo
// "se sienten" (partículas, vibración de pantalla, destellos). Todo usa Math.random porque no afecta la partida.

import { ARENA_H, ARENA_W, PLAYER_RADIUS } from '@engine/config.ts'
import { ANT, FLY, PIGEON, QUEEN } from '@engine/config.ts'
import {
  MAX_ENEMIES,
  ORBITER_RADIUS,
  orbiterPositions,
  type Enemy,
  type GameEvent,
  type GameState,
} from '@engine/sim.ts'
import { buildSprites, type SpriteSet } from './sprites.ts'

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
  square: boolean
}

interface Ring {
  x: number
  y: number
  age: number
  color: string
}

export interface JoystickView {
  active: boolean
  originX: number
  originY: number
  x: number
  y: number
}

const MAX_PARTICLES = 220
const CONDIMENTS = ['#d6281c', '#f2b705', '#5aa02c']
const COLORS = {
  chipa: ['#f3c677', '#ffe9b0', '#d99a3a'],
  bait: ['#f7c948', '#ffe9b0', '#fff'],
  kill: ['#2a1a14', '#5b3b2e', '#fff2cf'],
  fly: ['#2d4b3d', '#9fe6c8', '#ffffff'],
  pigeon: ['#8d97a6', '#c9d0da', '#ffffff'],
  queen: ['#7a1020', '#f7c948', '#ff5a4a'],
  hurt: ['#c8102e', '#ff8a8a'],
  gem: ['#ffe58a', '#ffffff'],
  hit: ['#ffffff', '#fff2cf'],
}

export class SurvivorsRenderer {
  private ctx: CanvasRenderingContext2D
  private sprites: SpriteSet
  private scale = 1
  private particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 2,
    color: '#fff',
    square: false,
  }))
  private rings: Ring[] = []
  private shake = 0
  private hurtFlash = 0
  private lastRender = 0
  private angles = new Float32Array(MAX_ENEMIES)
  private drawOrder: number[] = []

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly reducedMotion: boolean,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!
    this.sprites = buildSprites(1)
  }

  /** `cssWidth` es el ancho del canvas en píxeles CSS; el alto sale de la proporción de la arena. */
  resize(cssWidth: number, devicePixelRatio: number) {
    const scale = (cssWidth * devicePixelRatio) / ARENA_W
    this.canvas.width = Math.round(ARENA_W * scale)
    this.canvas.height = Math.round(ARENA_H * scale)
    this.canvas.style.width = `${cssWidth}px`
    this.canvas.style.height = `${(cssWidth * ARENA_H) / ARENA_W}px`
    if (Math.abs(scale - this.scale) > 0.001 || this.sprites.scale !== scale) {
      this.scale = scale
      this.sprites = buildSprites(scale)
    }
    this.ctx.imageSmoothingEnabled = true
    this.ctx.imageSmoothingQuality = 'high'
  }

  private burst(
    x: number,
    y: number,
    colors: string[],
    count: number,
    speed: number,
    square = false,
  ) {
    const amount = this.reducedMotion ? Math.ceil(count / 3) : count
    for (let i = 0; i < amount; i++) {
      const slot = this.particles.find((p) => !p.active)
      if (!slot) return
      const angle = Math.random() * Math.PI * 2
      const v = speed * (0.4 + Math.random() * 0.8)
      slot.active = true
      slot.x = x
      slot.y = y
      slot.vx = Math.cos(angle) * v
      slot.vy = Math.sin(angle) * v
      slot.maxLife = slot.life = 0.35 + Math.random() * 0.3
      slot.size = 1.6 + Math.random() * 2.4
      slot.color = colors[Math.floor(Math.random() * colors.length)] ?? '#fff'
      slot.square = square
    }
  }

  /** Convierte los eventos de la simulación en sensaciones: partículas, vibración, anillos. */
  ingest(events: readonly GameEvent[], state: GameState) {
    for (const event of events) {
      switch (event.t) {
        case 'kill': {
          const palette =
            event.kind === QUEEN
              ? COLORS.queen
              : event.kind === PIGEON
                ? COLORS.pigeon
                : event.kind === FLY
                  ? COLORS.fly
                  : COLORS.kill
          this.burst(
            event.x,
            event.y,
            palette,
            event.kind === QUEEN ? 60 : 9,
            event.kind === QUEEN ? 150 : 90,
          )
          if (event.kind === QUEEN) this.addShake(8)
          break
        }
        case 'hit':
          this.burst(event.x, event.y, COLORS.hit, 3, 60)
          break
        case 'gem':
          this.burst(event.x, event.y, COLORS.gem, 3, 50, true)
          break
        case 'hurt':
          this.hurtFlash = 1
          this.addShake(6)
          this.burst(state.player.x, state.player.y, COLORS.hurt, 12, 110)
          break
        case 'levelup':
          this.rings.push({ x: state.player.x, y: state.player.y, age: 0, color: '#f7c948' })
          break
        case 'boss':
          this.addShake(9)
          break
        case 'charge':
          this.burst(event.x, event.y, COLORS.pigeon, 4, 50)
          break
        case 'soldier':
          this.burst(event.x, event.y, CONDIMENTS, 8, 70)
          this.rings.push({ x: event.x, y: event.y, age: 0.25, color: '#d6281c' })
          break
        case 'bait':
          this.burst(event.x, event.y, COLORS.bait, 10, 80)
          break
        case 'boom':
          this.burst(
            event.x,
            event.y,
            event.kind === 1 ? COLORS.chipa : COLORS.bait,
            event.kind === 1 ? 10 : 36,
            event.kind === 1 ? 90 : 170,
            true,
          )
          this.rings.push({
            x: event.x,
            y: event.y,
            age: event.kind === 1 ? 0.3 : 0.1,
            color: event.kind === 1 ? '#d99a3a' : '#f7c948',
          })
          this.addShake(event.kind === 1 ? 2 : 6)
          break
        default:
      }
    }
  }

  private addShake(amount: number) {
    if (!this.reducedMotion) this.shake = Math.max(this.shake, amount)
  }

  private drawSprite(image: HTMLCanvasElement, x: number, y: number, angle = 0) {
    const s = this.scale
    const ctx = this.ctx
    const w = image.width / s
    const h = image.height / s
    if (angle === 0) {
      ctx.drawImage(image, (x - w / 2) * s, (y - h / 2) * s, image.width, image.height)
    } else {
      ctx.save()
      ctx.translate(x * s, y * s)
      ctx.rotate(angle)
      ctx.drawImage(image, -image.width / 2, -image.height / 2)
      ctx.restore()
    }
  }

  private drawShadow(x: number, y: number, radius: number) {
    const ctx = this.ctx
    const s = this.scale
    ctx.fillStyle = 'rgba(42,26,20,0.18)'
    ctx.beginPath()
    ctx.ellipse(
      x * s,
      (y + radius * 0.75) * s,
      radius * 0.95 * s,
      radius * 0.4 * s,
      0,
      0,
      Math.PI * 2,
    )
    ctx.fill()
  }

  private enemySprite(e: Enemy, tick: number): HTMLCanvasElement {
    const sp = this.sprites
    const flash = e.flash > 0 || (e.kind === PIGEON && e.timer > 0 && e.timer < 28 && tick % 8 < 4)
    switch (e.kind) {
      case FLY:
        return flash ? sp.flyFlash : sp.fly[tick % 6 < 3 ? 0 : 1]
      case PIGEON:
        return flash ? sp.pigeonFlash : sp.pigeon
      case QUEEN:
        return flash ? sp.queenFlash : sp.queen
      case ANT:
      default:
        return flash ? sp.antFlash : sp.ant[Math.floor(tick / 5) % 2 === 0 ? 0 : 1]
    }
  }

  /** Soldados miga: cuerpito de pan con gorrito y un frasco de condimento. */
  private drawSoldiers(state: GameState, lerp: (a: number, b: number) => number, now: number) {
    const ctx = this.ctx
    const s = this.scale
    for (const soldier of state.soldiers) {
      if (!soldier.alive) continue
      const x = lerp(soldier.px, soldier.x)
      const y = lerp(soldier.py, soldier.y) - Math.abs(Math.sin(now / 130 + soldier.slot)) * 2
      const fade = soldier.life < 60 ? soldier.life / 60 : 1
      ctx.globalAlpha = fade
      this.drawShadow(x, y, 8)
      ctx.fillStyle = '#e8c27a'
      ctx.beginPath()
      ctx.ellipse(x * s, y * s, 8 * s, 9 * s, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#c8102e'
      ctx.fillRect((x - 7) * s, (y - 12) * s, 14 * s, 5 * s)
      ctx.fillStyle = INK
      for (const dx of [-3, 3]) {
        ctx.beginPath()
        ctx.arc((x + dx) * s, (y - 1) * s, 1.4 * s, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = CONDIMENTS[soldier.slot % CONDIMENTS.length] ?? '#d6281c'
      ctx.fillRect((x + 6) * s, (y - 2) * s, 4 * s, 8 * s)
      ctx.globalAlpha = 1
    }
  }

  /** Chipás que caen: sombra que crece en el piso y bolita de queso que baja. */
  private drawChipas(state: GameState) {
    const ctx = this.ctx
    const s = this.scale
    for (const chipa of state.chipas) {
      if (!chipa.alive) continue
      const k = 1 - chipa.t / 18
      ctx.fillStyle = `rgba(42,26,20,${0.1 + 0.15 * k})`
      ctx.beginPath()
      ctx.ellipse(chipa.x * s, chipa.y * s, (10 + 28 * k) * s, (4 + 11 * k) * s, 0, 0, Math.PI * 2)
      ctx.fill()
      const y = chipa.y - (1 - k) * (1 - k) * 140
      ctx.fillStyle = '#e9b765'
      ctx.beginPath()
      ctx.arc(chipa.x * s, y * s, 8 * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff2cf'
      ctx.beginPath()
      ctx.arc((chipa.x - 2.5) * s, (y - 2.5) * s, 2.5 * s, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  /** Medialuna de cebo con aro pulsante que marca hasta dónde atrae. */
  private drawBait(state: GameState, now: number) {
    const bait = state.bait
    if (!bait.alive) return
    const ctx = this.ctx
    const s = this.scale
    const pulse = 0.5 + 0.5 * Math.sin(now / 120)
    const urgent = bait.life < 60
    ctx.strokeStyle = urgent ? '#c8102e' : '#f7c948'
    ctx.globalAlpha = 0.25 + 0.25 * pulse
    ctx.lineWidth = 2 * s
    ctx.beginPath()
    ctx.arc(bait.x * s, bait.y * s, (30 + pulse * 6) * s, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
    this.drawShadow(bait.x, bait.y, 11)
    // Medialuna: arco grueso de puntas redondas.
    ctx.strokeStyle = urgent && Math.floor(bait.life / 6) % 2 === 0 ? '#fff2cf' : '#e9a948'
    ctx.lineWidth = 7 * s
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(bait.x * s, (bait.y + 3) * s, 8 * s, Math.PI * 1.1, Math.PI * 1.9)
    ctx.stroke()
    ctx.lineCap = 'butt'
  }

  render(state: GameState, alpha: number, joystick: JoystickView, now: number) {
    const ctx = this.ctx
    const s = this.scale
    const dt = this.lastRender ? Math.min((now - this.lastRender) / 1000, 0.05) : 0.016
    this.lastRender = now
    const lerp = (a: number, b: number) => a + (b - a) * alpha

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.drawImage(this.sprites.background, 0, 0)

    if (this.shake > 0.05) {
      ctx.translate((Math.random() - 0.5) * this.shake * s, (Math.random() - 0.5) * this.shake * s)
      this.shake *= Math.pow(0.001, dt) // cae rápido (≈ 0,35 s)
    } else {
      this.shake = 0
    }

    // Gemas.
    const bob = Math.sin(now / 220)
    for (const g of state.gems) {
      if (!g.alive) continue
      const gx = lerp(g.px, g.x)
      const gy = lerp(g.py, g.y) + (g.magnet ? 0 : bob * 1.2)
      this.drawSprite(this.sprites.gem, gx, gy)
    }

    // Enemigos, de arriba hacia abajo para que se tapen bien.
    const order = this.drawOrder
    order.length = 0
    for (let i = 0; i < state.enemies.length; i++) {
      const e = state.enemies[i]!
      if (!e.alive) continue
      const dx = e.x - e.px
      const dy = e.y - e.py
      if (dx * dx + dy * dy > 0.01) this.angles[i] = Math.atan2(dy, dx)
      order.push(i)
    }
    order.sort((a, b) => state.enemies[a]!.y - state.enemies[b]!.y)
    for (const index of order) {
      const e = state.enemies[index]!
      const x = lerp(e.px, e.x)
      const y = lerp(e.py, e.y)
      if (e.kind === QUEEN) {
        const pulse = 0.5 + 0.5 * Math.sin(now / 160)
        ctx.fillStyle = `rgba(200,16,46,${0.1 + pulse * 0.08})`
        ctx.beginPath()
        ctx.arc(x * s, y * s, (e.r + 12 + pulse * 5) * s, 0, Math.PI * 2)
        ctx.fill()
      }
      this.drawShadow(x, y, e.r)
      this.drawSprite(this.enemySprite(e, state.tick), x, y, this.angles[index] ?? 0)
      if ((e.kind === QUEEN || e.kind === PIGEON) && e.hp < e.maxHp) {
        const w = e.r * 2
        ctx.fillStyle = 'rgba(42,26,20,0.55)'
        ctx.fillRect((x - w / 2) * s, (y - e.r - 9) * s, w * s, 4 * s)
        ctx.fillStyle = e.kind === QUEEN ? '#c8102e' : '#6d788a'
        ctx.fillRect((x - w / 2) * s, (y - e.r - 9) * s, (w * s * e.hp) / e.maxHp, 4 * s)
      }
    }

    this.drawBait(state, now)

    // Tostadas giratorias.
    for (const [ox, oy] of orbiterPositions(state)) {
      this.drawShadow(ox, oy, ORBITER_RADIUS)
      this.drawSprite(this.sprites.toast, ox, oy, state.tick * 0.08)
    }

    // Jugador.
    const p = state.player
    const px = lerp(p.px, p.x)
    const py = lerp(p.py, p.y)
    const flicker = p.invuln > 0 && Math.floor(p.invuln / 4) % 2 === 0
    if (!flicker) {
      this.drawShadow(px, py, PLAYER_RADIUS + 2)
      const hop = Math.abs(Math.sin(now / 110)) * (p.px !== p.x || p.py !== p.y ? 2.2 : 0.6)
      this.drawSprite(this.sprites.player, px, py - hop)
      ctx.fillStyle = INK
      for (const dx of [-6, 6]) {
        ctx.beginPath()
        ctx.arc(
          (px + dx + p.faceX * 1.7) * s,
          (py - hop - 5 + p.faceY * 1.7) * s,
          1.9 * s,
          0,
          Math.PI * 2,
        )
        ctx.fill()
      }
    }

    this.drawSoldiers(state, lerp, now)

    // Migas y condimentos.
    for (const q of state.projectiles) {
      if (!q.alive) continue
      if (q.tag === 1) {
        ctx.fillStyle = CONDIMENTS[(q.life >> 2) % CONDIMENTS.length] ?? '#d6281c'
        ctx.beginPath()
        ctx.arc(lerp(q.px, q.x) * s, lerp(q.py, q.y) * s, 3.2 * s, 0, Math.PI * 2)
        ctx.fill()
      } else {
        this.drawSprite(this.sprites.crumb, lerp(q.px, q.x), lerp(q.py, q.y))
      }
    }

    this.drawChipas(state)

    // Partículas y anillos.
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
      ctx.globalAlpha = Math.min(1, (part.life / part.maxLife) * 1.4)
      ctx.fillStyle = part.color
      const size = part.size * s
      if (part.square) ctx.fillRect(part.x * s - size / 2, part.y * s - size / 2, size, size)
      else {
        ctx.beginPath()
        ctx.arc(part.x * s, part.y * s, size / 2, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
    this.rings = this.rings.filter((r) => (r.age += dt) < 0.55)
    for (const ring of this.rings) {
      ctx.globalAlpha = 1 - ring.age / 0.55
      ctx.strokeStyle = ring.color
      ctx.lineWidth = 3 * s
      ctx.beginPath()
      ctx.arc(ring.x * s, ring.y * s, (12 + ring.age * 150) * s, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    ctx.setTransform(1, 0, 0, 1, 0, 0)

    // Pulso rojo en los bordes: al recibir un golpe y cuando queda poca vida.
    const low = p.hp <= 2 && !this.reducedMotion ? 0.12 + 0.08 * Math.sin(now / 240) : 0
    const flash = Math.max(this.hurtFlash * 0.35, low)
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3)
    if (flash > 0.01) {
      const w = this.canvas.width
      const h = this.canvas.height
      const gradient = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.62)
      gradient.addColorStop(0, 'rgba(200,16,46,0)')
      gradient.addColorStop(1, `rgba(200,16,46,${flash})`)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, w, h)
    }

    // Joystick virtual.
    if (joystick.active) {
      ctx.globalAlpha = 0.5
      ctx.strokeStyle = '#2a1a14'
      ctx.lineWidth = 2.5 * s
      ctx.beginPath()
      ctx.arc(joystick.originX * s, joystick.originY * s, 34 * s, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = 'rgba(42,26,20,0.55)'
      ctx.beginPath()
      ctx.arc(joystick.x * s, joystick.y * s, 15 * s, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }
}

const INK = '#2a1a14'
