// Dibujo de "Entregas de Miga" sobre canvas 2D. La lógica (reglas) está en engine.ts; acá solo se muestra:
// el escenario del nivel, las cajas, el vehículo y los efectos (estela, chispas, confeti).

import { drawBox, drawFloor, drawGoal, drawVehicle, drawWall, drawWaves } from './art.ts'
import { DELTA, type Board, type Dir } from './engine.ts'
import { drawScenery } from './scenery.ts'
import type { Theme } from './themes.ts'

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
  ring: boolean
}

const MAX_PARTICLES = 220
const ANGLE: Record<Dir, number> = { R: 0, D: Math.PI / 2, L: Math.PI, U: -Math.PI / 2 }

export interface Insets {
  top: number
  bottom: number
}

export class SokobanRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private readonly board: Board
  private readonly theme: Theme
  private width = 1
  private height = 1
  private dpr = 1
  private ts = 40
  private ox = 0
  private oy = 0
  private scenery: HTMLCanvasElement | null = null
  private staticLayer: HTMLCanvasElement | null = null
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
    ring: false,
  }))
  // Posiciones que se ven (en casillas); siguen a las reales con suavidad.
  private player = { x: 0, y: 0, angle: 0, speed: 0 }
  private boxes: { x: number; y: number }[] = []
  private kick = { x: 0, y: 0 }
  private lastRender = 0
  private confetti = 0
  private time = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    board: Board,
    theme: Theme,
    private readonly reducedMotion: boolean,
  ) {
    this.ctx = canvas.getContext('2d', { alpha: false })!
    this.board = board
    this.theme = theme
    this.snap()
  }

  /** Coloca todo directo en su lugar (sin animación): al empezar o reiniciar. */
  snap() {
    const { w } = this.board.layout
    this.player.x = this.board.player % w
    this.player.y = Math.floor(this.board.player / w)
    this.player.angle = 0
    this.boxes = this.board.boxes.map((b) => ({ x: b % w, y: Math.floor(b / w) }))
    this.kick = { x: 0, y: 0 }
    this.confetti = 0
  }

  resize(width: number, height: number, dpr: number, insets: Insets) {
    this.width = width
    this.height = height
    this.dpr = dpr
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    const { w, h } = this.board.layout
    const availW = width - 24
    const availH = height - insets.top - insets.bottom - 16
    this.ts = Math.max(18, Math.min(76, Math.floor(Math.min(availW / w, availH / h))))
    this.ox = Math.round((width - this.ts * w) / 2)
    this.oy = Math.round(insets.top + (availH - this.ts * h) / 2 + 8)

    // Fondo del escenario y capa fija del mapa (piso, obstáculos), dibujados una sola vez.
    this.scenery = this.layer(width, height, (ctx) =>
      drawScenery(ctx, this.theme.id, width, height, this.theme.palette),
    )
    this.staticLayer = this.layer(width, height, (ctx) => this.paintBoard(ctx))
  }

  private layer(width: number, height: number, paint: (ctx: CanvasRenderingContext2D) => void) {
    const c = document.createElement('canvas')
    c.width = Math.round(width * this.dpr)
    c.height = Math.round(height * this.dpr)
    const ctx = c.getContext('2d')!
    ctx.scale(this.dpr, this.dpr)
    paint(ctx)
    return c
  }

  private paintBoard(ctx: CanvasRenderingContext2D) {
    const { w, h, wall, inside } = this.board.layout
    const { ts, ox, oy } = this
    const p = this.theme.palette
    // Marco del mapa (vereda, muelle, borde del techo).
    ctx.fillStyle = 'rgba(0,0,0,0.25)'
    ctx.beginPath()
    ctx.roundRect(ox - 6, oy - 2, ts * w + 12, ts * h + 14, 12)
    ctx.fill()
    ctx.fillStyle = p.frame
    ctx.beginPath()
    ctx.roundRect(ox - 8, oy - 8, ts * w + 16, ts * h + 16, 12)
    ctx.fill()
    ctx.strokeStyle = 'rgba(42,26,20,0.55)'
    ctx.lineWidth = 2
    ctx.stroke()
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const cell = row * w + col
        const x = ox + col * ts
        const y = oy + row * ts
        if (wall[cell]) {
          // Debajo de cada obstáculo va el piso, así no quedan huecos.
          drawFloor(ctx, this.theme.floor, x, y, ts, cell, col, row, p)
          drawWall(ctx, this.theme.wall, x, y, ts, cell, p)
        } else if (inside[cell]) {
          drawFloor(ctx, this.theme.floor, x, y, ts, cell, col, row, p)
        } else {
          ctx.fillStyle = 'rgba(0,0,0,0.18)'
          ctx.fillRect(x, y, ts, ts)
        }
      }
    }
  }

  // --- Efectos ---------------------------------------------------------------------------------------

  private emit(
    x: number,
    y: number,
    vx: number,
    vy: number,
    life: number,
    size: number,
    color: string,
    gravity = 0,
    ring = false,
  ) {
    const slot = this.particles.find((q) => !q.active)
    if (!slot) return
    Object.assign(slot, {
      active: true,
      x,
      y,
      vx,
      vy,
      life,
      maxLife: life,
      size,
      color,
      gravity,
      ring,
    })
  }

  private burst(
    cx: number,
    cy: number,
    colors: string[],
    count: number,
    speed: number,
    gravity = 220,
  ) {
    const amount = this.reducedMotion ? Math.ceil(count / 3) : count
    for (let i = 0; i < amount; i++) {
      const a = Math.random() * Math.PI * 2
      const v = speed * (0.35 + Math.random() * 0.8)
      this.emit(
        cx,
        cy,
        Math.cos(a) * v,
        Math.sin(a) * v - speed * 0.25,
        0.45 + Math.random() * 0.4,
        2 + Math.random() * 2.5,
        colors[Math.floor(Math.random() * colors.length)] ?? '#fff',
        gravity,
      )
    }
  }

  private center(cell: number) {
    const { w } = this.board.layout
    return {
      x: this.ox + ((cell % w) + 0.5) * this.ts,
      y: this.oy + (Math.floor(cell / w) + 0.5) * this.ts,
    }
  }

  /** Se movió el vehículo (con o sin empuje): apunta para ese lado y deja la estela del vehículo. */
  moved(dir: Dir, pushedTo: number | null) {
    this.player.angle = ANGLE[dir]
    if (pushedTo !== null) {
      const c = this.center(pushedTo)
      this.burst(c.x, c.y, ['#e6dcc3', '#fff6e0'], 4, 50, 40)
    }
  }

  /** No se pudo mover: un pequeño golpecito contra el obstáculo. */
  bumped(dir: Dir) {
    const [dx, dy] = DELTA[dir]
    this.player.angle = ANGLE[dir]
    if (!this.reducedMotion) this.kick = { x: dx * 0.16, y: dy * 0.16 }
  }

  /** Una caja quedó en su entrega. */
  landed(cell: number) {
    const c = this.center(cell)
    this.burst(c.x, c.y, [this.theme.palette.accent, '#fff6e0', '#7fbf5a'], 16, 130, 160)
    this.emit(c.x, c.y, 0, 0, 0.55, this.ts * 0.2, '#fff6e0', 0, true)
  }

  win() {
    this.confetti = this.reducedMotion ? 0.4 : 1.8
  }

  // --- Cuadro ------------------------------------------------------------------------------------------

  render(now: number) {
    const ctx = this.ctx
    const dt = this.lastRender ? Math.min((now - this.lastRender) / 1000, 0.05) : 0.016
    this.lastRender = now
    this.time += dt
    const t = this.time
    const { w, wall, inside, goal } = this.board.layout
    const { ts, ox, oy } = this
    const p = this.theme.palette
    const water = this.theme.floor === 'water' || this.theme.floor === 'lagoon'

    // Las posiciones visibles siguen a las reales con un suavizado que no depende de los fps.
    const follow = 1 - Math.exp(-dt * 24)
    const goalX = this.board.player % w
    const goalY = Math.floor(this.board.player / w)
    const before = { x: this.player.x, y: this.player.y }
    this.kick.x *= Math.exp(-dt * 14)
    this.kick.y *= Math.exp(-dt * 14)
    this.player.x += (goalX - this.player.x) * follow
    this.player.y += (goalY - this.player.y) * follow
    this.player.speed = Math.min(
      1,
      Math.hypot(this.player.x - before.x, this.player.y - before.y) / (dt * 6 + 1e-6),
    )
    this.board.boxes.forEach((b, i) => {
      const v = (this.boxes[i] ??= { x: b % w, y: Math.floor(b / w) })
      v.x += ((b % w) - v.x) * follow
      v.y += (Math.floor(b / w) - v.y) * follow
    })

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    if (this.scenery) ctx.drawImage(this.scenery, 0, 0, this.width, this.height)
    this.drawAmbient(ctx, t)
    if (this.staticLayer) ctx.drawImage(this.staticLayer, 0, 0, this.width, this.height)

    // Olas del agua, solo sobre el piso del mapa.
    if (water) {
      for (let row = 0; row < this.board.layout.h; row++) {
        for (let col = 0; col < w; col++) {
          const cell = row * w + col
          if (wall[cell] || !inside[cell]) continue
          drawWaves(ctx, ox + col * ts, oy + row * ts, ts, cell, t, this.theme.floor === 'lagoon')
        }
      }
    }

    // Entregas (debajo de todo lo que se mueve).
    goal.forEach((isGoal, cell) => {
      if (!isGoal) return
      const col = cell % w
      const row = Math.floor(cell / w)
      drawGoal(ctx, this.theme.vehicle, ox + col * ts, oy + row * ts, ts, p, t)
    })

    // Cajas.
    this.board.boxes.forEach((cell, i) => {
      const v = this.boxes[i]!
      drawBox(
        ctx,
        ox + v.x * ts,
        oy + v.y * ts,
        ts,
        p,
        goal[cell] === true,
        water,
        this.theme.vehicle,
        t,
      )
    })

    // Estela detrás del vehículo en movimiento.
    if (this.player.speed > 0.25 && !this.reducedMotion) {
      const px = ox + (this.player.x + 0.5) * ts
      const py = oy + (this.player.y + 0.5) * ts
      const back = this.player.angle + Math.PI
      const bx = px + Math.cos(back) * ts * 0.4
      const by = py + Math.sin(back) * ts * 0.4
      const kind = this.theme.vehicle
      if (kind === 'boat') {
        this.emit(
          bx,
          by,
          Math.cos(back) * 20,
          Math.sin(back) * 20,
          0.55,
          ts * 0.12,
          'rgba(255,255,255,0.8)',
          0,
        )
      } else if (kind === 'heli') {
        this.emit(
          px,
          py,
          (Math.random() - 0.5) * 50,
          (Math.random() - 0.5) * 50,
          0.4,
          ts * 0.06,
          'rgba(255,255,255,0.5)',
          0,
        )
      } else {
        this.emit(
          bx,
          by,
          Math.cos(back) * 25,
          Math.sin(back) * 25,
          0.4,
          ts * 0.07,
          'rgba(230,220,200,0.6)',
          0,
        )
      }
    }

    // Vehículo.
    const vx = ox + (this.player.x + 0.5 + this.kick.x) * ts
    const vy = oy + (this.player.y + 0.5 + this.kick.y) * ts
    ctx.save()
    ctx.translate(vx, vy)
    ctx.rotate(this.player.angle)
    drawVehicle(ctx, this.theme.vehicle, ts, t, this.player.speed)
    ctx.restore()

    this.drawParticles(ctx, dt)
    if (this.confetti > 0) {
      this.confetti -= dt
      for (let i = 0; i < 3; i++) {
        this.emit(
          Math.random() * this.width,
          -8,
          (Math.random() - 0.5) * 80,
          80 + Math.random() * 120,
          1.6,
          3 + Math.random() * 3,
          ['#c8102e', '#f7c948', '#2f9fd6', '#7fbf5a', '#fff6e0'][Math.floor(Math.random() * 5)] ??
            '#fff',
          60,
        )
      }
    }
  }

  private drawAmbient(ctx: CanvasRenderingContext2D, t: number) {
    if (this.reducedMotion) return
    const W = this.width
    const H = this.height
    switch (this.theme.ambient) {
      case 'birds': {
        ctx.strokeStyle = 'rgba(42,26,20,0.55)'
        ctx.lineWidth = 1.6
        for (let i = 0; i < 4; i++) {
          const x = ((t * (18 + i * 6) + i * 140) % (W + 60)) - 30
          const y = H * 0.1 + i * 16 + Math.sin(t * 2 + i) * 4
          const flap = Math.sin(t * 9 + i) * 3
          ctx.beginPath()
          ctx.moveTo(x - 7, y + flap)
          ctx.quadraticCurveTo(x - 3, y - 4, x, y)
          ctx.quadraticCurveTo(x + 3, y - 4, x + 7, y + flap)
          ctx.stroke()
        }
        break
      }
      case 'leaves': {
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        for (let i = 0; i < 8; i++) {
          const x = ((t * (10 + i * 3) + i * 97) % (W + 20)) - 10
          const y = ((t * (22 + i * 5) + i * 61) % (H + 20)) - 10
          ctx.beginPath()
          ctx.ellipse(x, y, 3.2, 1.8, t + i, 0, Math.PI * 2)
          ctx.fill()
        }
        break
      }
      case 'bubbles': {
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'
        ctx.lineWidth = 1.2
        for (let i = 0; i < 7; i++) {
          const x = (i * 83 + 20) % W
          const y = H - ((t * (16 + i * 4) + i * 53) % (H * 0.5))
          ctx.beginPath()
          ctx.arc(x, y, 2 + (i % 3), 0, Math.PI * 2)
          ctx.stroke()
        }
        break
      }
      case 'sparks': {
        // Fuegos artificiales de las Fallas.
        for (let k = 0; k < 2; k++) {
          const phase = (t * 0.55 + k * 0.5) % 1
          const cx = W * (0.25 + k * 0.5) + Math.sin(Math.floor(t * 0.55 + k * 0.5) * 7) * 30
          const cy = H * 0.14
          if (phase > 0.12) {
            const r = (phase - 0.12) * 70
            ctx.fillStyle = `rgba(255,212,92,${1 - phase})`
            for (let i = 0; i < 14; i++) {
              const a = (i / 14) * Math.PI * 2
              ctx.beginPath()
              ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r + phase * 14, 1.8, 0, Math.PI * 2)
              ctx.fill()
            }
          }
        }
        break
      }
      case 'dust': {
        ctx.fillStyle = 'rgba(255,255,255,0.35)'
        for (let i = 0; i < 6; i++) {
          const x = (t * (6 + i * 2) + i * 131) % W
          const y = H * 0.08 + ((i * 47) % (H * 0.2))
          ctx.beginPath()
          ctx.arc(x, y, 1.6, 0, Math.PI * 2)
          ctx.fill()
        }
        break
      }
      default:
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D, dt: number) {
    for (const q of this.particles) {
      if (!q.active) continue
      q.life -= dt
      if (q.life <= 0) {
        q.active = false
        continue
      }
      q.vy += q.gravity * dt
      q.x += q.vx * dt
      q.y += q.vy * dt
      const k = q.life / q.maxLife
      ctx.globalAlpha = Math.min(1, k * 1.4)
      if (q.ring) {
        ctx.strokeStyle = q.color
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(q.x, q.y, q.size * (1 + (1 - k) * 2.4), 0, Math.PI * 2)
        ctx.stroke()
      } else {
        ctx.fillStyle = q.color
        ctx.beginPath()
        ctx.arc(q.x, q.y, q.size * (0.6 + k * 0.4), 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }
}
