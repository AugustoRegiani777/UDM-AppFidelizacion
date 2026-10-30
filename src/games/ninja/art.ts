// Dibujo vectorial de las cosas de "Miga Ninja". Todo se dibuja en un espacio de radio 1 centrado
// en (0,0). Se pinta una sola vez en sprites (entero y las dos mitades con su corte) y después el
// lazo de render solo copia imágenes: así se mantiene fluido en un Android de gama media.
//
// El corte siempre es la línea local y = 0. Cada cosa está orientada para que ese corte la parta
// por el medio y muestre el relleno (capas del sándwich, hojaldre de la medialuna, café, etc.).

import type { ItemKind } from './engine.ts'

export const INK = '#2a1a14'
export const CREAM = '#faf3e3'
export const RED = '#c8102e'
export const GOLD = '#e3a21a'

/** Colores de las gotas y migas que saltan al cortar cada cosa. */
export const SPLASH: Record<ItemKind, [string, string]> = {
  sandwich: ['#fff1cf', '#6fae3c'],
  medialuna: ['#e3a458', '#fbe7a8'],
  chipa: ['#f1c777', '#fff0c2'],
  cinnamon: ['#8a5126', '#ffffff'],
  cafe: ['#5a3320', '#c89a6a'],
  golden: ['#f6c945', '#fff3b0'],
  ice: ['#8fd0f2', '#e9f7ff'],
  ant: ['#2a1a14', '#c8102e'],
}

const paths = new Map<ItemKind, Path2D>()

function ellipsePath(path: Path2D, x: number, y: number, rx: number, ry: number) {
  path.moveTo(x + rx, y)
  path.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
}

/** Silueta del cuerpo (sin adornos que sobresalen): sirve para recortar el relleno del corte. */
function silhouette(kind: ItemKind): Path2D {
  const cached = paths.get(kind)
  if (cached) return cached
  const p = new Path2D()
  switch (kind) {
    case 'sandwich':
      p.moveTo(1.02, 0)
      p.lineTo(-0.8, -0.95)
      p.lineTo(-0.8, 0.95)
      p.closePath()
      break
    case 'medialuna':
      p.moveTo(0.6, -0.85)
      p.bezierCurveTo(-0.35, -1.0, -1.0, -0.55, -1.0, 0)
      p.bezierCurveTo(-1.0, 0.55, -0.35, 1.0, 0.6, 0.85)
      p.bezierCurveTo(0.2, 0.62, -0.2, 0.34, -0.2, 0)
      p.bezierCurveTo(-0.2, -0.34, 0.2, -0.62, 0.6, -0.85)
      p.closePath()
      break
    case 'chipa':
      ellipsePath(p, 0, 0, 0.92, 0.88)
      break
    case 'cinnamon':
    case 'golden':
      ellipsePath(p, 0, 0, 0.97, 0.97)
      break
    case 'cafe':
    case 'ice':
      p.moveTo(-0.72, -0.52)
      p.lineTo(0.72, -0.52)
      p.lineTo(0.56, 0.4)
      p.quadraticCurveTo(0.5, 0.64, 0.26, 0.64)
      p.lineTo(-0.26, 0.64)
      p.quadraticCurveTo(-0.5, 0.64, -0.56, 0.4)
      p.closePath()
      break
    case 'ant':
      ellipsePath(p, 0, -0.66, 0.32, 0.3)
      ellipsePath(p, 0, -0.08, 0.27, 0.3)
      ellipsePath(p, 0, 0.52, 0.42, 0.5)
      break
  }
  paths.set(kind, p)
  return p
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
}

function stroke(ctx: CanvasRenderingContext2D, color: string, width: number) {
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.stroke()
}

// ---- exterior (la cosa entera) ----------------------------------------------------------

function rollBody(ctx: CanvasRenderingContext2D, golden: boolean) {
  const g = ctx.createRadialGradient(-0.3, -0.35, 0.1, 0, 0, 1)
  if (golden) {
    g.addColorStop(0, '#ffe58a')
    g.addColorStop(0.6, '#f0b429')
    g.addColorStop(1, '#b97a0f')
  } else {
    g.addColorStop(0, '#dca066')
    g.addColorStop(0.7, '#b9742f')
    g.addColorStop(1, '#8e5222')
  }
  ctx.fillStyle = g
  ctx.fill(silhouette(golden ? 'golden' : 'cinnamon'))
  // Espiral de canela.
  ctx.beginPath()
  for (let a = 0; a < Math.PI * 5.2; a += 0.15) {
    const r = 0.1 + a * 0.052
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (a === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  stroke(ctx, golden ? '#9a5b08' : '#5e3417', 0.1)
  // Glaseado.
  ctx.beginPath()
  ctx.moveTo(-0.7, -0.3)
  ctx.lineTo(-0.2, -0.5)
  ctx.lineTo(-0.35, -0.05)
  ctx.lineTo(0.2, -0.3)
  ctx.lineTo(0.1, 0.2)
  ctx.lineTo(0.62, -0.05)
  ctx.lineTo(0.45, 0.45)
  ctx.lineTo(-0.1, 0.55)
  stroke(ctx, golden ? '#fffbe6' : '#fff8ec', 0.09)
}

function cup(ctx: CanvasRenderingContext2D, ice: boolean) {
  // Plato.
  ctx.fillStyle = ice ? '#cfe9f7' : '#e9e0d0'
  ctx.beginPath()
  ctx.ellipse(0, 0.7, 0.98, 0.17, 0, 0, Math.PI * 2)
  ctx.fill()
  stroke(ctx, INK, 0.05)
  // Asa.
  ring(ctx, 0.78, -0.02, 0.27)
  stroke(ctx, INK, 0.2)
  ring(ctx, 0.78, -0.02, 0.27)
  stroke(ctx, ice ? '#f4fbff' : '#ffffff', 0.11)
  // Cuerpo.
  ctx.fillStyle = ice ? '#f4fbff' : '#ffffff'
  ctx.fill(silhouette(ice ? 'ice' : 'cafe'))
  ctx.save()
  ctx.clip(silhouette(ice ? 'ice' : 'cafe'))
  ctx.fillStyle = ice ? '#4aa3d8' : RED
  ctx.fillRect(-1, 0.1, 2, 0.2)
  ctx.fillStyle = ice ? '#dff1fb' : '#eee6da'
  ctx.fillRect(0.3, -0.52, 0.5, 1.2)
  ctx.restore()
  stroke(ctx, INK, 0.055)
  ctx.stroke(silhouette(ice ? 'ice' : 'cafe'))
  // Café arriba.
  ctx.beginPath()
  ctx.ellipse(0, -0.52, 0.72, 0.17, 0, 0, Math.PI * 2)
  ctx.fillStyle = ice ? '#b9e3f7' : '#5a3320'
  ctx.fill()
  stroke(ctx, INK, 0.05)
  ctx.beginPath()
  ctx.ellipse(-0.05, -0.54, 0.4, 0.07, 0, 0, Math.PI * 2)
  ctx.fillStyle = ice ? '#f4fbff' : '#c89a6a'
  ctx.fill()
  if (ice) {
    // Copo de nieve.
    ctx.beginPath()
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI) / 3
      ctx.moveTo(-Math.cos(a) * 0.17, 0.2 - Math.sin(a) * 0.17)
      ctx.lineTo(Math.cos(a) * 0.17, 0.2 + Math.sin(a) * 0.17)
    }
    stroke(ctx, '#ffffff', 0.045)
  }
}

function ant(ctx: CanvasRenderingContext2D) {
  // Patas y antenas.
  ctx.beginPath()
  for (const side of [-1, 1]) {
    for (const [y, reach, drop] of [
      [-0.2, 0.62, -0.28],
      [-0.06, 0.78, 0.04],
      [0.1, 0.66, 0.4],
    ] as const) {
      ctx.moveTo(side * 0.2, y)
      ctx.lineTo(side * reach, y + drop * 0.5)
      ctx.lineTo(side * (reach + 0.1), y + drop)
    }
    ctx.moveTo(side * 0.12, -0.9)
    ctx.quadraticCurveTo(side * 0.2, -1.12, side * 0.46, -1.08)
  }
  stroke(ctx, '#1d110c', 0.075)
  // Cuerpo.
  const body = silhouette('ant')
  ctx.fillStyle = '#2b1913'
  ctx.fill(body)
  stroke(ctx, '#0f0805', 0.04)
  ctx.stroke(body)
  // Brillo en el abdomen y cinturón rojo (la marca).
  ctx.beginPath()
  ctx.ellipse(-0.14, 0.38, 0.1, 0.2, 0.3, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.fill()
  ctx.fillStyle = RED
  ctx.fillRect(-0.4, 0.14, 0.8, 0.1)
  // Cara: ojos enojados y bigotito.
  for (const side of [-1, 1]) {
    ring(ctx, side * 0.15, -0.68, 0.12)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ring(ctx, side * 0.15 + side * -0.02, -0.66, 0.055)
    ctx.fillStyle = '#000000'
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(side * 0.03, -0.86)
    ctx.lineTo(side * 0.27, -0.78)
    stroke(ctx, RED, 0.055)
  }
  ctx.beginPath()
  ctx.moveTo(-0.12, -0.5)
  ctx.quadraticCurveTo(0, -0.58, 0.12, -0.5)
  stroke(ctx, '#e9d6c4', 0.04)
}

/** La cosa entera. */
export function drawWhole(ctx: CanvasRenderingContext2D, kind: ItemKind): void {
  switch (kind) {
    case 'sandwich': {
      const body = silhouette('sandwich')
      ctx.fillStyle = '#fff5da'
      ctx.fill(body)
      ctx.save()
      ctx.clip(body)
      // Capas que asoman en el lado ancho.
      const layers = ['#fff5da', '#6fae3c', '#f0a0a8', '#f4c542', '#fff5da']
      layers.forEach((color, i) => {
        ctx.fillStyle = color
        ctx.fillRect(-0.84 + i * 0.075, -1, 0.08, 2)
      })
      // Tapa más clara y un palito con banderita roja.
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.beginPath()
      ctx.moveTo(0.72, 0)
      ctx.lineTo(-0.38, -0.6)
      ctx.lineTo(-0.38, 0.6)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      stroke(ctx, '#d6b36d', 0.07)
      ctx.stroke(body)
      ctx.beginPath()
      ctx.moveTo(0.1, -0.1)
      ctx.lineTo(0.5, -0.1)
      stroke(ctx, INK, 0.035)
      ctx.beginPath()
      ctx.moveTo(0.5, -0.2)
      ctx.lineTo(0.78, -0.1)
      ctx.lineTo(0.5, 0)
      ctx.closePath()
      ctx.fillStyle = RED
      ctx.fill()
      break
    }
    case 'medialuna': {
      const body = silhouette('medialuna')
      const g = ctx.createLinearGradient(-1, -1, 0.6, 0.9)
      g.addColorStop(0, '#f2c070')
      g.addColorStop(0.55, '#d98d3a')
      g.addColorStop(1, '#a8601e')
      ctx.fillStyle = g
      ctx.fill(body)
      ctx.save()
      ctx.clip(body)
      // Costillas del hojaldre.
      ctx.beginPath()
      for (let i = -3; i <= 3; i++) {
        const a = (i / 3) * 1.05
        ctx.moveTo(-0.28 + Math.cos(a + Math.PI) * 0.1 - 0.02, Math.sin(a) * 0.4)
        ctx.lineTo(-1.1 + Math.cos(a) * 0.0 - 0.0, Math.sin(a) * 1.1)
      }
      stroke(ctx, 'rgba(120,64,16,0.55)', 0.06)
      ctx.beginPath()
      ctx.ellipse(-0.62, -0.38, 0.18, 0.4, 0.6, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.fill()
      ctx.restore()
      stroke(ctx, '#7a4318', 0.05)
      ctx.stroke(body)
      break
    }
    case 'chipa': {
      const g = ctx.createRadialGradient(-0.3, -0.3, 0.1, 0, 0, 1)
      g.addColorStop(0, '#f6d58f')
      g.addColorStop(1, '#d49a45')
      ctx.fillStyle = g
      const body = silhouette('chipa')
      ctx.fill(body)
      // Bolitas de queso y la costura de la masa.
      for (const [x, y, r] of [
        [-0.4, -0.35, 0.16],
        [0.25, -0.5, 0.13],
        [0.5, 0.05, 0.17],
        [-0.15, 0.3, 0.15],
        [-0.6, 0.15, 0.1],
        [0.2, 0.5, 0.11],
      ] as const) {
        ring(ctx, x, y, r)
        ctx.fillStyle = 'rgba(255,240,194,0.85)'
        ctx.fill()
      }
      ctx.beginPath()
      ctx.moveTo(-0.55, -0.1)
      ctx.quadraticCurveTo(0, -0.3, 0.6, -0.1)
      stroke(ctx, 'rgba(142,82,34,0.55)', 0.05)
      stroke(ctx, '#8e5222', 0.055)
      ctx.stroke(body)
      break
    }
    case 'cinnamon':
      rollBody(ctx, false)
      stroke(ctx, '#5e3417', 0.05)
      ctx.stroke(silhouette('cinnamon'))
      break
    case 'golden': {
      // Aureola.
      const halo = ctx.createRadialGradient(0, 0, 0.9, 0, 0, 1.4)
      halo.addColorStop(0, 'rgba(255,214,90,0.55)')
      halo.addColorStop(1, 'rgba(255,214,90,0)')
      ctx.fillStyle = halo
      ring(ctx, 0, 0, 1.4)
      ctx.fill()
      rollBody(ctx, true)
      stroke(ctx, '#8a5208', 0.055)
      ctx.stroke(silhouette('golden'))
      // Destellos.
      for (const [x, y, s] of [
        [-0.78, -0.7, 0.2],
        [0.85, -0.45, 0.15],
        [0.7, 0.8, 0.17],
      ] as const) {
        ctx.beginPath()
        ctx.moveTo(x - s, y)
        ctx.lineTo(x + s, y)
        ctx.moveTo(x, y - s)
        ctx.lineTo(x, y + s)
        stroke(ctx, '#fff6c2', 0.05)
      }
      break
    }
    case 'cafe':
      cup(ctx, false)
      break
    case 'ice': {
      const halo = ctx.createRadialGradient(0, 0, 0.8, 0, 0, 1.4)
      halo.addColorStop(0, 'rgba(120,200,245,0.5)')
      halo.addColorStop(1, 'rgba(120,200,245,0)')
      ctx.fillStyle = halo
      ring(ctx, 0, 0, 1.4)
      ctx.fill()
      cup(ctx, true)
      break
    }
    case 'ant':
      ant(ctx)
      break
  }
}

// ---- relleno del corte ------------------------------------------------------------------

/** Pinta el relleno visible del corte, en una franja pegada a y = 0 del lado `side`. */
function drawFace(ctx: CanvasRenderingContext2D, kind: ItemKind, side: -1 | 1) {
  ctx.save()
  ctx.clip(silhouette(kind))
  const y0 = side < 0 ? -0.44 : 0
  switch (kind) {
    case 'sandwich': {
      // Capas de pan, lechuga, jamón y queso vistas de canto.
      const layers = ['#fff5da', '#7bbf45', '#f0a0a8', '#f4c542', '#fff5da', '#7bbf45', '#fff5da']
      layers.forEach((color, i) => {
        ctx.fillStyle = color
        const y = side < 0 ? -0.06 * (i + 1) : 0.06 * i
        ctx.fillRect(-1, y, 2.2, 0.065)
      })
      break
    }
    case 'medialuna': {
      ctx.fillStyle = '#fbe7a8'
      ctx.fillRect(-1.1, y0, 1.6, 0.44)
      ctx.beginPath()
      for (let i = 0; i < 4; i++) {
        const y = side < 0 ? -0.08 - i * 0.09 : 0.08 + i * 0.09
        ctx.moveTo(-1.05, y)
        ctx.quadraticCurveTo(-0.7, y + side * 0.05, -0.3, y)
      }
      stroke(ctx, '#d9a152', 0.035)
      break
    }
    case 'chipa': {
      ctx.fillStyle = '#fff0c4'
      ctx.fillRect(-1, y0, 2, 0.44)
      for (const [x, y, r] of [
        [-0.5, 0.12, 0.07],
        [-0.1, 0.22, 0.09],
        [0.3, 0.1, 0.06],
        [0.55, 0.26, 0.07],
        [-0.7, 0.3, 0.05],
      ] as const) {
        ring(ctx, x, side * y, r)
        ctx.fillStyle = '#e6b866'
        ctx.fill()
      }
      break
    }
    case 'cinnamon':
    case 'golden': {
      ctx.fillStyle = kind === 'golden' ? '#ffe9a0' : '#e8c08a'
      ctx.fillRect(-1, y0, 2, 0.44)
      ctx.beginPath()
      for (let i = 0; i < 3; i++) {
        const x = -0.7 + i * 0.35
        ctx.moveTo(x, 0)
        ctx.quadraticCurveTo(x + 0.17, side * 0.44, x + 0.35, 0)
      }
      stroke(ctx, kind === 'golden' ? '#a8650b' : '#6a3a18', 0.06)
      break
    }
    case 'cafe':
    case 'ice': {
      ctx.fillStyle = kind === 'ice' ? '#b9e3f7' : '#5a3320'
      ctx.fillRect(-1, y0, 2, 0.44)
      ctx.beginPath()
      ctx.moveTo(-0.5, side * 0.12)
      ctx.quadraticCurveTo(0, side * 0.2, 0.5, side * 0.12)
      stroke(ctx, kind === 'ice' ? '#f4fbff' : '#c89a6a', 0.05)
      break
    }
    case 'ant': {
      ctx.fillStyle = '#7a4a34'
      ctx.fillRect(-1, y0, 2, 0.44)
      ring(ctx, 0, side * 0.13, 0.08)
      ctx.fillStyle = RED
      ctx.fill()
      break
    }
  }
  ctx.restore()
}

/** Una mitad: `side` -1 = la de arriba (y < 0), 1 = la de abajo (y > 0). */
export function drawHalf(ctx: CanvasRenderingContext2D, kind: ItemKind, side: -1 | 1): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(-1.6, side < 0 ? -1.6 : 0, 3.2, 1.6)
  ctx.clip()
  drawWhole(ctx, kind)
  ctx.restore()
  drawFace(ctx, kind, side)
  // Borde del corte.
  ctx.save()
  ctx.clip(silhouette(kind))
  ctx.beginPath()
  ctx.moveTo(-1.2, 0)
  ctx.lineTo(1.2, 0)
  stroke(ctx, 'rgba(42,26,20,0.55)', 0.06)
  ctx.restore()
}
