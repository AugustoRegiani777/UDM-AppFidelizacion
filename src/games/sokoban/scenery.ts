// Fondos de los escenarios (lo que se ve alrededor del mapa). Se dibujan una sola vez en un canvas aparte.

import type { Palette, SceneryId } from './themes.ts'

function mulberry(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function cloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  color = 'rgba(255,255,255,0.85)',
) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, s * 0.5, 0, Math.PI * 2)
  ctx.arc(x + s * 0.55, y + s * 0.08, s * 0.42, 0, Math.PI * 2)
  ctx.arc(x - s * 0.55, y + s * 0.1, s * 0.38, 0, Math.PI * 2)
  ctx.arc(x + s * 0.15, y - s * 0.22, s * 0.38, 0, Math.PI * 2)
  ctx.fill()
}

function sun(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color = '#ffe9a0') {
  const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 2.2)
  g.addColorStop(0, color)
  g.addColorStop(0.45, color)
  g.addColorStop(1, 'rgba(255,233,160,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r * 2.2, 0, Math.PI * 2)
  ctx.fill()
}

function skyline(
  ctx: CanvasRenderingContext2D,
  W: number,
  baseY: number,
  seed: number,
  minH: number,
  maxH: number,
  colors: string[],
  windows = true,
) {
  const rnd = mulberry(seed)
  let x = -10
  while (x < W + 10) {
    const w = 34 + rnd() * 46
    const h = minH + rnd() * (maxH - minH)
    ctx.fillStyle = colors[Math.floor(rnd() * colors.length)] ?? '#999'
    ctx.fillRect(x, baseY - h, w, h)
    if (windows) {
      ctx.fillStyle = 'rgba(255,246,224,0.5)'
      for (let wy = baseY - h + 8; wy < baseY - 10; wy += 13) {
        for (let wx = x + 6; wx < x + w - 8; wx += 11) ctx.fillRect(wx, wy, 5, 7)
      }
    }
    x += w + rnd() * 4
  }
}

function hills(
  ctx: CanvasRenderingContext2D,
  W: number,
  baseY: number,
  color: string,
  amp: number,
  seed: number,
) {
  const rnd = mulberry(seed)
  const p1 = rnd() * 6
  const p2 = rnd() * 6
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, baseY)
  for (let x = 0; x <= W; x += 8) {
    ctx.lineTo(x, baseY - amp * (0.55 + 0.3 * Math.sin(x / 90 + p1) + 0.15 * Math.sin(x / 37 + p2)))
  }
  ctx.lineTo(W, baseY + 200)
  ctx.lineTo(0, baseY + 200)
  ctx.closePath()
  ctx.fill()
}

function palmTop(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.strokeStyle = '#6b4a2b'
  ctx.lineWidth = s * 0.08
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x, y + s)
  ctx.quadraticCurveTo(x + s * 0.12, y + s * 0.5, x, y)
  ctx.stroke()
  ctx.strokeStyle = '#3f9a48'
  ctx.lineWidth = s * 0.07
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.5
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.quadraticCurveTo(
      x + Math.cos(a) * s * 0.35,
      y + Math.sin(a) * s * 0.3 - s * 0.1,
      x + Math.cos(a) * s * 0.7,
      y + Math.sin(a) * s * 0.5 + s * 0.12,
    )
    ctx.stroke()
  }
}

function crane(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.strokeStyle = '#c8102e'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(x, y + s)
  ctx.lineTo(x, y)
  ctx.lineTo(x + s * 0.9, y)
  ctx.moveTo(x - s * 0.35, y)
  ctx.lineTo(x, y)
  ctx.moveTo(x + s * 0.7, y)
  ctx.lineTo(x + s * 0.7, y + s * 0.35)
  ctx.stroke()
  ctx.lineWidth = 1.5
  for (let i = 0; i < 6; i++) {
    ctx.beginPath()
    ctx.moveTo(x, y + (s / 6) * i)
    ctx.lineTo(x + s * 0.05, y + (s / 6) * (i + 1))
    ctx.stroke()
  }
}

function tower(
  ctx: CanvasRenderingContext2D,
  x: number,
  baseY: number,
  w: number,
  h: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.fillRect(x, baseY - h, w, h)
  const teeth = 5
  for (let i = 0; i < teeth; i++)
    ctx.fillRect(x + (w / teeth) * i + 1, baseY - h - 9, w / teeth - 3, 9)
  ctx.fillStyle = 'rgba(42,26,20,0.35)'
  ctx.beginPath()
  ctx.roundRect(x + w * 0.38, baseY - h * 0.6, w * 0.24, h * 0.35, [w * 0.12, w * 0.12, 0, 0])
  ctx.fill()
}

/** Pinta el fondo completo del escenario en `ctx` (tamaño W x H en unidades de dibujo). */
export function drawScenery(
  ctx: CanvasRenderingContext2D,
  id: SceneryId,
  W: number,
  H: number,
  p: Palette,
) {
  const sky = ctx.createLinearGradient(0, 0, 0, H)
  sky.addColorStop(0, p.skyTop)
  sky.addColorStop(1, p.skyBottom)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, W, H)
  const rnd = mulberry(id.length * 131 + 7)

  switch (id) {
    case 'street': {
      sun(ctx, W * 0.82, H * 0.14, 20)
      cloud(ctx, W * 0.2, H * 0.12, 40)
      skyline(ctx, W, H * 0.4, 3, 50, 120, ['#e8c27a', '#d9a67a', '#c8a27a', '#e3b98a', '#b8553a'])
      skyline(ctx, W, H * 0.97, 8, 60, 150, ['#e8c27a', '#c8102e55', '#d9a67a', '#e3b98a'])
      break
    }
    case 'market': {
      // Techo de hierro del mercado, con lámparas colgando.
      ctx.strokeStyle = '#6b4a2b'
      ctx.lineWidth = 5
      for (let x = -20; x < W + 40; x += 90) {
        ctx.beginPath()
        ctx.arc(x + 45, H * 0.12, 60, Math.PI, 0)
        ctx.stroke()
      }
      for (let x = 30; x < W; x += 110) {
        ctx.strokeStyle = '#6b4a2b'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H * 0.12)
        ctx.stroke()
        ctx.fillStyle = '#ffe9a0'
        ctx.beginPath()
        ctx.arc(x, H * 0.12 + 7, 9, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.fillStyle = '#d8c9a6'
      ctx.fillRect(0, H * 0.9, W, H * 0.1)
      break
    }
    case 'port': {
      sun(ctx, W * 0.2, H * 0.16, 22)
      const sea = ctx.createLinearGradient(0, H * 0.3, 0, H)
      sea.addColorStop(0, '#4aa7d6')
      sea.addColorStop(1, '#2a82b2')
      ctx.fillStyle = sea
      ctx.fillRect(0, H * 0.3, W, H)
      crane(ctx, W * 0.08, H * 0.06, 90)
      crane(ctx, W * 0.86, H * 0.1, 70)
      ctx.fillStyle = '#2f5d8a'
      ctx.beginPath()
      ctx.moveTo(W * 0.4, H * 0.3)
      ctx.lineTo(W * 0.78, H * 0.3)
      ctx.lineTo(W * 0.74, H * 0.36)
      ctx.lineTo(W * 0.44, H * 0.36)
      ctx.closePath()
      ctx.fill()
      break
    }
    case 'rooftops': {
      cloud(ctx, W * 0.25, H * 0.1, 46)
      cloud(ctx, W * 0.78, H * 0.18, 34)
      tower(ctx, W * 0.46, H * 0.36, 26, 90, '#e8dcc4')
      skyline(ctx, W, H * 0.4, 14, 20, 60, ['#c9744a', '#e8dcc4', '#bb6a42', '#d9b99a'], false)
      break
    }
    case 'park': {
      cloud(ctx, W * 0.3, H * 0.1, 44)
      cloud(ctx, W * 0.8, H * 0.16, 36)
      hills(ctx, W, H * 0.4, '#8fcf6a', 50, 2)
      hills(ctx, W, H * 0.48, '#74b350', 38, 5)
      for (let i = 0; i < 9; i++) {
        const x = rnd() * W
        ctx.fillStyle = '#2f7a3a'
        ctx.beginPath()
        ctx.arc(x, H * 0.42 + rnd() * 12, 16 + rnd() * 10, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'barrio': {
      skyline(ctx, W, H * 0.42, 21, 70, 130, [
        '#e0562e',
        '#f7c948',
        '#2f9fd6',
        '#e8a0a0',
        '#8fcf6a',
      ])
      // Banderines.
      ctx.strokeStyle = '#6b4a2b'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(0, H * 0.05)
      ctx.quadraticCurveTo(W / 2, H * 0.13, W, H * 0.05)
      ctx.stroke()
      for (let i = 0; i < 16; i++) {
        const t = (i + 0.5) / 16
        const x = W * t
        const y = H * 0.05 + (H * 0.08 * 4 * t * (1 - t)) / 1
        ctx.fillStyle = ['#c8102e', '#f7c948', '#2f9fd6', '#4c9a5b'][i % 4]!
        ctx.beginPath()
        ctx.moveTo(x - 6, y)
        ctx.lineTo(x + 6, y)
        ctx.lineTo(x, y + 14)
        ctx.fill()
      }
      break
    }
    case 'lagoon':
    case 'rice': {
      sun(ctx, W * 0.5, H * 0.2, 34, '#fff0b0')
      hills(ctx, W, H * 0.34, id === 'rice' ? '#9aa83a' : '#7a8a3a', 22, 9)
      ctx.fillStyle = id === 'rice' ? '#6b8f4a' : '#3f8a82'
      ctx.fillRect(0, H * 0.36, W, H)
      if (id === 'rice') {
        for (let i = 0; i < 10; i++) {
          ctx.fillStyle = i % 2 ? '#b8c84a' : '#8fb83a'
          ctx.fillRect(0, H * 0.38 + i * 22, W, 11)
        }
      }
      for (let i = 0; i < 14; i++) {
        const x = rnd() * W
        ctx.strokeStyle = '#a8b04a'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, H * 0.4)
        ctx.lineTo(x + 2, H * 0.4 - 18 - rnd() * 18)
        ctx.stroke()
      }
      break
    }
    case 'arts': {
      cloud(ctx, W * 0.15, H * 0.14, 36)
      // Estructuras blancas curvas, como la Ciudad de las Artes.
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.ellipse(W * 0.3, H * 0.34, 90, 52, 0, Math.PI, 0)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(W * 0.72, H * 0.36, 120, 70, 0, Math.PI, 0)
      ctx.fill()
      ctx.strokeStyle = '#9fc4d9'
      ctx.lineWidth = 2
      for (let i = 1; i < 6; i++) {
        ctx.beginPath()
        ctx.ellipse(W * 0.72, H * 0.36, 120, 70 - i * 10, 0, Math.PI, 0)
        ctx.stroke()
      }
      ctx.fillStyle = '#6fb4d6'
      ctx.fillRect(0, H * 0.36, W, 12)
      break
    }
    case 'beach': {
      sun(ctx, W * 0.8, H * 0.14, 20)
      ctx.fillStyle = '#4aa7d6'
      ctx.fillRect(0, H * 0.22, W, H * 0.14)
      ctx.strokeStyle = 'rgba(255,255,255,0.7)'
      ctx.lineWidth = 2
      for (let i = 0; i < 12; i++) {
        const x = rnd() * W
        ctx.beginPath()
        ctx.moveTo(x, H * 0.26 + rnd() * 30)
        ctx.quadraticCurveTo(x + 10, H * 0.24 + rnd() * 30, x + 22, H * 0.26 + rnd() * 30)
        ctx.stroke()
      }
      ctx.fillStyle = '#f0d9a0'
      ctx.fillRect(0, H * 0.36, W, H)
      for (let i = 0; i < 4; i++) palmTop(ctx, W * (0.1 + i * 0.27), H * 0.1, 80)
      break
    }
    case 'oldtown': {
      cloud(ctx, W * 0.72, H * 0.1, 34, 'rgba(255,255,255,0.7)')
      tower(ctx, W * 0.12, H * 0.42, 70, 130, '#b8a48a')
      tower(ctx, W * 0.74, H * 0.42, 70, 130, '#b8a48a')
      skyline(ctx, W, H * 0.42, 33, 20, 60, ['#e3b98a', '#c99a6a', '#b8553a'], true)
      break
    }
    case 'fallas': {
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(255,246,224,${0.3 + rnd() * 0.6})`
        ctx.beginPath()
        ctx.arc(rnd() * W, rnd() * H * 0.5, 0.6 + rnd() * 1.4, 0, Math.PI * 2)
        ctx.fill()
      }
      skyline(ctx, W, H * 0.42, 41, 40, 100, ['#2a2547', '#322c55', '#3a3263'], true)
      // Guirnaldas de luces.
      for (let row = 0; row < 2; row++) {
        ctx.strokeStyle = '#6b4a8a'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(0, H * (0.07 + row * 0.06))
        ctx.quadraticCurveTo(W / 2, H * (0.17 + row * 0.06), W, H * (0.07 + row * 0.06))
        ctx.stroke()
        for (let i = 0; i < 18; i++) {
          const t = (i + 0.5) / 18
          ctx.fillStyle = ['#ffd45c', '#ff6b6b', '#6bd0ff', '#9aff8a'][i % 4]!
          ctx.beginPath()
          ctx.arc(W * t, H * (0.07 + row * 0.06) + H * 0.1 * 4 * t * (1 - t), 3.2, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      break
    }
  }
}
