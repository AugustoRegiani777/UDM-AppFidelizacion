// Dibujo de "Skate de Miga" sobre canvas 2D (vista 640×360, siempre en horizontal).
// La simulación no sabe nada de esto: acá viven los efectos que solo "se sienten" (partículas, vibración
// de pantalla, textos flotantes, la caída). Todo usa Math.random porque no afecta la partida.

import { type TrickName } from '@skate/config.ts'
import { type SkateEvent, type SkateState } from '@skate/sim.ts'
import { STEP, type Terrain } from '@skate/terrain.ts'
import { drawHero } from '../shared/hero.ts'
import type { ThumbsView } from './input.ts'

/** Ancho mínimo de la vista (16:9); en pantallas más largas la vista se ensancha hasta 21:9. */
export const BASE_VIEW_W = 640
export const VIEW_H = 360
const MAX_ASPECT = 21 / 9

const HERO_SCALE = 0.62
const INK = '#2a1a14'
const CREAM = '#faf3e3'
const RED = '#c8102e'

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
}

interface Popup {
  text: string
  /** Altura relativa al patinador (negativo = arriba). */
  y: number
  age: number
  color: string
}

interface Ghost {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  spin: number
  age: number
}

export interface TrickLabels {
  tricks: Record<TrickName, string>
  checkpoint: string
  bail: string
  finish: string
  turbo: string
}

const SKYLINE: readonly (readonly [number, number, number, boolean?])[] = [
  [0, 70, 60],
  [80, 50, 95],
  [140, 90, 70],
  [245, 44, 112, true],
  [300, 110, 66],
  [420, 60, 88],
  [490, 80, 124],
  [580, 50, 72],
  [640, 100, 92],
  [750, 60, 66],
  [820, 90, 106, true],
  [920, 70, 82],
  [1000, 100, 62],
]
const SKYLINE_PERIOD = 1110
const PALM_PERIOD = 430

const PARTICLE_POOL = 200

export class SkateRenderer {
  private ctx: CanvasRenderingContext2D
  private scale = 1
  /** Ancho actual de la vista en unidades del juego. */
  viewW = BASE_VIEW_W
  private hero: HTMLCanvasElement
  private camX = 0
  private camY = 0
  private camReady = false
  private angle = 0
  private lastRender = 0
  private shake = 0
  private flash = 0
  private trick: { name: TrickName; age: number } | null = null
  private ghost: Ghost | null = null
  private respawnGlow = 0
  private popups: Popup[] = []
  private particles: Particle[] = Array.from({ length: PARTICLE_POOL }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    life: 0,
    maxLife: 1,
    size: 2,
    color: '#fff',
  }))
  private hintAge = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly reducedMotion: boolean,
    private readonly labels: TrickLabels,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!
    this.hero = this.makeHero(1)
  }

  private makeHero(scale: number): HTMLCanvasElement {
    const canvas = document.createElement('canvas')
    const size = 44 * HERO_SCALE * scale
    canvas.width = Math.ceil(size)
    canvas.height = Math.ceil(size)
    const ctx = canvas.getContext('2d')!
    ctx.scale(scale * HERO_SCALE, scale * HERO_SCALE)
    ctx.translate(22, 22)
    drawHero(ctx)
    return canvas
  }

  /** Ajusta el canvas al contenedor: 16:9 como mínimo, más ancho en pantallas largas, sin franjas. */
  resize(containerWidth: number, containerHeight: number, devicePixelRatio: number) {
    const aspect = Math.min(MAX_ASPECT, Math.max(16 / 9, containerWidth / containerHeight))
    const cssHeight = Math.min(containerHeight, containerWidth / aspect)
    const cssWidth = cssHeight * aspect
    this.viewW = VIEW_H * aspect
    const scale = (cssHeight * devicePixelRatio) / VIEW_H
    this.canvas.width = Math.round(this.viewW * scale)
    this.canvas.height = Math.round(VIEW_H * scale)
    this.canvas.style.width = `${cssWidth}px`
    this.canvas.style.height = `${cssHeight}px`
    if (Math.abs(scale - this.scale) > 0.001) {
      this.scale = scale
      this.hero = this.makeHero(scale)
    }
    this.ctx.imageSmoothingEnabled = true
    this.ctx.imageSmoothingQuality = 'high'
  }

  private burst(x: number, y: number, colors: string[], count: number, speed: number, up = 0) {
    const amount = this.reducedMotion ? Math.ceil(count / 3) : count
    for (let i = 0; i < amount; i++) {
      const slot = this.particles.find((p) => !p.active)
      if (!slot) return
      const angle = Math.random() * Math.PI * 2
      const v = speed * (0.3 + Math.random() * 0.9)
      slot.active = true
      slot.x = x
      slot.y = y
      slot.vx = Math.cos(angle) * v
      slot.vy = Math.sin(angle) * v - up
      slot.maxLife = slot.life = 0.3 + Math.random() * 0.4
      slot.size = 1.5 + Math.random() * 2.5
      slot.color = colors[Math.floor(Math.random() * colors.length)] ?? '#fff'
    }
  }

  private pop(text: string, y: number, color = RED) {
    this.popups.push({ text, y, age: 0, color })
    if (this.popups.length > 6) this.popups.shift()
  }

  /** Convierte los eventos de la simulación en sensaciones: partículas, textos, caída, vibración. */
  ingest(events: readonly SkateEvent[], state: SkateState) {
    for (const event of events) {
      switch (event.t) {
        case 'jump':
          this.burst(state.x, state.y, ['#e9d8b4', '#fff6e0'], 6, 60)
          break
        case 'trick':
          this.trick = { name: event.name, age: 0 }
          this.pop(this.labels.tricks[event.name], -58 - this.popups.length * 4)
          this.burst(state.x, state.y - 20, ['#f7c948', '#ffffff'], 8, 90)
          break
        case 'land':
          this.trick = null
          this.burst(
            state.x,
            state.y,
            event.quality === 'clean' ? ['#f7c948', '#fff6e0'] : ['#b8a58a'],
            12,
            110,
            40,
          )
          if (event.credit > 0) this.pop(`+${event.credit} ${this.labels.turbo}`, -40, '#c4720a')
          if (event.quality === 'sketchy') this.addShake(2)
          break
        case 'bail':
          this.flash = 1
          this.addShake(8)
          this.trick = null
          this.ghost = {
            x: state.px,
            y: state.py,
            vx: (state.grounded ? state.speed : state.vx) * 0.6 + 40,
            vy: -170,
            rot: 0,
            spin: 9,
            age: 0,
          }
          this.burst(state.px, state.py, [RED, '#ff8a8a', INK], 18, 140, 30)
          this.pop(this.labels.bail, -50, RED)
          this.respawnGlow = 1.4
          break
        case 'stall':
          this.respawnGlow = 1.2
          break
        case 'checkpoint':
          this.pop(this.labels.checkpoint, -70, '#3f7a26')
          this.burst(state.x, state.y - 30, ['#3f7a26', '#9fd68a', '#ffffff'], 14, 100)
          break
        case 'finish':
          this.pop(this.labels.finish, -70, RED)
          this.burst(state.x, state.y - 40, [RED, '#f7c948', '#ffffff', '#3f7a26'], 50, 190, 60)
          break
        case 'boost':
          this.burst(state.x - 10, state.y - 6, ['#ff9a2e', '#ffd25a', '#ffffff'], 3, 70)
          break
        default:
      }
    }
  }

  private addShake(amount: number) {
    if (!this.reducedMotion) this.shake = Math.max(this.shake, amount)
  }

  // --- Fondo ------------------------------------------------------------------------------------------------

  private drawBackground(now: number) {
    const ctx = this.ctx
    const s = this.scale
    const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H * s)
    sky.addColorStop(0, '#fbe3c0')
    sky.addColorStop(0.7, '#fdf3df')
    sky.addColorStop(1, '#f6e4c6')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    ctx.setTransform(s, 0, 0, s, 0, 0)
    ctx.fillStyle = 'rgba(247,201,72,0.55)'
    ctx.beginPath()
    ctx.arc(this.viewW * 0.78, 84 + Math.sin(now / 2400) * 2, 34, 0, Math.PI * 2)
    ctx.fill()

    // Línea de edificios (parallax lento): arcos y cúpulas.
    ctx.fillStyle = 'rgba(200,16,46,0.13)'
    const farShift = -((this.camX * 0.12) % SKYLINE_PERIOD)
    const horizon = 250
    for (let tile = 0; tile < 2; tile++) {
      for (const [x, w, h, dome] of SKYLINE) {
        const px = x + farShift + tile * SKYLINE_PERIOD
        if (px > this.viewW || px + w < 0) continue
        ctx.fillRect(px, horizon - h, w, h + 120)
        if (dome) {
          ctx.beginPath()
          ctx.ellipse(px + w / 2, horizon - h, w / 2, 20, 0, Math.PI, 0)
          ctx.fill()
        }
      }
    }

    // Palmeras (parallax medio).
    ctx.strokeStyle = 'rgba(63,122,38,0.35)'
    ctx.fillStyle = 'rgba(63,122,38,0.3)'
    ctx.lineWidth = 3
    const palmShift = -((this.camX * 0.32) % PALM_PERIOD)
    for (let i = -1; i < 3; i++) {
      const px = palmShift + i * PALM_PERIOD + 120
      if (px < -60 || px > this.viewW + 60) continue
      ctx.beginPath()
      ctx.moveTo(px, 300)
      ctx.quadraticCurveTo(px + 8, 250, px + 4, 205)
      ctx.stroke()
      for (const a of [-1, -0.45, 0.45, 1]) {
        ctx.beginPath()
        ctx.moveTo(px + 4, 205)
        ctx.quadraticCurveTo(px + 4 + a * 22, 188, px + 4 + a * 40, 206)
        ctx.stroke()
      }
    }
  }

  // --- Terreno -----------------------------------------------------------------------------------------------

  private drawTerrain(terrain: Terrain) {
    const ctx = this.ctx
    const first = Math.max(0, Math.floor(this.camX / STEP) - 2)
    const last = Math.min(terrain.ys.length - 2, Math.ceil((this.camX + this.viewW) / STEP) + 2)
    const bottom = this.camY + VIEW_H + 60

    let fill: Path2D | null = null
    let edge: Path2D | null = null
    let runStartX = 0
    let lastX = 0
    const closeRun = () => {
      if (!fill || !edge) return
      fill.lineTo(lastX, bottom)
      fill.lineTo(runStartX, bottom)
      fill.closePath()
      ctx.fillStyle = INK
      ctx.fill(fill)
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.strokeStyle = RED
      ctx.lineWidth = 5
      ctx.stroke(edge)
      ctx.strokeStyle = CREAM
      ctx.lineWidth = 1.6
      ctx.stroke(edge)
      fill = null
      edge = null
    }

    for (let i = first; i <= last; i++) {
      const x0 = i * STEP
      const x1 = x0 + STEP
      const solid = terrain.solid[i] === 1 && terrain.solid[i + 1] === 1
      if (!solid) {
        closeRun()
        continue
      }
      if (!fill || !edge) {
        fill = new Path2D()
        edge = new Path2D()
        runStartX = x0
        fill.moveTo(x0, terrain.ys[i]!)
        edge.moveTo(x0, terrain.ys[i]!)
      }
      fill.lineTo(x1, terrain.ys[i + 1]!)
      edge.lineTo(x1, terrain.ys[i + 1]!)
      lastX = x1
    }
    closeRun()
  }

  private drawLandmarks(state: SkateState) {
    const ctx = this.ctx
    for (const x of state.terrain.checkpoints) {
      if (x === 0 || x < this.camX - 40 || x > this.camX + this.viewW + 40) continue
      const y = state.terrain.ys[Math.round(x / STEP)] ?? 0
      ctx.strokeStyle = INK
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x, y - 62)
      ctx.stroke()
      ctx.fillStyle = x <= state.checkpointX ? '#3f7a26' : RED
      ctx.beginPath()
      ctx.moveTo(x, y - 62)
      ctx.lineTo(x + 30, y - 53)
      ctx.lineTo(x, y - 44)
      ctx.closePath()
      ctx.fill()
    }
    const finish = state.terrain.length
    if (finish > this.camX - 60 && finish < this.camX + this.viewW + 120) {
      const y = state.terrain.ys[state.terrain.ys.length - 1] ?? 0
      ctx.fillStyle = INK
      ctx.fillRect(finish - 44, y - 110, 6, 110)
      ctx.fillRect(finish + 38, y - 110, 6, 110)
      ctx.fillStyle = RED
      ctx.fillRect(finish - 44, y - 118, 94, 26)
      ctx.fillStyle = CREAM
      ctx.font = '22px "Bebas Neue", sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(this.labels.finish.replace(/[¡!]/g, '').toUpperCase(), finish + 3, y - 98)
    }
  }

  // --- Patinador -----------------------------------------------------------------------------------------------

  private drawBoard(trickPhase: number, trick: TrickName | null) {
    const ctx = this.ctx
    ctx.save()
    let dx = 0
    let dy = -6
    let rot = 0
    let sx = 1
    let sy = 1
    const turn = Math.cos(trickPhase * Math.PI * 2)
    switch (trick) {
      case 'kickflip':
        sy = turn
        break
      case 'heelflip':
        sy = -turn
        break
      case 'shuvit':
        sx = turn
        break
      case 'indy':
        dy = -18
        rot = -0.15
        break
      case 'superman':
        dx = -20
        dy = -20
        rot = -0.45
        break
      case 'japan':
        dx = 8
        dy = -26
        rot = 0.55
        break
      default:
    }
    ctx.translate(dx, dy)
    ctx.rotate(rot)
    ctx.scale(sx, sy)
    ctx.fillStyle = RED
    ctx.beginPath()
    ctx.roundRect(-19, -3, 38, 5.5, 2.5)
    ctx.fill()
    ctx.fillStyle = CREAM
    ctx.fillRect(-8, -1.3, 16, 2)
    ctx.fillStyle = INK
    for (const wx of [-12, 12]) {
      ctx.beginPath()
      ctx.arc(wx, 5, 4.3, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  private drawSkater(state: SkateState, x: number, y: number, now: number, dt: number) {
    const ctx = this.ctx
    const target = Math.atan2(state.upX, -state.upY)
    let delta = target - this.angle
    delta = Math.atan2(Math.sin(delta), Math.cos(delta))
    // En el suelo se acomoda con suavidad a la pendiente; en el aire sigue exacto el giro.
    this.angle += delta * (state.grounded ? Math.min(1, dt * 18) : 1)

    if (this.respawnGlow > 0 && Math.floor(now / 90) % 2 === 0) return

    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(this.angle)
    const phase = this.trick ? Math.min(1, this.trick.age / 22) : 0
    this.drawBoard(phase, this.trick?.name ?? null)

    const crouch = state.grounded && state.charge > 0 ? 0.82 : 1
    ctx.translate(0, -24 * crouch)
    ctx.rotate(this.trick?.name === 'superman' ? -0.3 : 0)
    ctx.scale(1, crouch)
    const s = this.scale
    ctx.drawImage(
      this.hero,
      -this.hero.width / (2 * s),
      -this.hero.height / (2 * s),
      this.hero.width / s,
      this.hero.height / s,
    )
    // Pupilas mirando hacia adelante.
    ctx.fillStyle = INK
    for (const px of [-3.6, 3.6]) {
      ctx.beginPath()
      ctx.arc(px + 1.4, -3.2, 1.2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  private drawGhost(dt: number) {
    const g = this.ghost
    if (!g) return
    g.age += dt
    if (g.age > 1.1) {
      this.ghost = null
      return
    }
    g.vy += 900 * dt
    g.x += g.vx * dt
    g.y += g.vy * dt
    g.rot += g.spin * dt
    const ctx = this.ctx
    ctx.save()
    ctx.globalAlpha = Math.max(0, 1 - g.age / 1.1)
    ctx.translate(g.x, g.y)
    ctx.rotate(g.rot)
    const s = this.scale
    ctx.drawImage(
      this.hero,
      -this.hero.width / (2 * s),
      -this.hero.height / (2 * s),
      this.hero.width / s,
      this.hero.height / s,
    )
    ctx.translate(18, 8)
    ctx.rotate(g.rot * -1.7)
    this.drawBoard(0, null)
    ctx.restore()
  }

  // --- Cuadro -----------------------------------------------------------------------------------------------------

  render(state: SkateState, alpha: number, thumbs: ThumbsView, now: number) {
    const ctx = this.ctx
    const s = this.scale
    const dt = this.lastRender ? Math.min((now - this.lastRender) / 1000, 0.05) : 0.016
    this.lastRender = now
    this.respawnGlow = Math.max(0, this.respawnGlow - dt)
    this.hintAge += dt
    if (this.trick) this.trick.age += dt * 60

    const teleported = Math.abs(state.x - state.px) > 150
    const k = teleported ? 1 : alpha
    const x = state.px + (state.x - state.px) * k
    const y = state.py + (state.y - state.py) * k

    // Cámara: sigue al patinador y mira un poco hacia adelante.
    const speed = state.grounded ? state.speed : state.vx
    const targetX = x - this.viewW * 0.36 + speed * 0.2
    const targetY = y - VIEW_H * 0.64
    if (!this.camReady || teleported) {
      this.camX = targetX
      this.camY = targetY
      this.camReady = true
    } else {
      this.camX += (targetX - this.camX) * (1 - Math.exp(-dt * 7))
      this.camY += (targetY - this.camY) * (1 - Math.exp(-dt * 5))
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    this.drawBackground(now)

    let shakeX = 0
    let shakeY = 0
    if (this.shake > 0.05) {
      shakeX = (Math.random() - 0.5) * this.shake
      shakeY = (Math.random() - 0.5) * this.shake
      this.shake *= Math.pow(0.001, dt)
    } else this.shake = 0
    ctx.setTransform(s, 0, 0, s, (-this.camX + shakeX) * s, (-this.camY + shakeY) * s)

    this.drawTerrain(state.terrain)
    this.drawLandmarks(state)

    // Estela de polvo al rodar rápido.
    if (state.grounded && Math.abs(state.speed) > 170 && Math.random() < 0.5) {
      this.burst(x - 12, y - 2, ['#d9c7a4', '#f1e4c8'], 1, 28)
    }

    this.drawGhost(dt)
    if (!this.ghost || this.ghost.age > 0.15) this.drawSkater(state, x, y, now, dt)

    for (const p of this.particles) {
      if (!p.active) continue
      p.life -= dt
      if (p.life <= 0) {
        p.active = false
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += 260 * dt
      p.vx *= 0.96
      ctx.globalAlpha = Math.min(1, (p.life / p.maxLife) * 1.5)
      ctx.fillStyle = p.color
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    ctx.font = '26px "Bebas Neue", sans-serif'
    ctx.textAlign = 'center'
    this.popups = this.popups.filter((p) => (p.age += dt) < 1.1)
    for (const p of this.popups) {
      ctx.globalAlpha = Math.min(1, (1.1 - p.age) * 2)
      ctx.lineWidth = 4
      ctx.strokeStyle = 'rgba(250,243,227,0.9)'
      ctx.strokeText(p.text, x, y + p.y - p.age * 26)
      ctx.fillStyle = p.color
      ctx.fillText(p.text, x, y + p.y - p.age * 26)
    }
    ctx.globalAlpha = 1

    // --- Capa de pantalla (sin cámara) ---
    ctx.setTransform(s, 0, 0, s, 0, 0)
    this.drawScreenEffects(state, dt)
    this.drawThumbs(thumbs)
  }

  private drawScreenEffects(state: SkateState, dt: number) {
    const ctx = this.ctx
    const fast = Math.abs(state.grounded ? state.speed : state.vx)
    if (fast > 430 && !this.reducedMotion) {
      ctx.strokeStyle = 'rgba(42,26,20,0.12)'
      ctx.lineWidth = 1.5
      for (let i = 0; i < 7; i++) {
        const y = 30 + ((i * 53 + this.lastRender / 6) % (VIEW_H - 60))
        const x = 40 + ((i * 131 + this.lastRender / 3) % (this.viewW - 120))
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + 46, y)
        ctx.stroke()
      }
    }
    if (this.flash > 0.01) {
      const gradient = ctx.createRadialGradient(
        this.viewW / 2,
        VIEW_H / 2,
        90,
        this.viewW / 2,
        VIEW_H / 2,
        360,
      )
      gradient.addColorStop(0, 'rgba(200,16,46,0)')
      gradient.addColorStop(1, `rgba(200,16,46,${this.flash * 0.4})`)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, this.viewW, VIEW_H)
      this.flash = Math.max(0, this.flash - dt * 2.5)
    }
  }

  /** Marca de los dos pulgares: guía tenue al principio y el joystick/botón mientras se tocan. */
  private drawThumbs(thumbs: ThumbsView) {
    const ctx = this.ctx
    const hint = Math.max(0, 1 - this.hintAge / 7)
    if (hint > 0 && !thumbs.stick.active) this.drawRing(110, 290, 34, 0.35 * hint)
    if (hint > 0 && !thumbs.button.active) this.drawRing(this.viewW - 110, 290, 34, 0.35 * hint)
    if (thumbs.stick.active) {
      this.drawRing(thumbs.stick.originX, thumbs.stick.originY, 34, 0.45)
      ctx.globalAlpha = 0.6
      ctx.fillStyle = INK
      ctx.beginPath()
      ctx.arc(thumbs.stick.x, thumbs.stick.y, 14, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    if (thumbs.button.active) {
      this.drawRing(thumbs.button.x, thumbs.button.y, 30, 0.55)
      ctx.globalAlpha = 0.35
      ctx.fillStyle = RED
      ctx.beginPath()
      ctx.arc(thumbs.button.x, thumbs.button.y, 24, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }

  private drawRing(x: number, y: number, r: number, alpha: number) {
    const ctx = this.ctx
    ctx.globalAlpha = alpha
    ctx.strokeStyle = INK
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}
