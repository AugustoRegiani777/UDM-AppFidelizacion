// Dibujo de "Skate Spot": un parque de lado con capas de profundidad (cielo, skyline, palmeras,
// plaza y un primer plano que pasa por delante). La simulación no sabe nada de esto.

import { drawHero } from '../shared/hero.ts'
import type { ThumbsView } from '../skate/input.ts'
import { groundAt, type Obstacle, type ParkEvent, type ParkState } from './sim.ts'

export const VIEW_H = 300
const GROUND_Y = 236
const INK = '#2a1a14'
const MAX_PARTICLES = 160

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
  gravity: number
}

export interface Popup {
  text: string
  x: number
  y: number
  age: number
  color: string
  size: number
  life: number
}

function mulberry(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Building {
  x: number
  w: number
  h: number
  tone: number
  windows: boolean
}

function makeSkyline(seed: number, period: number, minH: number, maxH: number): Building[] {
  const random = mulberry(seed)
  const list: Building[] = []
  let x = 0
  while (x < period) {
    const w = 46 + random() * 70
    list.push({ x, w, h: minH + random() * (maxH - minH), tone: random(), windows: random() > 0.3 })
    x += w + random() * 10
  }
  return list
}

const FAR_PERIOD = 1300
const MID_PERIOD = 900
const FAR = makeSkyline(11, FAR_PERIOD, 40, 120)
const MID = makeSkyline(29, MID_PERIOD, 28, 86)
const PALMS = [90, 330, 610, 800]

export class ParkRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private dpr = 1
  private viewW = 533
  private k = 1
  private camX = 0
  private shake = 0
  private lastRender = 0
  private sky: CanvasGradient | null = null
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
    gravity: 0,
  }))
  private popups: Popup[] = []
  private bankFlash = 0
  private prevX = 0
  private prevY = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly reducedMotion: boolean,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!
  }

  resize(width: number, height: number, dpr: number) {
    this.dpr = dpr
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.k = (height / VIEW_H) * dpr
    this.viewW = width / (height / VIEW_H)
    const gradient = this.ctx.createLinearGradient(0, 0, 0, GROUND_Y * this.k)
    gradient.addColorStop(0, '#7fb8e6')
    gradient.addColorStop(0.7, '#cfe8f5')
    gradient.addColorStop(1, '#fff3d6')
    this.sky = gradient
  }

  /** Guarda la posición del patinador entre pasos para suavizar. */
  snapshot(s: ParkState) {
    this.prevX = s.x
    this.prevY = s.y
  }

  private emit(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    color: string,
    gravity = 0,
  ) {
    const slot = this.particles.find((p) => !p.active)
    if (!slot) return
    Object.assign(slot, { active: true, x, y, vx, vy, life, maxLife: life, size, color, gravity })
  }

  private burst(
    x: number,
    y: number,
    colors: string[],
    count: number,
    speed: number,
    gravity = 220,
  ) {
    const amount = this.reducedMotion ? Math.ceil(count / 3) : count
    for (let i = 0; i < amount; i++) {
      const angle = Math.random() * Math.PI * 2
      const v = speed * (0.35 + Math.random() * 0.8)
      this.emit(
        x,
        y,
        Math.cos(angle) * v,
        Math.sin(angle) * v - speed * 0.3,
        0.35 + Math.random() * 0.35,
        1.4 + Math.random() * 2,
        colors[Math.floor(Math.random() * colors.length)] ?? '#fff',
        gravity,
      )
    }
  }

  /** Convierte los eventos de la simulación en efectos: chispas, polvo, textos que suben. */
  ingest(events: readonly ParkEvent[], s: ParkState, label: (name: string) => string) {
    for (const event of events) {
      switch (event.t) {
        case 'action':
          this.popups.push({
            text: `${label(event.name)} +${event.points}`,
            x: s.x,
            y: s.y + 46,
            age: 0,
            color: '#fff6e0',
            size: 13,
            life: 1.1,
          })
          break
        case 'bank':
          this.bankFlash = 1
          this.popups.push({
            text: `+${event.total}`,
            x: s.x,
            y: s.y + 70,
            age: 0,
            color: '#f7c948',
            size: 30,
            life: 1.5,
          })
          this.burst(s.x, s.y + 20, ['#f7c948', '#fff6e0', '#c8102e'], 18, 150, 120)
          break
        case 'land':
          this.burst(s.x, s.y, ['#e6dcc3', '#b9a98a'], event.quality === 'clean' ? 6 : 12, 70, 80)
          break
        case 'pop':
          this.burst(s.x - 10, s.y, ['#e6dcc3'], 4, 50, 40)
          break
        case 'sparks':
          this.burst(s.x - 6, s.y + 1, ['#ffd45c', '#ff9d3c', '#fff'], 3, 90, 260)
          break
        case 'grind':
          this.burst(s.x, s.y, ['#ffd45c', '#fff'], 10, 120, 260)
          break
        case 'bail':
          this.shake = this.reducedMotion ? 0 : 7
          this.popups.push({
            text: event.lost > 0 ? `¡Caída! −${event.lost}` : '¡Caída!',
            x: s.x,
            y: s.y + 62,
            age: 0,
            color: '#ff6b6b',
            size: 20,
            life: 1.4,
          })
          this.burst(s.x, s.y + 12, ['#fff6e0', '#f7c948', '#c8102e'], 14, 130, 300)
          break
        default:
      }
    }
  }

  private drawBackground(camX: number, now: number) {
    const ctx = this.ctx
    ctx.fillStyle = this.sky ?? '#cfe8f5'
    ctx.fillRect(0, 0, this.viewW, GROUND_Y)

    // Sol bajo.
    ctx.fillStyle = 'rgba(255,236,170,0.8)'
    ctx.beginPath()
    ctx.arc(this.viewW * 0.78, 62, 22, 0, Math.PI * 2)
    ctx.fill()

    // Skyline lejano (casi no se mueve) y edificios medios.
    this.drawBuildings(FAR, FAR_PERIOD, camX * 0.12, GROUND_Y - 6, 0.5, '#c7b8a6', '#b9a894', false)
    this.drawBuildings(MID, MID_PERIOD, camX * 0.32, GROUND_Y - 2, 1, '#b19a84', '#9f8870', true)

    // Palmeras de la capa media.
    const shift = (camX * 0.45) % MID_PERIOD
    for (let rep = -1; rep < Math.ceil(this.viewW / MID_PERIOD) + 2; rep++) {
      for (const px of PALMS) {
        const x = px + rep * MID_PERIOD - shift
        if (x < -40 || x > this.viewW + 40) continue
        this.drawPalm(x, GROUND_Y - 1, Math.sin(now / 900 + px) * 2)
      }
    }
  }

  private drawBuildings(
    list: Building[],
    period: number,
    shift: number,
    baseY: number,
    scale: number,
    light: string,
    dark: string,
    windows: boolean,
  ) {
    const ctx = this.ctx
    const offset = shift % period
    for (let rep = -1; rep < Math.ceil(this.viewW / period) + 2; rep++) {
      for (const b of list) {
        const x = b.x + rep * period - offset
        if (x > this.viewW || x + b.w < 0) continue
        const h = b.h * scale + 10
        ctx.fillStyle = b.tone > 0.5 ? light : dark
        ctx.fillRect(x, baseY - h, b.w, h)
        if (windows && b.windows) {
          ctx.fillStyle = 'rgba(255,246,224,0.55)'
          for (let wy = baseY - h + 8; wy < baseY - 12; wy += 14) {
            for (let wx = x + 6; wx < x + b.w - 8; wx += 12) ctx.fillRect(wx, wy, 5, 7)
          }
        }
      }
    }
  }

  private drawPalm(x: number, y: number, sway: number) {
    const ctx = this.ctx
    ctx.strokeStyle = '#6b4a2b'
    ctx.lineWidth = 3.5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(x + 4, y - 36, x + sway, y - 70)
    ctx.stroke()
    ctx.strokeStyle = '#4f8a3a'
    ctx.lineWidth = 3
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.52
      ctx.beginPath()
      ctx.moveTo(x + sway, y - 70)
      ctx.quadraticCurveTo(
        x + sway + Math.cos(a) * 14,
        y - 70 + Math.sin(a) * 14 - 8,
        x + sway + Math.cos(a) * 28,
        y - 70 + Math.sin(a) * 24 + 8,
      )
      ctx.stroke()
    }
  }

  private drawGround(camX: number) {
    const ctx = this.ctx
    ctx.fillStyle = '#d6c7a6'
    ctx.fillRect(0, GROUND_Y, this.viewW, VIEW_H - GROUND_Y)
    ctx.fillStyle = '#b8a784'
    ctx.fillRect(0, GROUND_Y, this.viewW, 5)
    // Juntas de las baldosas: se mueven con el suelo.
    ctx.strokeStyle = 'rgba(42,26,20,0.14)'
    ctx.lineWidth = 1
    const tile = 70
    const start = -(camX % tile)
    for (let x = start; x < this.viewW + tile; x += tile) {
      ctx.beginPath()
      ctx.moveTo(x, GROUND_Y + 5)
      ctx.lineTo(x - 26, VIEW_H)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.moveTo(0, GROUND_Y + 34)
    ctx.lineTo(this.viewW, GROUND_Y + 34)
    ctx.stroke()
  }

  private drawObstacle(o: Obstacle, camX: number, s: ParkState) {
    const ctx = this.ctx
    const x = o.x - camX
    if (x > this.viewW + 20 || x + o.w < -20) return
    switch (o.kind) {
      case 'ramp': {
        ctx.fillStyle = '#9aa6b4'
        ctx.strokeStyle = INK
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, GROUND_Y)
        for (let i = 0; i <= 14; i++) {
          const t = i / 14
          ctx.lineTo(x + o.w * t, GROUND_Y - o.h * (0.35 * t + 0.65 * t * t))
        }
        ctx.lineTo(x + o.w, GROUND_Y)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        // Borde amarillo en la punta, como los de verdad.
        ctx.fillStyle = '#f7c948'
        ctx.fillRect(x + o.w - 8, GROUND_Y - o.h, 8, 4)
        break
      }
      case 'box': {
        ctx.fillStyle = '#b9892b'
        ctx.strokeStyle = INK
        ctx.lineWidth = 2
        ctx.fillRect(x, GROUND_Y - o.h, o.w, o.h)
        ctx.strokeRect(x, GROUND_Y - o.h, o.w, o.h)
        ctx.fillStyle = '#e8edf3'
        ctx.fillRect(x, GROUND_Y - o.h, o.w, 4)
        ctx.fillStyle = 'rgba(42,26,20,0.18)'
        ctx.fillRect(x + 6, GROUND_Y - o.h + 8, o.w - 12, 3)
        break
      }
      case 'rail': {
        ctx.strokeStyle = '#6b7684'
        ctx.lineWidth = 3
        for (const px of [x + 14, x + o.w - 14]) {
          ctx.beginPath()
          ctx.moveTo(px, GROUND_Y)
          ctx.lineTo(px, GROUND_Y - o.h)
          ctx.stroke()
        }
        ctx.strokeStyle = '#e8edf3'
        ctx.lineWidth = 5
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(x, GROUND_Y - o.h)
        ctx.lineTo(x + o.w, GROUND_Y - o.h)
        ctx.stroke()
        ctx.strokeStyle = INK
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(x, GROUND_Y - o.h + 2.5)
        ctx.lineTo(x + o.w, GROUND_Y - o.h + 2.5)
        ctx.stroke()
        break
      }
      default: {
        // Pozo con franjas de peligro.
        ctx.fillStyle = '#2a1a14'
        ctx.fillRect(x, GROUND_Y, o.w, VIEW_H - GROUND_Y)
        ctx.fillStyle = '#f7c948'
        for (let i = 0; i < o.w; i += 16) {
          ctx.beginPath()
          ctx.moveTo(x + i, GROUND_Y)
          ctx.lineTo(x + i + 8, GROUND_Y)
          ctx.lineTo(x + i + 2, GROUND_Y + 8)
          ctx.lineTo(x + i - 6, GROUND_Y + 8)
          ctx.fill()
        }
      }
    }
    void s
  }

  /** La tabla: da vueltas en 3D falso (escala sobre un eje) mientras dura el truco. */
  private drawBoard(s: ParkState, x: number, y: number, tilt: number) {
    const ctx = this.ctx
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(tilt)
    let scaleX = 1
    let scaleY = 1
    let top = false
    if (s.flip) {
      const p = s.flip.t / s.flip.ticks
      const turns = s.flip.kind.includes('heel') ? -1 : 1
      const shove =
        s.flip.kind.startsWith('shoveit') ||
        s.flip.kind === 'treflip' ||
        s.flip.kind === 'varialflip'
      const double =
        s.flip.kind === 'shoveit360' || s.flip.kind === 'treflip' || s.flip.kind === 'laserflip'
      if (!shove || s.flip.kind === 'varialflip' || s.flip.kind === 'treflip') {
        scaleY = Math.cos(p * Math.PI * 2 * turns)
      }
      if (shove || s.flip.kind === 'laserflip' || s.flip.kind === 'hardflip') {
        scaleX = Math.cos(p * Math.PI * (double ? 2 : 1))
      }
      top = scaleY < 0
    }
    ctx.scale(Math.max(0.12, Math.abs(scaleX)), Math.max(0.18, Math.abs(scaleY)))
    ctx.fillStyle = top ? '#c8102e' : '#2a1a14'
    ctx.beginPath()
    ctx.roundRect(-19, -2.8, 38, 5.6, 2.8)
    ctx.fill()
    ctx.strokeStyle = '#fff6e0'
    ctx.lineWidth = 0.9
    ctx.stroke()
    ctx.fillStyle = '#e8edf3'
    for (const wx of [-12, 12]) {
      ctx.beginPath()
      ctx.arc(wx, 4.2, 2.8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
  }

  private drawSkater(s: ParkState, alpha: number, now: number) {
    const ctx = this.ctx
    const x = this.prevX + (s.x - this.prevX) * alpha - this.camX
    const lift = this.prevY + (s.y - this.prevY) * alpha
    const baseY = GROUND_Y - lift

    // Sombra en el piso: se achica con la altura.
    const ground = groundAt(s.obstacles, s.x)
    const shadowY = GROUND_Y - (Number.isFinite(ground) ? ground : 0)
    const sh = Math.max(0.35, 1 - Math.max(0, lift - (Number.isFinite(ground) ? ground : 0)) / 140)
    ctx.fillStyle = `rgba(42,26,20,${0.22 * sh})`
    ctx.beginPath()
    ctx.ellipse(x, shadowY + 1, 20 * sh, 4 * sh, 0, 0, Math.PI * 2)
    ctx.fill()

    // Postura según el modo.
    const charge = s.charge / 18
    const crouch = s.mode === 'roll' ? charge * 0.2 : 0
    const bob = s.mode === 'roll' ? Math.sin(now / 90) * 0.8 : 0
    let lean = s.mode === 'air' ? Math.max(-0.4, Math.min(0.4, -s.vy / 1500)) : 0
    if (s.mode === 'grind' && s.grind) lean = s.grind.balance * 0.55
    if (s.mode === 'bail') lean = (s.bailTicks / 6) % (Math.PI * 2)

    let boardLift = 0
    let boardTilt = 0
    if (s.grab?.active) {
      boardLift = -9
      boardTilt = s.grab.kind === 'nose' ? -0.35 : s.grab.kind === 'tail' ? 0.35 : 0.12
    }

    this.drawBoard(
      s,
      x + (s.mode === 'bail' ? Math.sin(s.bailTicks / 5) * 18 : 0),
      baseY - 3 + boardLift,
      boardTilt + (s.mode === 'bail' ? s.bailTicks / 9 : 0),
    )

    // Cuerpo: el sanguchito de la marca.
    const spinCos = Math.cos((s.spin * Math.PI) / 180)
    ctx.save()
    ctx.translate(x, baseY - 25 + crouch * 14 + bob)
    ctx.rotate(lean)
    const sx = Math.max(0.2, Math.abs(spinCos))
    ctx.scale(1.15 * sx, 1.15 * (1 - crouch))
    drawHero(ctx)
    // Mirando de espaldas: se tapa la cara.
    if (spinCos < 0) {
      ctx.fillStyle = '#fff6e0'
      ctx.fillRect(-13, -14, 26, 15)
    } else {
      ctx.fillStyle = INK
      for (const px of [-6, 6]) {
        ctx.beginPath()
        ctx.arc(px + 1, -4.5, 1.8, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.restore()

    // Brazos al agarre.
    if (s.grab?.active) {
      ctx.strokeStyle = '#fff6e0'
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(x + 8, baseY - 22)
      ctx.lineTo(
        x + (s.grab.kind === 'nose' ? 14 : s.grab.kind === 'tail' ? -10 : 4),
        baseY - 3 + boardLift,
      )
      ctx.stroke()
    }

    // Medidor de equilibrio sobre el patinador.
    if (s.mode === 'grind' && s.grind) {
      const w = 54
      const b = s.grind.balance
      ctx.fillStyle = 'rgba(42,26,20,0.65)'
      ctx.fillRect(x - w / 2, baseY - 70, w, 7)
      ctx.fillStyle = '#86c35f'
      ctx.fillRect(x - w * 0.15, baseY - 70, w * 0.3, 7)
      ctx.fillStyle = Math.abs(b) > 0.7 ? '#ff6b6b' : '#fff6e0'
      ctx.fillRect(x + (b * w) / 2 - 2, baseY - 73, 4, 13)
    }
  }

  private drawControls(view: ThumbsView) {
    const ctx = this.ctx
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    if (view.stick.active) {
      ctx.globalAlpha = 0.5
      ctx.strokeStyle = INK
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(view.stick.originX, view.stick.originY, 44, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = 'rgba(42,26,20,0.6)'
      ctx.beginPath()
      ctx.arc(view.stick.x, view.stick.y, 18, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
    if (view.button.active) {
      ctx.globalAlpha = 0.45
      ctx.fillStyle = '#c8102e'
      ctx.beginPath()
      ctx.arc(view.button.x, view.button.y, 34, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }

  render(s: ParkState, alpha: number, view: ThumbsView, now: number) {
    const ctx = this.ctx
    const dt = this.lastRender ? Math.min((now - this.lastRender) / 1000, 0.05) : 0.016
    this.lastRender = now

    const px = this.prevX + (s.x - this.prevX) * alpha
    const target = px - this.viewW * 0.3
    this.camX += (target - this.camX) * (1 - Math.exp(-9 * dt))
    if (Math.abs(target - this.camX) > this.viewW) this.camX = target

    ctx.setTransform(this.k, 0, 0, this.k, 0, 0)
    if (this.shake > 0.05) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake)
      this.shake *= Math.pow(0.002, dt)
    } else {
      this.shake = 0
    }

    this.drawBackground(this.camX, now)
    this.drawGround(this.camX)
    for (const o of s.obstacles) this.drawObstacle(o, this.camX, s)
    this.drawSkater(s, alpha, now)

    // Partículas en coordenadas del mundo.
    for (const part of this.particles) {
      if (!part.active) continue
      part.life -= dt
      if (part.life <= 0) {
        part.active = false
        continue
      }
      part.vy -= part.gravity * dt
      part.x += part.vx * dt
      part.y += part.vy * dt
      ctx.globalAlpha = Math.min(1, (part.life / part.maxLife) * 1.4)
      ctx.fillStyle = part.color
      ctx.beginPath()
      ctx.arc(part.x - this.camX, GROUND_Y - part.y, part.size, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1

    // Primer plano: postes y reja que pasan por delante más rápido que el skater (profundidad).
    const fg = this.camX * 1.55
    ctx.fillStyle = 'rgba(42,26,20,0.5)'
    for (let i = Math.floor(fg / 760) - 1; i < Math.floor((fg + this.viewW) / 760) + 2; i++) {
      const x = i * 760 + 140 - fg
      ctx.fillRect(x, 40, 6, VIEW_H)
      ctx.fillRect(x - 10, 36, 26, 7)
    }

    // Textos que suben.
    ctx.textAlign = 'center'
    this.popups = this.popups.filter((p) => (p.age += dt) < p.life)
    for (const p of this.popups) {
      const t = p.age / p.life
      ctx.globalAlpha = 1 - Math.max(0, (t - 0.6) / 0.4)
      ctx.font = `700 ${p.size}px "Bebas Neue", Poppins, sans-serif`
      ctx.lineWidth = 3.5
      ctx.strokeStyle = INK
      ctx.lineJoin = 'round'
      const sx = Math.max(60, Math.min(this.viewW - 60, p.x - this.camX))
      const sy = GROUND_Y - p.y - t * 26
      ctx.strokeText(p.text, sx, sy)
      ctx.fillStyle = p.color
      ctx.fillText(p.text, sx, sy)
    }
    ctx.globalAlpha = 1

    if (this.bankFlash > 0.02) {
      ctx.fillStyle = `rgba(247,201,72,${this.bankFlash * 0.18})`
      ctx.fillRect(0, 0, this.viewW, VIEW_H)
      this.bankFlash *= Math.pow(0.01, dt)
    }
    this.drawControls(view)
  }
}
