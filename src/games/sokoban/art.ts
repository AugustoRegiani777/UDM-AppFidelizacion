// Dibujo de cada pieza del juego (piso, obstáculos, cajas, entregas y vehículos). Todo en canvas 2D, sin imágenes.
// Las funciones dibujan en el rectángulo (x, y, s, s) o centradas en (0, 0), según se indique.

import { drawHero } from '../shared/hero.ts'
import type { FloorStyle, Palette, VehicleId, WallStyle } from './themes.ts'

const INK = '#2a1a14'

/** Número "al azar" fijo para una casilla: da variedad sin que cambie entre cuadros. */
export function hash(i: number, salt = 0): number {
  let h = Math.imul(i + 1 + salt * 977, 2654435761)
  h ^= h >>> 15
  h = Math.imul(h, 2246822519)
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296
}

// --- Pisos --------------------------------------------------------------------------------------------

export function drawFloor(
  ctx: CanvasRenderingContext2D,
  style: FloorStyle,
  x: number,
  y: number,
  s: number,
  cell: number,
  col: number,
  row: number,
  p: Palette,
) {
  const alt = (col + row) % 2 === 0
  ctx.fillStyle = alt ? p.floorA : p.floorB
  ctx.fillRect(x, y, s, s)
  switch (style) {
    case 'asphalt': {
      ctx.fillStyle = 'rgba(255,255,255,0.05)'
      for (let i = 0; i < 5; i++)
        ctx.fillRect(x + hash(cell, i) * s, y + hash(cell, i + 9) * s, 2, 2)
      if (col % 2 === 0) {
        ctx.fillStyle = 'rgba(247,201,72,0.55)'
        ctx.fillRect(x + s * 0.47, y + s * 0.18, s * 0.06, s * 0.2)
        ctx.fillRect(x + s * 0.47, y + s * 0.62, s * 0.06, s * 0.2)
      }
      break
    }
    case 'tile': {
      ctx.strokeStyle = 'rgba(107,74,43,0.18)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1)
      break
    }
    case 'water':
    case 'lagoon':
      // El agua se anima aparte (olas): acá queda el color de base.
      break
    case 'grass': {
      ctx.strokeStyle = 'rgba(47,122,58,0.5)'
      ctx.lineWidth = 1.2
      for (let i = 0; i < 6; i++) {
        const gx = x + hash(cell, i) * s
        const gy = y + 4 + hash(cell, i + 20) * (s - 8)
        ctx.beginPath()
        ctx.moveTo(gx, gy)
        ctx.lineTo(gx + 1.5, gy - 4)
        ctx.stroke()
      }
      break
    }
    case 'cobble': {
      ctx.strokeStyle = 'rgba(42,26,20,0.22)'
      ctx.lineWidth = 1.2
      const n = 3
      for (let r = 0; r < n; r++) {
        const off = r % 2 ? s / (n * 2) : 0
        for (let c = 0; c < n; c++) {
          ctx.strokeRect(x + (c * s) / n + off, y + (r * s) / n, s / n, s / n)
        }
      }
      break
    }
    case 'roof': {
      ctx.strokeStyle = 'rgba(42,26,20,0.25)'
      ctx.lineWidth = 1.5
      for (let r = 1; r < 4; r++) {
        ctx.beginPath()
        ctx.moveTo(x, y + (r * s) / 4)
        ctx.lineTo(x + s, y + (r * s) / 4)
        ctx.stroke()
      }
      break
    }
    case 'plaza': {
      ctx.strokeStyle = 'rgba(111,180,214,0.25)'
      ctx.lineWidth = 1
      ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1)
      break
    }
    case 'sand': {
      ctx.fillStyle = 'rgba(139,94,52,0.18)'
      for (let i = 0; i < 7; i++)
        ctx.fillRect(x + hash(cell, i) * s, y + hash(cell, i + 5) * s, 1.8, 1.8)
      break
    }
    case 'night': {
      ctx.fillStyle = 'rgba(255,212,92,0.18)'
      ctx.beginPath()
      ctx.arc(x + s / 2, y + s / 2, s * 0.05, 0, Math.PI * 2)
      ctx.fill()
      break
    }
  }
}

/** Olas que se mueven sobre el agua (se dibuja cada cuadro, con la casilla ya recortada). */
export function drawWaves(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  cell: number,
  t: number,
  lagoon: boolean,
) {
  ctx.strokeStyle = lagoon ? 'rgba(255,240,200,0.32)' : 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1.6
  ctx.lineCap = 'round'
  for (let k = 0; k < 2; k++) {
    const phase = t * 1.6 + hash(cell, k) * 6
    const yy = y + s * (0.3 + k * 0.4)
    ctx.beginPath()
    ctx.moveTo(x + s * 0.1, yy + Math.sin(phase) * 2)
    ctx.quadraticCurveTo(
      x + s * 0.35,
      yy - 4 + Math.sin(phase + 1) * 2,
      x + s * 0.55,
      yy + Math.sin(phase + 2) * 2,
    )
    ctx.quadraticCurveTo(
      x + s * 0.75,
      yy + 4 + Math.sin(phase + 3) * 2,
      x + s * 0.92,
      yy + Math.sin(phase + 4) * 2,
    )
    ctx.stroke()
  }
}

// --- Obstáculos ---------------------------------------------------------------------------------------

export function drawWall(
  ctx: CanvasRenderingContext2D,
  style: WallStyle,
  x: number,
  y: number,
  s: number,
  cell: number,
  p: Palette,
) {
  const r = hash(cell, 3)
  // Sombra común a todos.
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.fillRect(x + s * 0.06, y + s * 0.1, s * 0.92, s * 0.92)
  switch (style) {
    case 'building':
    case 'house': {
      const roof = style === 'house' ? (r > 0.5 ? p.wallB : p.wallA) : r > 0.5 ? p.wallA : '#d9b99a'
      ctx.fillStyle = roof
      ctx.beginPath()
      ctx.roundRect(x + s * 0.04, y + s * 0.04, s * 0.92, s * 0.92, s * 0.08)
      ctx.fill()
      ctx.strokeStyle = INK
      ctx.lineWidth = 1.4
      ctx.stroke()
      if (style === 'house') {
        // Tejado a dos aguas.
        ctx.strokeStyle = 'rgba(42,26,20,0.45)'
        ctx.beginPath()
        ctx.moveTo(x + s * 0.5, y + s * 0.06)
        ctx.lineTo(x + s * 0.5, y + s * 0.94)
        ctx.stroke()
        ctx.fillStyle = 'rgba(255,246,224,0.25)'
        ctx.fillRect(x + s * 0.06, y + s * 0.06, s * 0.44, s * 0.88)
      } else {
        ctx.fillStyle = 'rgba(255,246,224,0.55)'
        for (let i = 0; i < 2; i++) {
          for (let j = 0; j < 2; j++)
            ctx.fillRect(x + s * (0.2 + i * 0.35), y + s * (0.2 + j * 0.35), s * 0.18, s * 0.18)
        }
      }
      break
    }
    case 'stall': {
      // Puesto del mercado con toldo a rayas.
      ctx.fillStyle = '#8b5e34'
      ctx.fillRect(x + s * 0.08, y + s * 0.5, s * 0.84, s * 0.42)
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 ? p.wallB : p.wallA
        ctx.fillRect(x + s * 0.06 + (i * (s * 0.88)) / 6, y + s * 0.06, (s * 0.88) / 6, s * 0.46)
      }
      ctx.strokeStyle = INK
      ctx.lineWidth = 1.3
      ctx.strokeRect(x + s * 0.06, y + s * 0.06, s * 0.88, s * 0.86)
      ctx.fillStyle = ['#d6281c', '#f7c948', '#4c9a5b'][Math.floor(r * 3)] ?? '#d6281c'
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.arc(x + s * (0.28 + i * 0.22), y + s * 0.72, s * 0.07, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'container': {
      const colors = [p.wallA, p.wallB, '#e0a21f', '#4c9a5b']
      ctx.fillStyle = colors[Math.floor(r * colors.length)] ?? p.wallA
      ctx.fillRect(x + s * 0.04, y + s * 0.1, s * 0.92, s * 0.8)
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.lineWidth = 1.2
      for (let i = 1; i < 8; i++) {
        ctx.beginPath()
        ctx.moveTo(x + s * 0.04 + (i * (s * 0.92)) / 8, y + s * 0.1)
        ctx.lineTo(x + s * 0.04 + (i * (s * 0.92)) / 8, y + s * 0.9)
        ctx.stroke()
      }
      ctx.strokeStyle = INK
      ctx.strokeRect(x + s * 0.04, y + s * 0.1, s * 0.92, s * 0.8)
      break
    }
    case 'hedge': {
      ctx.fillStyle = p.wallA
      ctx.beginPath()
      ctx.roundRect(x + s * 0.04, y + s * 0.04, s * 0.92, s * 0.92, s * 0.3)
      ctx.fill()
      ctx.fillStyle = p.wallB
      for (let i = 0; i < 5; i++) {
        ctx.beginPath()
        ctx.arc(
          x + s * (0.2 + hash(cell, i) * 0.6),
          y + s * (0.2 + hash(cell, i + 7) * 0.6),
          s * 0.14,
          0,
          Math.PI * 2,
        )
        ctx.fill()
      }
      if (r > 0.7) {
        ctx.fillStyle = p.accent
        ctx.beginPath()
        ctx.arc(x + s * 0.7, y + s * 0.3, s * 0.05, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'terrace': {
      // Mesa de terraza con sombrilla.
      ctx.fillStyle = r > 0.5 ? p.wallA : p.wallB
      ctx.beginPath()
      ctx.arc(x + s / 2, y + s / 2, s * 0.44, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,246,224,0.7)'
      ctx.lineWidth = 2
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3
        ctx.beginPath()
        ctx.moveTo(x + s / 2, y + s / 2)
        ctx.lineTo(x + s / 2 + Math.cos(a) * s * 0.44, y + s / 2 + Math.sin(a) * s * 0.44)
        ctx.stroke()
      }
      ctx.fillStyle = INK
      ctx.beginPath()
      ctx.arc(x + s / 2, y + s / 2, s * 0.04, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'reeds': {
      ctx.fillStyle = 'rgba(79,159,143,0.55)'
      ctx.beginPath()
      ctx.arc(x + s / 2, y + s / 2, s * 0.46, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = p.wallA
      ctx.lineWidth = 2.2
      ctx.lineCap = 'round'
      for (let i = 0; i < 9; i++) {
        const bx = x + s * (0.15 + hash(cell, i) * 0.7)
        const by = y + s * (0.5 + hash(cell, i + 11) * 0.4)
        ctx.beginPath()
        ctx.moveTo(bx, by)
        ctx.lineTo(
          bx + (hash(cell, i + 3) - 0.5) * s * 0.18,
          by - s * (0.3 + hash(cell, i + 5) * 0.25),
        )
        ctx.stroke()
      }
      ctx.fillStyle = '#6b4a2b'
      for (let i = 0; i < 3; i++)
        ctx.fillRect(
          x + s * (0.25 + i * 0.22),
          y + s * (0.22 + hash(cell, i) * 0.2),
          s * 0.05,
          s * 0.14,
        )
      break
    }
    case 'arch': {
      ctx.fillStyle = p.wallA
      ctx.beginPath()
      ctx.roundRect(x + s * 0.04, y + s * 0.04, s * 0.92, s * 0.92, s * 0.4)
      ctx.fill()
      ctx.strokeStyle = p.wallB
      ctx.lineWidth = 2
      for (let i = 1; i < 4; i++) {
        ctx.beginPath()
        ctx.arc(x + s / 2, y + s / 2, (s * 0.44 * i) / 4 + 1, 0, Math.PI * 2)
        ctx.stroke()
      }
      break
    }
    case 'palm': {
      ctx.fillStyle = 'rgba(0,0,0,0.12)'
      ctx.beginPath()
      ctx.ellipse(x + s * 0.55, y + s * 0.62, s * 0.4, s * 0.22, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = p.wallA
      ctx.lineWidth = s * 0.1
      ctx.lineCap = 'round'
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 + r
        ctx.beginPath()
        ctx.moveTo(x + s / 2, y + s / 2)
        ctx.quadraticCurveTo(
          x + s / 2 + Math.cos(a) * s * 0.28,
          y + s / 2 + Math.sin(a) * s * 0.28 - 2,
          x + s / 2 + Math.cos(a) * s * 0.46,
          y + s / 2 + Math.sin(a) * s * 0.46,
        )
        ctx.stroke()
      }
      ctx.fillStyle = p.wallB
      ctx.beginPath()
      ctx.arc(x + s / 2, y + s / 2, s * 0.09, 0, Math.PI * 2)
      ctx.fill()
      break
    }
    case 'ninot': {
      // Monumento fallero: figura de colores con cara.
      ctx.fillStyle = r > 0.5 ? p.wallA : '#6bd0ff'
      ctx.beginPath()
      ctx.roundRect(x + s * 0.18, y + s * 0.42, s * 0.64, s * 0.5, s * 0.14)
      ctx.fill()
      ctx.fillStyle = '#ffd9b0'
      ctx.beginPath()
      ctx.arc(x + s / 2, y + s * 0.34, s * 0.22, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = p.wallB
      ctx.beginPath()
      ctx.moveTo(x + s * 0.26, y + s * 0.26)
      ctx.lineTo(x + s * 0.74, y + s * 0.26)
      ctx.lineTo(x + s * 0.5, y + s * 0.04)
      ctx.fill()
      ctx.fillStyle = INK
      ctx.fillRect(x + s * 0.4, y + s * 0.32, s * 0.05, s * 0.05)
      ctx.fillRect(x + s * 0.56, y + s * 0.32, s * 0.05, s * 0.05)
      ctx.strokeStyle = INK
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.arc(x + s / 2, y + s * 0.4, s * 0.07, 0.2, Math.PI - 0.2)
      ctx.stroke()
      break
    }
  }
}

// --- Entregas y cajas -------------------------------------------------------------------------------

/** Marca del lugar de entrega, según el vehículo del nivel. */
export function drawGoal(
  ctx: CanvasRenderingContext2D,
  vehicle: VehicleId,
  x: number,
  y: number,
  s: number,
  p: Palette,
  t: number,
) {
  const cx = x + s / 2
  const cy = y + s / 2
  ctx.save()
  ctx.lineWidth = Math.max(2, s * 0.06)
  const pulse = 1 + Math.sin(t * 3) * 0.04
  switch (vehicle) {
    case 'boat': {
      // Boya: aro naranja y blanco.
      ctx.strokeStyle = p.goal
      ctx.beginPath()
      ctx.arc(cx, cy, s * 0.3 * pulse, 0, Math.PI * 2)
      ctx.stroke()
      ctx.strokeStyle = '#fff6e0'
      ctx.setLineDash([s * 0.18, s * 0.18])
      ctx.beginPath()
      ctx.arc(cx, cy, s * 0.3 * pulse, 0, Math.PI * 2)
      ctx.stroke()
      break
    }
    case 'heli': {
      // Helipuerto.
      ctx.strokeStyle = p.goal
      ctx.beginPath()
      ctx.arc(cx, cy, s * 0.34, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = p.goal
      ctx.font = `800 ${s * 0.4}px Poppins, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('H', cx, cy + s * 0.02)
      break
    }
    default: {
      // Lugar de estacionamiento marcado en el piso.
      ctx.strokeStyle = p.goal
      ctx.strokeRect(x + s * 0.18, y + s * 0.14, s * 0.64, s * 0.72)
      ctx.fillStyle = p.goal
      ctx.globalAlpha = 0.28
      ctx.fillRect(x + s * 0.18, y + s * 0.14, s * 0.64, s * 0.72)
    }
  }
  ctx.restore()
}

/** Caja de miga. `landed` = ya está en su entrega. `float` = flota (agua). */
export function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  p: Palette,
  landed: boolean,
  float: boolean,
  vehicle: VehicleId,
  t: number,
) {
  const bob = float ? Math.sin(t * 2.4 + x * 0.05) * s * 0.025 : 0
  const m = s * 0.12
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.beginPath()
  ctx.ellipse(x + s * 0.52, y + s * 0.88 + bob, s * 0.34, s * 0.1, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.save()
  ctx.translate(0, bob)
  ctx.fillStyle = landed ? '#7fbf5a' : p.box
  ctx.strokeStyle = INK
  ctx.lineWidth = Math.max(1.5, s * 0.04)
  ctx.beginPath()
  ctx.roundRect(x + m, y + m, s - m * 2, s - m * 2, s * 0.08)
  ctx.fill()
  ctx.stroke()
  // Tapa: cinta y tablones.
  ctx.fillStyle = landed ? '#5f9f3f' : p.boxDark
  if (float) {
    for (let i = 1; i < 3; i++)
      ctx.fillRect(x + m, y + m + (i * (s - m * 2)) / 3 - 1, s - m * 2, 2.5)
  } else {
    ctx.fillRect(x + s * 0.44, y + m, s * 0.12, s - m * 2)
  }
  if (vehicle === 'heli') {
    ctx.strokeStyle = '#c8102e'
    ctx.lineWidth = Math.max(2, s * 0.05)
    ctx.beginPath()
    ctx.moveTo(x + m, y + m)
    ctx.lineTo(x + s - m, y + s - m)
    ctx.moveTo(x + s - m, y + m)
    ctx.lineTo(x + m, y + s - m)
    ctx.stroke()
  }
  // Etiqueta con el sanguchito de la marca.
  ctx.fillStyle = '#fff6e0'
  ctx.beginPath()
  ctx.roundRect(x + s * 0.3, y + s * 0.34, s * 0.4, s * 0.32, s * 0.05)
  ctx.fill()
  ctx.fillStyle = '#e8c27a'
  ctx.fillRect(x + s * 0.34, y + s * 0.4, s * 0.32, s * 0.07)
  ctx.fillStyle = '#c8102e'
  ctx.fillRect(x + s * 0.34, y + s * 0.49, s * 0.32, s * 0.04)
  ctx.fillStyle = '#e8c27a'
  ctx.fillRect(x + s * 0.34, y + s * 0.55, s * 0.32, s * 0.07)
  if (landed) {
    ctx.strokeStyle = '#fff6e0'
    ctx.lineWidth = Math.max(2, s * 0.06)
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(x + s * 0.3, y + s * 0.72)
    ctx.lineTo(x + s * 0.44, y + s * 0.84)
    ctx.lineTo(x + s * 0.72, y + s * 0.6)
    ctx.stroke()
  }
  ctx.restore()
}

// --- Vehículos ----------------------------------------------------------------------------------------

function mascot(ctx: CanvasRenderingContext2D, scale: number) {
  ctx.save()
  ctx.scale(scale, scale)
  drawHero(ctx)
  ctx.fillStyle = INK
  for (const dx of [-6, 6]) {
    ctx.beginPath()
    ctx.arc(dx + 1.5, -4.5, 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/**
 * Dibuja el vehículo mirando a la derecha, centrado en (0, 0), ocupando alrededor de una casilla `s`.
 * `t` es el tiempo en segundos (hélice, olas); `speed` 0..1 (qué tan rápido se está moviendo).
 */
export function drawVehicle(
  ctx: CanvasRenderingContext2D,
  kind: VehicleId,
  s: number,
  t: number,
  speed: number,
) {
  switch (kind) {
    case 'car': {
      const L = s * 0.8
      const W = s * 0.5
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.beginPath()
      ctx.roundRect(-L / 2 + 2, -W / 2 + 3, L, W, s * 0.12)
      ctx.fill()
      ctx.fillStyle = INK
      for (const [wx, wy] of [
        [-L * 0.3, -W * 0.52],
        [L * 0.3, -W * 0.52],
        [-L * 0.3, W * 0.52],
        [L * 0.3, W * 0.52],
      ] as const) {
        ctx.beginPath()
        ctx.roundRect(wx - s * 0.1, wy - s * 0.04, s * 0.2, s * 0.08, 2)
        ctx.fill()
      }
      ctx.fillStyle = '#c8102e'
      ctx.strokeStyle = INK
      ctx.lineWidth = Math.max(1.5, s * 0.035)
      ctx.beginPath()
      ctx.roundRect(-L / 2, -W / 2, L, W, s * 0.12)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#bfe3f5'
      ctx.beginPath()
      ctx.roundRect(L * 0.08, -W * 0.38, L * 0.24, W * 0.76, s * 0.05)
      ctx.fill()
      ctx.fillStyle = '#fff3b0'
      ctx.fillRect(L / 2 - s * 0.05, -W * 0.38, s * 0.05, s * 0.09)
      ctx.fillRect(L / 2 - s * 0.05, W * 0.38 - s * 0.09, s * 0.05, s * 0.09)
      ctx.save()
      ctx.translate(-L * 0.06, 0)
      mascot(ctx, (s * 0.4) / 30)
      ctx.restore()
      break
    }
    case 'moto': {
      const wheel = s * 0.15
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.beginPath()
      ctx.ellipse(2, 3, s * 0.42, s * 0.14, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = INK
      for (const wx of [-s * 0.3, s * 0.3]) {
        ctx.beginPath()
        ctx.roundRect(wx - wheel, -s * 0.05, wheel * 2, s * 0.1, 3)
        ctx.fill()
      }
      ctx.fillStyle = '#2f6fb5'
      ctx.strokeStyle = INK
      ctx.lineWidth = Math.max(1.4, s * 0.03)
      ctx.beginPath()
      ctx.roundRect(-s * 0.32, -s * 0.09, s * 0.64, s * 0.18, s * 0.09)
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = INK
      ctx.lineWidth = Math.max(2, s * 0.05)
      ctx.beginPath()
      ctx.moveTo(s * 0.26, -s * 0.22)
      ctx.lineTo(s * 0.26, s * 0.22)
      ctx.stroke()
      ctx.fillStyle = '#fff3b0'
      ctx.beginPath()
      ctx.arc(s * 0.36, 0, s * 0.05, 0, Math.PI * 2)
      ctx.fill()
      ctx.save()
      ctx.translate(-s * 0.05, 0)
      mascot(ctx, (s * 0.38) / 30)
      ctx.restore()
      break
    }
    case 'boat': {
      const L = s * 0.86
      const W = s * 0.46
      const rock = Math.sin(t * 3) * 0.04 * (0.4 + speed)
      ctx.rotate(rock)
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.beginPath()
      ctx.ellipse(2, 4, L * 0.5, W * 0.5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff6e0'
      ctx.strokeStyle = INK
      ctx.lineWidth = Math.max(1.5, s * 0.035)
      ctx.beginPath()
      ctx.moveTo(L / 2, 0)
      ctx.quadraticCurveTo(L * 0.3, -W / 2, -L * 0.3, -W / 2)
      ctx.lineTo(-L / 2, -W * 0.38)
      ctx.lineTo(-L / 2, W * 0.38)
      ctx.lineTo(-L * 0.3, W / 2)
      ctx.quadraticCurveTo(L * 0.3, W / 2, L / 2, 0)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.strokeStyle = '#c8102e'
      ctx.lineWidth = Math.max(2, s * 0.06)
      ctx.beginPath()
      ctx.moveTo(-L * 0.4, 0)
      ctx.lineTo(L * 0.32, 0)
      ctx.stroke()
      ctx.fillStyle = '#2f9fd6'
      ctx.fillRect(-L * 0.08, -W * 0.28, L * 0.26, W * 0.56)
      ctx.save()
      ctx.translate(-L * 0.18, 0)
      mascot(ctx, (s * 0.34) / 30)
      ctx.restore()
      break
    }
    case 'heli': {
      const spin = t * 38
      ctx.fillStyle = 'rgba(0,0,0,0.22)'
      ctx.beginPath()
      ctx.ellipse(s * 0.1, s * 0.12, s * 0.36, s * 0.2, 0, 0, Math.PI * 2)
      ctx.fill()
      // Cola y rotor de cola.
      ctx.strokeStyle = '#1f7a8a'
      ctx.lineWidth = Math.max(3, s * 0.08)
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(-s * 0.1, 0)
      ctx.lineTo(-s * 0.46, 0)
      ctx.stroke()
      ctx.save()
      ctx.translate(-s * 0.46, 0)
      ctx.rotate(spin * 1.6)
      ctx.strokeStyle = INK
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(-s * 0.1, 0)
      ctx.lineTo(s * 0.1, 0)
      ctx.moveTo(0, -s * 0.1)
      ctx.lineTo(0, s * 0.1)
      ctx.stroke()
      ctx.restore()
      // Cuerpo.
      ctx.fillStyle = '#2fb5c8'
      ctx.strokeStyle = INK
      ctx.lineWidth = Math.max(1.5, s * 0.035)
      ctx.beginPath()
      ctx.ellipse(0, 0, s * 0.3, s * 0.22, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = 'rgba(191,227,245,0.9)'
      ctx.beginPath()
      ctx.ellipse(s * 0.1, 0, s * 0.16, s * 0.15, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.save()
      ctx.translate(s * 0.08, 0)
      mascot(ctx, (s * 0.28) / 30)
      ctx.restore()
      // Rotor principal: disco borroso y palas.
      ctx.fillStyle = `rgba(255,255,255,${0.14 + speed * 0.06})`
      ctx.beginPath()
      ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.save()
      ctx.rotate(spin)
      ctx.strokeStyle = 'rgba(42,26,20,0.75)'
      ctx.lineWidth = Math.max(2, s * 0.05)
      ctx.beginPath()
      ctx.moveTo(-s * 0.5, 0)
      ctx.lineTo(s * 0.5, 0)
      ctx.moveTo(0, -s * 0.5)
      ctx.lineTo(0, s * 0.5)
      ctx.stroke()
      ctx.restore()
      ctx.fillStyle = INK
      ctx.beginPath()
      ctx.arc(0, 0, s * 0.045, 0, Math.PI * 2)
      ctx.fill()
      break
    }
  }
}
