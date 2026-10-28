// Los cinco lugares del local donde se corre "Miga Racers": cómo se ve el piso, la pista, los adornos, los
// obstáculos, los charcos y la hoja de la fiambrera. Todo se dibuja en canvas 2D, centrado en (0,0).

import type { SceneId, SolidKind, ZoneKind } from './tracks.ts'

type Ctx = CanvasRenderingContext2D

const INK = '#2a1a14'

export interface SceneStyle {
  /** Baldosa que se repite para pintar el piso. */
  tile: (ctx: Ctx, size: number) => void
  tileSize: number
  track: { shadow: string; edge: string; base: string; inner: string; dash: string }
  /** Adornos sueltos del piso (se dibujan con radio `r`, centrados en 0,0). */
  props: readonly ((ctx: Ctx, r: number) => void)[]
}

function seeded(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const circle = (ctx: Ctx, x: number, y: number, r: number) => {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
}

// ---------- Pisos ----------

function glassTile(ctx: Ctx, size: number) {
  ctx.fillStyle = '#d9eff1'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  for (const x of [size * 0.15, size * 0.62]) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + 26, 0)
    ctx.lineTo(x - 34, size)
    ctx.lineTo(x - 60, size)
    ctx.closePath()
    ctx.fill()
  }
  ctx.strokeStyle = 'rgba(120,170,176,0.22)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, size - 2, size - 2)
}

function steelTile(ctx: Ctx, size: number) {
  ctx.fillStyle = '#c6cacf'
  ctx.fillRect(0, 0, size, size)
  const random = seeded(11)
  for (let i = 0; i < 90; i++) {
    const y = random() * size
    ctx.strokeStyle = random() > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(90,96,104,0.18)'
    ctx.lineWidth = 0.8
    ctx.beginPath()
    ctx.moveTo(random() * size * 0.4, y)
    ctx.lineTo(size * (0.6 + random() * 0.4), y + (random() - 0.5) * 2)
    ctx.stroke()
  }
}

function matTile(ctx: Ctx, size: number) {
  ctx.fillStyle = '#2d2d33'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#3a3a42'
  for (let y = 12; y < size; y += 24) {
    for (let x = 12; x < size; x += 24) {
      circle(ctx, x, y, 5)
      ctx.fill()
    }
  }
}

function kraftTile(ctx: Ctx, size: number) {
  ctx.fillStyle = '#d8b888'
  ctx.fillRect(0, 0, size, size)
  const random = seeded(5)
  ctx.strokeStyle = 'rgba(140,96,50,0.18)'
  ctx.lineWidth = 1
  for (let i = 0; i < 40; i++) {
    const x = random() * size
    const y = random() * size
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + (random() - 0.5) * 40, y + (random() - 0.5) * 8)
    ctx.stroke()
  }
  // Borde a cuadros rojos y blancos (el mantel de la vitrina de bollería).
  ctx.fillStyle = 'rgba(200,16,46,0.14)'
  ctx.fillRect(0, 0, size, size / 2)
  ctx.fillRect(0, 0, size / 2, size)
}

function fridgeTile(ctx: Ctx, size: number) {
  ctx.fillStyle = '#f0e5c6'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.fillRect(0, size * 0.18, size, size * 0.1)
  ctx.fillStyle = 'rgba(160,140,90,0.12)'
  ctx.fillRect(0, size * 0.7, size, size * 0.16)
}

// ---------- Adornos del piso ----------

const crumb = (ctx: Ctx, r: number, color: string) => {
  ctx.fillStyle = color
  for (const [dx, dy, s] of [
    [-4, -2, 3],
    [3, 1, 2.4],
    [-1, 5, 2],
  ] as const) {
    ctx.fillRect(dx * (r / 12), dy * (r / 12), s, s)
  }
}

const sandwichSquare = (ctx: Ctx, r: number) => {
  ctx.fillStyle = '#fffaf0'
  ctx.strokeStyle = 'rgba(42,26,20,0.35)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6, 3)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#f0a0a0'
  ctx.fillRect(-r * 0.8, -r * 0.1, r * 1.6, r * 0.25)
  ctx.fillStyle = '#f7d96a'
  ctx.fillRect(-r * 0.8, r * 0.15, r * 1.6, r * 0.2)
}

const caramelo = (ctx: Ctx, r: number) => {
  ctx.fillStyle = '#e9b52f'
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 0.7, r * 0.45, 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f6e19a'
  ctx.beginPath()
  ctx.moveTo(-r * 0.7, 0)
  ctx.lineTo(-r * 1.05, -r * 0.3)
  ctx.lineTo(-r * 1.05, r * 0.3)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(r * 0.7, 0)
  ctx.lineTo(r * 1.05, -r * 0.3)
  ctx.lineTo(r * 1.05, r * 0.3)
  ctx.closePath()
  ctx.fill()
}

const glove = (ctx: Ctx, r: number) => {
  ctx.fillStyle = '#1d1d22'
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 0.9, r * 0.6, 0.5, 0, Math.PI * 2)
  ctx.fill()
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.ellipse(r * 0.7, (i - 1.5) * r * 0.28, r * 0.45, r * 0.12, 0.2 * i, 0, Math.PI * 2)
    ctx.fill()
  }
}

const sticker = (ctx: Ctx, r: number) => {
  ctx.fillStyle = '#f7e07a'
  circle(ctx, 0, 0, r * 0.75)
  ctx.fill()
  ctx.strokeStyle = 'rgba(42,26,20,0.4)'
  ctx.lineWidth = 1
  circle(ctx, 0, 0, r * 0.45)
  ctx.stroke()
}

const bottleCap = (ctx: Ctx, r: number) => {
  ctx.fillStyle = '#2f5fb5'
  circle(ctx, 0, 0, r * 0.6)
  ctx.fill()
  ctx.strokeStyle = '#e8f0ff'
  ctx.lineWidth = 1.5
  circle(ctx, 0, 0, r * 0.4)
  ctx.stroke()
}

const bean = (ctx: Ctx, r: number) => {
  ctx.fillStyle = '#4a2c1c'
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 0.6, r * 0.42, 0.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#2a170d'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(-r * 0.4, r * 0.25)
  ctx.quadraticCurveTo(0, -r * 0.1, r * 0.4, -r * 0.25)
  ctx.stroke()
}

const sugarSachet = (ctx: Ctx, r: number) => {
  ctx.fillStyle = '#fff6e0'
  ctx.strokeStyle = 'rgba(42,26,20,0.4)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(-r * 0.9, -r * 0.45, r * 1.8, r * 0.9, 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = '#c8102e'
  ctx.fillRect(-r * 0.5, -r * 0.12, r, r * 0.24)
}

const dulceDrop = (ctx: Ctx, r: number) => {
  ctx.fillStyle = '#a8651f'
  ctx.beginPath()
  ctx.ellipse(0, 0, r * 0.7, r * 0.5, 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  circle(ctx, -r * 0.2, -r * 0.15, r * 0.14)
  ctx.fill()
}

const sugarDust = (ctx: Ctx, r: number) => {
  ctx.fillStyle = 'rgba(255,255,255,0.9)'
  for (const [dx, dy, s] of [
    [-5, -3, 2.2],
    [2, -5, 1.8],
    [5, 2, 2.4],
    [-2, 4, 1.6],
    [0, 0, 2],
  ] as const) {
    circle(ctx, dx * (r / 12), dy * (r / 12), s)
    ctx.fill()
  }
}

const hamSlice = (ctx: Ctx, r: number) => {
  ctx.fillStyle = '#efa3a3'
  circle(ctx, 0, 0, r * 0.8)
  ctx.fill()
  ctx.strokeStyle = '#d77f7f'
  ctx.lineWidth = 1.5
  circle(ctx, 0, 0, r * 0.45)
  ctx.stroke()
}

const cheeseSlice = (ctx: Ctx, r: number) => {
  ctx.fillStyle = '#f7d65a'
  ctx.beginPath()
  ctx.roundRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6, 2)
  ctx.fill()
  ctx.strokeStyle = '#c8a02a'
  ctx.lineWidth = 1
  ctx.stroke()
}

const peppercorn = (ctx: Ctx, r: number) => {
  ctx.fillStyle = '#26262b'
  circle(ctx, 0, 0, r * 0.3)
  ctx.fill()
}

export const SCENES: Record<SceneId, SceneStyle> = {
  vitrina: {
    tile: glassTile,
    tileSize: 192,
    track: {
      shadow: 'rgba(60,110,118,0.25)',
      edge: '#98b9bf',
      base: '#fdfefe',
      inner: '#eef8f9',
      dash: 'rgba(200,16,46,0.6)',
    },
    props: [sandwichSquare, caramelo, (c, r) => crumb(c, r, '#e8d9b0'), sandwichSquare],
  },
  obrador: {
    tile: steelTile,
    tileSize: 192,
    track: {
      shadow: 'rgba(30,34,40,0.28)',
      edge: '#3f444b',
      base: '#666c75',
      inner: '#757b84',
      dash: '#f7c948',
    },
    props: [glove, sticker, bottleCap, sticker],
  },
  cafetera: {
    tile: matTile,
    tileSize: 192,
    track: {
      shadow: 'rgba(0,0,0,0.35)',
      edge: '#9097a0',
      base: '#16161a',
      inner: '#202026',
      dash: 'rgba(255,255,255,0.38)',
    },
    props: [bean, sugarSachet, bean, bean],
  },
  boleria: {
    tile: kraftTile,
    tileSize: 192,
    track: {
      shadow: 'rgba(90,50,20,0.28)',
      edge: '#a83a24',
      base: '#f4e8cf',
      inner: '#fbf2de',
      dash: '#c8102e',
    },
    props: [sugarDust, dulceDrop, sugarDust, (c, r) => crumb(c, r, '#b98543')],
  },
  fiambrera: {
    tile: fridgeTile,
    tileSize: 192,
    track: {
      shadow: 'rgba(70,56,30,0.3)',
      edge: '#9aa0a6',
      base: '#33434b',
      inner: '#40535c',
      dash: '#f0e5c6',
    },
    props: [hamSlice, cheeseSlice, peppercorn, hamSlice],
  },
}

// ---------- Obstáculos que chocan ----------

function shadowOf(ctx: Ctx, r: number) {
  ctx.fillStyle = 'rgba(30,20,14,0.28)'
  ctx.beginPath()
  ctx.ellipse(3, 5, r * 1.02, r * 0.88, 0, 0, Math.PI * 2)
  ctx.fill()
}

export function drawSolid(ctx: Ctx, kind: SolidKind, r: number) {
  shadowOf(ctx, r)
  ctx.lineWidth = 2
  ctx.strokeStyle = INK
  switch (kind) {
    case 'jar': // pote de dulce de leche Havanna visto desde arriba
      ctx.fillStyle = '#f2c230'
      circle(ctx, 0, 0, r)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#e0a418'
      circle(ctx, 0, 0, r * 0.78)
      ctx.fill()
      ctx.fillStyle = '#fff6e0'
      ctx.beginPath()
      ctx.roundRect(-r * 0.5, -r * 0.2, r, r * 0.4, 3)
      ctx.fill()
      ctx.fillStyle = '#e0561e'
      ctx.fillRect(-r * 0.38, -r * 0.06, r * 0.76, r * 0.12)
      break
    case 'tin': // lata negra con alfajores
      ctx.fillStyle = '#2b2b30'
      circle(ctx, 0, 0, r)
      ctx.fill()
      ctx.stroke()
      for (const [dx, dy] of [
        [-0.4, -0.3],
        [0.35, -0.35],
        [0, 0.15],
        [-0.35, 0.4],
        [0.4, 0.35],
      ] as const) {
        ctx.save()
        ctx.translate(dx * r, dy * r)
        caramelo(ctx, r * 0.38)
        ctx.restore()
      }
      break
    case 'miga': // pila de sándwiches de miga
      ctx.fillStyle = '#fffaf0'
      ctx.beginPath()
      ctx.roundRect(-r, -r, r * 2, r * 2, 5)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#f0a0a0'
      ctx.fillRect(-r, -r * 0.25, r * 2, r * 0.22)
      ctx.fillStyle = '#f7d96a'
      ctx.fillRect(-r, r * 0.0, r * 2, r * 0.2)
      ctx.fillStyle = 'rgba(255,255,255,0.7)'
      ctx.fillRect(-r * 0.85, -r * 0.85, r * 0.5, r * 0.18)
      break
    case 'film': // rollo de film violeta
      ctx.fillStyle = '#a45fb3'
      circle(ctx, 0, 0, r)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#c98bd6'
      circle(ctx, 0, 0, r * 0.62)
      ctx.fill()
      ctx.fillStyle = '#c9a36b'
      circle(ctx, 0, 0, r * 0.42)
      ctx.fill()
      ctx.fillStyle = '#6b4a2b'
      circle(ctx, 0, 0, r * 0.26)
      ctx.fill()
      break
    case 'labels': // rollo de etiquetas amarillas
      ctx.fillStyle = '#f2dd6a'
      circle(ctx, 0, 0, r)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#e8c93a'
      circle(ctx, 0, 0, r * 0.62)
      ctx.fill()
      ctx.fillStyle = '#d9d0b8'
      circle(ctx, 0, 0, r * 0.38)
      ctx.fill()
      break
    case 'grill': // plancha de sándwiches
      ctx.fillStyle = '#b9bec5'
      ctx.beginPath()
      ctx.roundRect(-r, -r * 0.85, r * 2, r * 1.7, 6)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#26262b'
      ctx.beginPath()
      ctx.roundRect(-r * 0.7, -r * 0.55, r * 1.4, r * 1.1, 4)
      ctx.fill()
      ctx.fillStyle = '#d9dde2'
      circle(ctx, 0, 0, r * 0.3)
      ctx.fill()
      break
    case 'cups': // pila de vasos de cartón
      ctx.fillStyle = '#c99a5f'
      circle(ctx, 0, 0, r)
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = 'rgba(42,26,20,0.45)'
      ctx.lineWidth = 1.4
      for (const k of [0.8, 0.6, 0.4]) {
        circle(ctx, 0, 0, r * k)
        ctx.stroke()
      }
      ctx.fillStyle = '#fff6e0'
      circle(ctx, 0, 0, r * 0.22)
      ctx.fill()
      break
    case 'jug': // jarra de leche de acero
      ctx.fillStyle = '#cfd4da'
      circle(ctx, 0, 0, r)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#f4f6f8'
      circle(ctx, 0, 0, r * 0.66)
      ctx.fill()
      ctx.strokeStyle = INK
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(r * 0.95, 0, r * 0.4, -1.3, 1.3)
      ctx.stroke()
      break
    case 'grinder': // molino de café con granos
      ctx.fillStyle = '#8c929b'
      ctx.beginPath()
      ctx.roundRect(-r, -r, r * 2, r * 2, 7)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#4a2c1c'
      circle(ctx, 0, 0, r * 0.62)
      ctx.fill()
      ctx.fillStyle = '#6b4128'
      for (const [dx, dy] of [
        [-0.25, -0.2],
        [0.2, -0.25],
        [0.05, 0.25],
      ] as const) {
        circle(ctx, dx * r, dy * r, r * 0.16)
        ctx.fill()
      }
      break
    case 'cinnamon': // cinnamon roll con glaseado
      ctx.fillStyle = '#c98b4a'
      circle(ctx, 0, 0, r)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#fff6e8'
      circle(ctx, 0, 0, r * 0.78)
      ctx.fill()
      ctx.strokeStyle = '#8b4a1a'
      ctx.lineWidth = 2.4
      ctx.beginPath()
      for (let a = 0; a < Math.PI * 5; a += 0.3) {
        const rad = (a / (Math.PI * 5)) * r * 0.6
        ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad)
      }
      ctx.stroke()
      break
    case 'croissant': // medialuna
      ctx.fillStyle = '#e2a95a'
      ctx.beginPath()
      ctx.arc(0, 0, r, Math.PI * 0.15, Math.PI * 1.85)
      ctx.arc(r * 0.2, 0, r * 0.55, Math.PI * 1.85, Math.PI * 0.15, true)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = '#a8631f'
      ctx.lineWidth = 1.6
      for (const a of [0.6, 1.1, 1.6, 2.1, 2.6]) {
        ctx.beginPath()
        ctx.moveTo(Math.cos(a + 3) * r * 0.62, Math.sin(a + 3) * r * 0.62)
        ctx.lineTo(Math.cos(a + 3) * r * 0.95, Math.sin(a + 3) * r * 0.95)
        ctx.stroke()
      }
      break
    case 'cheese': // queso en rueda
      ctx.fillStyle = '#f7d65a'
      circle(ctx, 0, 0, r)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#d9b02a'
      for (const [dx, dy, s] of [
        [-0.35, -0.2, 0.18],
        [0.3, 0.1, 0.22],
        [-0.1, 0.4, 0.14],
      ] as const) {
        circle(ctx, dx * r, dy * r, s * r)
        ctx.fill()
      }
      break
    case 'ham': // rollo de jamón
      ctx.fillStyle = '#efa3a3'
      circle(ctx, 0, 0, r)
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = '#c96a6a'
      ctx.lineWidth = 2
      circle(ctx, 0, 0, r * 0.62)
      ctx.stroke()
      circle(ctx, 0, 0, r * 0.28)
      ctx.stroke()
      break
    default:
  }
}

// ---------- Charcos ----------

const ZONE_COLORS: Record<ZoneKind, [string, string]> = {
  dulce: ['#a8651f', '#c98838'],
  coffee: ['#4a2c1c', '#6b4128'],
  water: ['#8cc8e8', '#bfe3f4'],
  oil: ['#d9b85a', '#f0d98a'],
}

export function drawZone(ctx: Ctx, kind: ZoneKind, r: number) {
  const [dark, light] = ZONE_COLORS[kind]
  ctx.globalAlpha = 0.92
  ctx.fillStyle = dark
  ctx.beginPath()
  ctx.ellipse(0, 0, r, r * 0.82, 0.4, 0, Math.PI * 2)
  ctx.fill()
  circle(ctx, r * 0.6, -r * 0.3, r * 0.45)
  ctx.fill()
  circle(ctx, -r * 0.55, r * 0.35, r * 0.4)
  ctx.fill()
  ctx.fillStyle = light
  ctx.beginPath()
  ctx.ellipse(-r * 0.15, -r * 0.1, r * 0.55, r * 0.35, 0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  circle(ctx, -r * 0.35, -r * 0.3, r * 0.1)
  ctx.fill()
}

// ---------- Hoja de la fiambrera ----------

export function drawBlade(ctx: Ctx, r: number, angle: number) {
  shadowOf(ctx, r)
  ctx.save()
  ctx.rotate(angle)
  ctx.fillStyle = '#d5d9de'
  circle(ctx, 0, 0, r)
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.strokeStyle = 'rgba(90,96,104,0.7)'
  ctx.lineWidth = 1.5
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos((i * Math.PI) / 2) * r, Math.sin((i * Math.PI) / 2) * r)
    ctx.stroke()
  }
  ctx.fillStyle = '#9aa0a6'
  circle(ctx, 0, 0, r * 0.3)
  ctx.fill()
  ctx.fillStyle = '#c8102e'
  circle(ctx, r * 0.85, 0, 2.4)
  ctx.fill()
  ctx.restore()
}
