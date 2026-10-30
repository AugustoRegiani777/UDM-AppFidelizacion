// Fondos de cada nivel. Se dibujan una sola vez en un canvas aparte (al cambiar el tamaño) y el
// lazo de render solo los copia. Formas simples y baratas; los colores son oscuros o saturados para
// que las cosas claras (pan, medialunas) resalten.

import type { SceneId } from './levels.ts'

type Ctx = CanvasRenderingContext2D

function gradient(ctx: Ctx, w: number, h: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, 0, 0, h)
  for (const [at, color] of stops) g.addColorStop(at, color)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
}

function circle(ctx: Ctx, x: number, y: number, r: number, fill: string) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
}

function checker(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  size: number,
  a: string,
  b: string,
) {
  for (let j = 0; j * size < h; j++) {
    for (let i = 0; i * size < w; i++) {
      ctx.fillStyle = (i + j) % 2 === 0 ? a : b
      ctx.fillRect(x + i * size, y + j * size, size, size)
    }
  }
}

function arch(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string) {
  ctx.beginPath()
  ctx.moveTo(x, y + h)
  ctx.lineTo(x, y + w / 2)
  ctx.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0)
  ctx.lineTo(x + w, y + h)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

/** Estrella de varias puntas (fuegos artificiales, destellos). */
function burst(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  rays: number,
  color: string,
  width: number,
) {
  ctx.beginPath()
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2
    ctx.moveTo(x + Math.cos(a) * r * 0.3, y + Math.sin(a) * r * 0.3)
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r)
  }
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.stroke()
}

export function drawScene(ctx: Ctx, w: number, h: number, scene: SceneId): void {
  const u = Math.min(w, h * 0.6) / 100 // unidad de diseño
  switch (scene) {
    case 'counter': {
      gradient(ctx, w, h, [
        [0, '#7a1a22'],
        [1, '#43101a'],
      ])
      // Azulejos de la pared y el mostrador.
      checker(ctx, 0, 0, w, h * 0.55, u * 9, 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.06)')
      ctx.fillStyle = '#2a1a14'
      ctx.fillRect(0, h * 0.82, w, h * 0.18)
      ctx.fillStyle = '#c8102e'
      ctx.fillRect(0, h * 0.82, w, u * 1.4)
      checker(ctx, 0, h * 0.86, w, h * 0.14, u * 7, '#3a2418', '#2a1a14')
      for (const x of [0.2, 0.5, 0.8]) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)'
        ctx.fillRect(w * x - 1, 0, 2, h * 0.2)
        circle(ctx, w * x, h * 0.2, u * 4.5, '#f6c945')
        circle(ctx, w * x, h * 0.2, u * 7.5, 'rgba(246,201,69,0.18)')
      }
      break
    }
    case 'vitrine': {
      gradient(ctx, w, h, [
        [0, '#2f4a56'],
        [1, '#1b2e38'],
      ])
      for (let i = 1; i < 5; i++) {
        const y = (h * i) / 5
        ctx.fillStyle = 'rgba(190,225,240,0.22)'
        ctx.fillRect(0, y, w, u * 1.3)
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fillRect(0, y + u * 1.3, w, u * 6)
      }
      ctx.fillStyle = 'rgba(255,255,255,0.07)'
      ctx.beginPath()
      ctx.moveTo(w * 0.1, 0)
      ctx.lineTo(w * 0.32, 0)
      ctx.lineTo(w * 0.12, h)
      ctx.lineTo(-w * 0.1, h)
      ctx.fill()
      break
    }
    case 'bakery': {
      gradient(ctx, w, h, [
        [0, '#4a2c1c'],
        [1, '#2b170d'],
      ])
      // Ladrillos.
      for (let j = 0; j * u * 5 < h; j++) {
        for (let i = -1; i * u * 12 < w; i++) {
          ctx.fillStyle = (i + j) % 3 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.07)'
          ctx.fillRect(i * u * 12 + (j % 2) * u * 6 + 1, j * u * 5 + 1, u * 12 - 2, u * 5 - 2)
        }
      }
      // Boca del horno con brasas.
      arch(ctx, w * 0.2, h * 0.7, w * 0.6, h * 0.3, '#17090a')
      const glow = ctx.createRadialGradient(w / 2, h, 0, w / 2, h, w * 0.5)
      glow.addColorStop(0, 'rgba(255,150,40,0.55)')
      glow.addColorStop(1, 'rgba(255,150,40,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, h * 0.5, w, h * 0.5)
      break
    }
    case 'espresso': {
      gradient(ctx, w, h, [
        [0, '#3b2418'],
        [1, '#1d100a'],
      ])
      circle(ctx, w * 0.5, h * 0.2, u * 17, '#5a3a28')
      circle(ctx, w * 0.5, h * 0.2, u * 14, '#2a1a14')
      circle(ctx, w * 0.5, h * 0.2, u * 1.4, '#f6c945')
      burst(ctx, w * 0.5, h * 0.2, u * 12, 18, 'rgba(250,243,227,0.55)', 2)
      for (const x of [0.12, 0.88]) {
        ctx.fillStyle = '#c8102e'
        ctx.fillRect(w * x - u * 5, h * 0.55, u * 10, u * 22)
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.fillRect(w * x - u * 3, h * 0.55, u * 2, u * 22)
      }
      ctx.beginPath()
      for (const x of [0.3, 0.7]) {
        ctx.moveTo(w * x, h * 0.62)
        ctx.bezierCurveTo(w * (x - 0.08), h * 0.5, w * (x + 0.08), h * 0.42, w * x, h * 0.3)
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.lineWidth = u * 2
      ctx.stroke()
      break
    }
    case 'plaza': {
      gradient(ctx, w, h, [
        [0, '#26346b'],
        [0.55, '#8c4a7a'],
        [1, '#f08a5d'],
      ])
      circle(ctx, w * 0.78, h * 0.62, u * 9, 'rgba(255,230,160,0.9)')
      // Edificios de la plaza y la torre del reloj.
      ctx.fillStyle = '#21142b'
      const widths = [0.16, 0.12, 0.2, 0.1, 0.18, 0.14, 0.2]
      let x = 0
      for (const [i, ww] of widths.entries()) {
        const bh = h * (0.12 + ((i * 37) % 7) * 0.012)
        ctx.fillRect(x * w, h - bh - h * 0.08, ww * w + 1, bh + h * 0.08)
        x += ww
      }
      ctx.fillRect(w * 0.44, h * 0.62, w * 0.12, h * 0.38)
      ctx.beginPath()
      ctx.moveTo(w * 0.43, h * 0.62)
      ctx.lineTo(w * 0.5, h * 0.52)
      ctx.lineTo(w * 0.57, h * 0.62)
      ctx.fill()
      circle(ctx, w * 0.5, h * 0.7, u * 3, '#f6e3b0')
      ctx.fillStyle = '#17101d'
      ctx.fillRect(0, h * 0.94, w, h * 0.06)
      break
    }
    case 'market': {
      gradient(ctx, w, h, [
        [0, '#1f4a3d'],
        [1, '#10291f'],
      ])
      // Toldos rojos y crema arriba.
      const stripe = u * 8
      for (let i = 0; i * stripe < w; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#c8102e' : '#faf3e3'
        ctx.fillRect(i * stripe, 0, stripe, h * 0.08)
        circle(
          ctx,
          i * stripe + stripe / 2,
          h * 0.08,
          stripe / 2,
          i % 2 === 0 ? '#c8102e' : '#faf3e3',
        )
      }
      // Arcos del mercado.
      for (let i = 0; i < 3; i++) {
        arch(ctx, w * (0.06 + i * 0.32), h * 0.3, w * 0.28, h * 0.7, 'rgba(0,0,0,0.22)')
      }
      ctx.fillStyle = 'rgba(246,201,69,0.12)'
      ctx.fillRect(0, h * 0.9, w, h * 0.1)
      break
    }
    case 'beach': {
      gradient(ctx, w, h, [
        [0, '#2d86c4'],
        [0.5, '#7cc7e8'],
        [0.62, '#1f7fa3'],
        [0.78, '#2a9bb8'],
        [0.8, '#e8c47c'],
        [1, '#c99a4e'],
      ])
      circle(ctx, w * 0.2, h * 0.14, u * 8, '#fff2b0')
      circle(ctx, w * 0.2, h * 0.14, u * 13, 'rgba(255,242,176,0.25)')
      // Olas.
      ctx.beginPath()
      for (let y = 0.64; y < 0.78; y += 0.045) {
        for (let xx = 0; xx <= w; xx += u * 3) {
          const yy = h * y + Math.sin(xx / (u * 5) + y * 40) * u * 0.8
          if (xx === 0) ctx.moveTo(xx, yy)
          else ctx.lineTo(xx, yy)
        }
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = u * 0.6
      ctx.stroke()
      // Palmeras.
      ctx.strokeStyle = '#4b2e1a'
      ctx.lineWidth = u * 1.6
      ctx.beginPath()
      ctx.moveTo(w * 0.86, h * 0.84)
      ctx.quadraticCurveTo(w * 0.8, h * 0.62, w * 0.84, h * 0.46)
      ctx.stroke()
      ctx.strokeStyle = '#2b6a2c'
      ctx.lineWidth = u * 1.4
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = Math.PI + (i / 5) * Math.PI
        ctx.moveTo(w * 0.84, h * 0.46)
        ctx.quadraticCurveTo(
          w * 0.84 + Math.cos(a) * u * 9,
          h * 0.46 + Math.sin(a) * u * 12,
          w * 0.84 + Math.cos(a) * u * 14,
          h * 0.46 + Math.sin(a) * u * 6 + u * 6,
        )
      }
      ctx.stroke()
      break
    }
    case 'arts': {
      gradient(ctx, w, h, [
        [0, '#12295b'],
        [0.7, '#2f6fa8'],
        [1, '#0f3a5e'],
      ])
      // Arcos blancos de la Ciudad de las Artes y su reflejo en el agua.
      ctx.strokeStyle = 'rgba(245,250,255,0.85)'
      ctx.lineWidth = u * 2.6
      ctx.lineCap = 'round'
      for (let i = 0; i < 4; i++) {
        ctx.beginPath()
        ctx.ellipse(w * (0.12 + i * 0.25), h * 0.72, w * 0.16, h * 0.42, 0, Math.PI, 0)
        ctx.stroke()
      }
      ctx.fillStyle = 'rgba(8,30,60,0.55)'
      ctx.fillRect(0, h * 0.72, w, h * 0.28)
      ctx.strokeStyle = 'rgba(245,250,255,0.25)'
      for (let i = 0; i < 4; i++) {
        ctx.beginPath()
        ctx.ellipse(w * (0.12 + i * 0.25), h * 0.72, w * 0.16, h * 0.2, 0, 0, Math.PI)
        ctx.stroke()
      }
      circle(ctx, w * 0.82, h * 0.14, u * 5, '#fff7d0')
      break
    }
    case 'fallas': {
      gradient(ctx, w, h, [
        [0, '#150a30'],
        [1, '#3b0f3f'],
      ])
      const colors = ['#f6c945', '#ff5a7a', '#6fd0ff', '#9cff8a']
      const spots: [number, number, number][] = [
        [0.22, 0.2, 14],
        [0.74, 0.14, 11],
        [0.5, 0.34, 17],
        [0.88, 0.42, 9],
        [0.1, 0.46, 10],
      ]
      spots.forEach(([x, y, r], i) =>
        burst(ctx, w * x, h * y, u * r, 16, colors[i % colors.length]!, u * 0.7),
      )
      // Guirnaldas de luces.
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.lineWidth = 1.5
      for (const y of [0.62, 0.74]) {
        ctx.beginPath()
        ctx.moveTo(0, h * y)
        ctx.quadraticCurveTo(w / 2, h * (y + 0.06), w, h * y)
        ctx.stroke()
        for (let i = 1; i < 9; i++) {
          const t = i / 9
          const yy = h * y * (1 - t) * (1 - t) + 2 * h * (y + 0.06) * t * (1 - t) + h * y * t * t
          circle(ctx, w * t, yy, u * 1.2, colors[i % colors.length]!)
        }
      }
      ctx.fillStyle = '#0c0519'
      ctx.fillRect(0, h * 0.92, w, h * 0.08)
      break
    }
    case 'finale': {
      gradient(ctx, w, h, [
        [0, '#8e0b22'],
        [1, '#3d0610'],
      ])
      const cx = w / 2
      const cy = h * 0.55
      for (let i = 0; i < 20; i++) {
        const a0 = (i / 20) * Math.PI * 2
        const a1 = a0 + Math.PI / 20
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(cx + Math.cos(a0) * h, cy + Math.sin(a0) * h)
        ctx.lineTo(cx + Math.cos(a1) * h, cy + Math.sin(a1) * h)
        ctx.closePath()
        ctx.fillStyle = 'rgba(255,200,80,0.09)'
        ctx.fill()
      }
      circle(ctx, cx, cy, u * 22, 'rgba(246,201,69,0.16)')
      circle(ctx, cx, cy, u * 12, 'rgba(246,201,69,0.18)')
      break
    }
  }
  // Un velo suave abajo y arriba para que el HUD y los bordes se lean.
  const veil = ctx.createLinearGradient(0, 0, 0, h)
  veil.addColorStop(0, 'rgba(0,0,0,0.22)')
  veil.addColorStop(0.2, 'rgba(0,0,0,0)')
  veil.addColorStop(1, 'rgba(0,0,0,0.18)')
  ctx.fillStyle = veil
  ctx.fillRect(0, 0, w, h)
}
