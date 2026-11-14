// Dibujo de los vehículos de "Miga Racers", vistos desde arriba y mirando hacia +x, centrados en (0,0).
// Cada escenario tiene el suyo: autito, lancha, moto o helicóptero. Solo cambia el dibujo: las físicas son iguales.

import type { VehicleKind } from './tracks.ts'

type Ctx = CanvasRenderingContext2D

const INK = '#2a1a14'
const CREAM = '#fff6e0'

function car(ctx: Ctx, color: string, body: string) {
  ctx.fillStyle = INK
  for (const [wx, wy] of [
    [-8, -8],
    [8, -8],
    [-8, 8],
    [8, 8],
  ] as const) {
    ctx.fillRect(wx - 3.5, wy - 1.6, 7, 3.2)
  }
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.roundRect(-14, -7, 28, 14, 5)
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.fillStyle = color
  ctx.fillRect(-12, -1.4, 24, 2.8)
  ctx.fillStyle = CREAM
  ctx.beginPath()
  ctx.roundRect(-4, -4.5, 9, 9, 3)
  ctx.fill()
  ctx.fillStyle = INK
  ctx.fillRect(10, -5, 2, 2.4)
  ctx.fillRect(10, 2.6, 2, 2.4)
}

function boat(ctx: Ctx, body: string, now: number, animate: boolean) {
  // Estela detrás de la lancha.
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  const wake = animate ? Math.sin(now / 90) * 1.5 : 0
  ctx.beginPath()
  ctx.moveTo(-14, -3)
  ctx.lineTo(-24 + wake, 0)
  ctx.lineTo(-14, 3)
  ctx.fill()
  // Casco puntiagudo.
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.moveTo(17, 0)
  ctx.quadraticCurveTo(10, -9, -12, -8)
  ctx.lineTo(-14, -8)
  ctx.lineTo(-14, 8)
  ctx.lineTo(-12, 8)
  ctx.quadraticCurveTo(10, 9, 17, 0)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.fillStyle = CREAM
  ctx.beginPath()
  ctx.roundRect(-5, -4.5, 9, 9, 3)
  ctx.fill()
  ctx.fillStyle = INK
  ctx.fillRect(-14, -2.5, 3, 5)
}

function bike(ctx: Ctx, body: string) {
  ctx.fillStyle = INK
  ctx.fillRect(-15, -2, 9, 4)
  ctx.fillRect(8, -2, 8, 4)
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.roundRect(-9, -4, 20, 8, 4)
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.4
  ctx.stroke()
  // Manubrio y piloto con casco.
  ctx.fillStyle = INK
  ctx.fillRect(7, -8, 2.4, 16)
  ctx.fillStyle = CREAM
  ctx.beginPath()
  ctx.arc(-1, 0, 4.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(-1, 0, 2.2, 0, Math.PI * 2)
  ctx.fill()
}

function copter(ctx: Ctx, body: string, now: number, animate: boolean) {
  // Cola y patines.
  ctx.fillStyle = body
  ctx.fillRect(-22, -1.4, 14, 2.8)
  ctx.fillStyle = INK
  ctx.fillRect(-23, -4, 2.4, 8)
  ctx.fillRect(-8, -9, 18, 1.8)
  ctx.fillRect(-8, 7.2, 18, 1.8)
  // Cuerpo en gota.
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.ellipse(1, 0, 13, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.4
  ctx.stroke()
  ctx.fillStyle = CREAM
  ctx.beginPath()
  ctx.ellipse(6, 0, 5, 4, 0, 0, Math.PI * 2)
  ctx.fill()
  // Rotor: una transparencia fija si hay poco movimiento, aspas girando si no.
  if (animate) {
    ctx.save()
    ctx.translate(0, 0)
    ctx.rotate(now / 40)
    ctx.strokeStyle = 'rgba(42,26,20,0.75)'
    ctx.lineWidth = 2.4
    ctx.beginPath()
    ctx.moveTo(-19, 0)
    ctx.lineTo(19, 0)
    ctx.moveTo(0, -19)
    ctx.lineTo(0, 19)
    ctx.stroke()
    ctx.restore()
  } else {
    ctx.fillStyle = 'rgba(42,26,20,0.14)'
    ctx.beginPath()
    ctx.arc(0, 0, 19, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(0, 0, 2.6, 0, Math.PI * 2)
  ctx.fill()
}

/** Sombra proyectada en el piso (el helicóptero la tiene más separada porque vuela). */
export function vehicleShadow(ctx: Ctx, kind: VehicleKind, h: number) {
  ctx.fillStyle = 'rgba(42,26,20,0.22)'
  ctx.beginPath()
  const lift = kind === 'copter' ? 9 : 0
  ctx.ellipse(2 + lift * 0.4, 4 + lift, kind === 'copter' ? 18 : 16, 9, h, 0, Math.PI * 2)
  ctx.fill()
}

export function drawVehicle(
  ctx: Ctx,
  kind: VehicleKind,
  color: string,
  flash: boolean,
  now: number,
  animate: boolean,
) {
  const body = flash ? '#ffffff' : color
  switch (kind) {
    case 'boat':
      boat(ctx, body, now, animate)
      break
    case 'bike':
      bike(ctx, body)
      break
    case 'copter':
      copter(ctx, body, now, animate)
      break
    default:
      car(ctx, 'rgba(255,246,224,0.85)', body)
  }
}
