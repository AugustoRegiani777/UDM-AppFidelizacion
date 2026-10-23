// Sprites vectoriales de "Sobreviví a las migas". Se dibujan una vez, en canvas fuera de pantalla, a la
// resolución real del dispositivo (escala = px de pantalla por unidad lógica), así se ven nítidos en
// cualquier celular y cada cuadro solo hace drawImage (barato).

import { ARENA_H, ARENA_W } from '@engine/config.ts'

export interface SpriteSet {
  scale: number
  player: HTMLCanvasElement
  ant: [HTMLCanvasElement, HTMLCanvasElement]
  fly: [HTMLCanvasElement, HTMLCanvasElement]
  pigeon: HTMLCanvasElement
  queen: HTMLCanvasElement
  antFlash: HTMLCanvasElement
  flyFlash: HTMLCanvasElement
  pigeonFlash: HTMLCanvasElement
  queenFlash: HTMLCanvasElement
  crumb: HTMLCanvasElement
  gem: HTMLCanvasElement
  toast: HTMLCanvasElement
  background: HTMLCanvasElement
}

type Draw = (ctx: CanvasRenderingContext2D) => void

const INK = '#2a1a14'

function makeCanvas(width: number, height: number, scale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(width * scale)
  canvas.height = Math.ceil(height * scale)
  return canvas
}

/** Sprite centrado: el origen (0,0) del dibujo queda en el medio del canvas. */
function sprite(width: number, height: number, scale: number, draw: Draw): HTMLCanvasElement {
  const canvas = makeCanvas(width, height, scale)
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.translate(width / 2, height / 2)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  draw(ctx)
  return canvas
}

/** Copia blanca del sprite, para el destello al recibir un golpe. */
function flashed(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = makeCanvas(source.width, source.height, 1)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(source, 0, 0)
  ctx.globalCompositeOperation = 'source-atop'
  ctx.fillStyle = 'rgba(255,255,255,0.88)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return canvas
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

// --- Héroe: sanguchito de miga --------------------------------------------------------------------

function drawPlayer(ctx: CanvasRenderingContext2D) {
  const body = new Path2D()
  body.roundRect(-15, -15, 30, 29, 8)

  ctx.save()
  ctx.clip(body)
  ctx.fillStyle = '#fff6e0'
  ctx.fillRect(-16, -16, 32, 32)
  // Relleno que asoma abajo: jamón, queso y lechuga.
  ctx.fillStyle = '#f4a3b0'
  ctx.fillRect(-16, 3, 32, 4)
  ctx.fillStyle = '#ffd45c'
  ctx.fillRect(-16, 7, 32, 3.5)
  ctx.fillStyle = '#86c35f'
  ctx.beginPath()
  ctx.moveTo(-16, 10.5)
  for (let x = -16; x <= 16; x += 4) ctx.quadraticCurveTo(x + 2, 14, x + 4, 10.5)
  ctx.lineTo(16, 16)
  ctx.lineTo(-16, 16)
  ctx.fill()
  ctx.restore()

  ctx.lineWidth = 1.6
  ctx.strokeStyle = '#d9b878'
  ctx.stroke(body)

  // Ojos (las pupilas se dibujan aparte para que miren hacia donde caminás).
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = INK
  ctx.lineWidth = 1
  for (const x of [-6, 6]) {
    ctx.beginPath()
    ctx.arc(x, -5, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(244,120,140,0.55)'
  for (const x of [-11, 11]) {
    ellipse(ctx, x, 0.5, 2.6, 1.8)
    ctx.fill()
  }
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.arc(0, -0.5, 3, 0.15 * Math.PI, 0.85 * Math.PI)
  ctx.stroke()
}

// --- Enemigos -----------------------------------------------------------------------------------------

function drawAnt(ctx: CanvasRenderingContext2D, frame: 0 | 1) {
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.5
  const swing = frame === 0 ? 3 : -3
  for (const [x, dx] of [
    [-2, swing],
    [1, -swing],
    [4, swing],
  ] as const) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + dx, -9)
    ctx.moveTo(x, 0)
    ctx.lineTo(x - dx, 9)
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.moveTo(10, -2)
  ctx.lineTo(15, -6)
  ctx.moveTo(10, 2)
  ctx.lineTo(15, 6)
  ctx.stroke()

  ctx.fillStyle = INK
  ellipse(ctx, -9, 0, 7, 5.5)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(-0.5, 0, 4.3, 0, Math.PI * 2)
  ctx.arc(8, 0, 4.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ellipse(ctx, -10, -2, 3.2, 1.6)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(9.6, -1.8, 1.1, 0, Math.PI * 2)
  ctx.arc(9.6, 1.8, 1.1, 0, Math.PI * 2)
  ctx.fill()
}

function drawFly(ctx: CanvasRenderingContext2D, frame: 0 | 1) {
  const lift = frame === 0 ? 0 : 2.5
  ctx.fillStyle = 'rgba(255,255,255,0.6)'
  ctx.strokeStyle = 'rgba(110,160,190,0.9)'
  ctx.lineWidth = 0.9
  for (const side of [-1, 1]) {
    ctx.save()
    ctx.rotate(side * (0.25 + lift * 0.08))
    ellipse(ctx, -2, side * (6 + lift * 0.5), 8.5, 4)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
  ctx.fillStyle = '#2d4b3d'
  ellipse(ctx, -1, 0, 7.5, 5)
  ctx.fill()
  ctx.fillStyle = 'rgba(120,230,190,0.45)'
  ellipse(ctx, -2, -1.5, 4, 1.8)
  ctx.fill()
  ctx.fillStyle = '#3a2a2a'
  ctx.beginPath()
  ctx.arc(7, 0, 3.6, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ff5a4a'
  ctx.beginPath()
  ctx.arc(8.2, -1.7, 1.4, 0, Math.PI * 2)
  ctx.arc(8.2, 1.7, 1.4, 0, Math.PI * 2)
  ctx.fill()
}

function drawPigeon(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#6b7686'
  ctx.beginPath()
  ctx.moveTo(-12, 2)
  ctx.lineTo(-23, -2)
  ctx.lineTo(-22, 8)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#8d97a6'
  ellipse(ctx, -2, 2, 15, 11.5)
  ctx.fill()
  ctx.fillStyle = '#6d788a'
  ellipse(ctx, -6, 3, 9.5, 6)
  ctx.fill()
  ctx.fillStyle = '#9ba5b3'
  ctx.beginPath()
  ctx.arc(11, -6, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#5fa889'
  ellipse(ctx, 6, -2.5, 5, 3.4)
  ctx.fill()
  ctx.fillStyle = '#f3a43b'
  ctx.beginPath()
  ctx.moveTo(17, -8)
  ctx.lineTo(24, -5.5)
  ctx.lineTo(17, -3.5)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(13.2, -8, 1.7, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#f3a43b'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(-3, 12)
  ctx.lineTo(-3, 17)
  ctx.moveTo(3, 12)
  ctx.lineTo(3, 17)
  ctx.stroke()
}

function drawQueen(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = INK
  ctx.lineWidth = 2.6
  for (const [x, dx] of [
    [-5, 5],
    [2, -2],
    [9, 5],
  ] as const) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + dx, -17)
    ctx.moveTo(x, 0)
    ctx.lineTo(x - dx, 17)
    ctx.stroke()
  }
  ctx.fillStyle = '#7a1020'
  ellipse(ctx, -20, 0, 16, 12.5)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 1.4
  for (const x of [-26, -20, -14]) {
    ctx.beginPath()
    ctx.moveTo(x, -10)
    ctx.quadraticCurveTo(x + 2, 0, x, 10)
    ctx.stroke()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ellipse(ctx, -22, -5, 8, 3)
  ctx.fill()
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.arc(-1, 0, 9, 0, Math.PI * 2)
  ctx.arc(16, 0, 9.5, 0, Math.PI * 2)
  ctx.fill()
  // Mandíbulas y antenas.
  ctx.strokeStyle = INK
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.moveTo(23, -4)
  ctx.lineTo(30, -9)
  ctx.moveTo(23, 4)
  ctx.lineTo(30, 9)
  ctx.moveTo(20, -8)
  ctx.lineTo(28, -17)
  ctx.moveTo(20, 8)
  ctx.lineTo(28, 17)
  ctx.stroke()
  ctx.fillStyle = '#ff5a4a'
  ctx.beginPath()
  ctx.arc(19.5, -3.5, 2, 0, Math.PI * 2)
  ctx.arc(19.5, 3.5, 2, 0, Math.PI * 2)
  ctx.fill()
  // Corona.
  ctx.fillStyle = '#f7c948'
  ctx.strokeStyle = '#b8860b'
  ctx.lineWidth = 1.1
  ctx.beginPath()
  ctx.moveTo(10, -3)
  ctx.lineTo(8, -16)
  ctx.lineTo(13, -9)
  ctx.lineTo(16, -18)
  ctx.lineTo(19, -9)
  ctx.lineTo(24, -16)
  ctx.lineTo(22, -3)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

// --- Proyectiles y objetos ------------------------------------------------------------------------------

function drawCrumb(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#fff2cf'
  ctx.strokeStyle = '#d9b878'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.arc(0, 0, 4.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.8)'
  ctx.beginPath()
  ctx.arc(-1.4, -1.4, 1.2, 0, Math.PI * 2)
  ctx.fill()
}

function drawGem(ctx: CanvasRenderingContext2D) {
  const gradient = ctx.createLinearGradient(0, -8, 0, 8)
  gradient.addColorStop(0, '#fff0a3')
  gradient.addColorStop(1, '#e0a21f')
  ctx.fillStyle = gradient
  ctx.strokeStyle = '#b87a10'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, -8)
  ctx.lineTo(6, 0)
  ctx.lineTo(0, 8)
  ctx.lineTo(-6, 0)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.beginPath()
  ctx.moveTo(-1, -6)
  ctx.lineTo(2.5, -1)
  ctx.lineTo(-3, -0.5)
  ctx.closePath()
  ctx.fill()
}

function drawToast(ctx: CanvasRenderingContext2D) {
  roundRect(ctx, -10, -10, 20, 20, 5)
  ctx.fillStyle = '#e8b25f'
  ctx.fill()
  ctx.strokeStyle = '#b8742a'
  ctx.lineWidth = 2.4
  ctx.stroke()
  roundRect(ctx, -6, -6, 12, 12, 3)
  ctx.fillStyle = '#f6d896'
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ellipse(ctx, -2.5, -3, 3, 1.5)
  ctx.fill()
}

/** Mantel de cuadros rojos y crema (los colores de la marca) con viñeta suave. */
function drawBackground(canvas: HTMLCanvasElement, scale: number) {
  const ctx = canvas.getContext('2d')!
  ctx.scale(scale, scale)
  ctx.fillStyle = '#f8edd8'
  ctx.fillRect(0, 0, ARENA_W, ARENA_H)
  const cell = 36
  ctx.fillStyle = 'rgba(200,16,46,0.13)'
  for (let y = 0; y < ARENA_H; y += cell * 2) ctx.fillRect(0, y, ARENA_W, cell)
  for (let x = 0; x < ARENA_W; x += cell * 2) ctx.fillRect(x, 0, cell, ARENA_H)
  const vignette = ctx.createRadialGradient(
    ARENA_W / 2,
    ARENA_H / 2,
    ARENA_H * 0.25,
    ARENA_W / 2,
    ARENA_H / 2,
    ARENA_H * 0.68,
  )
  vignette.addColorStop(0, 'rgba(42,26,20,0)')
  vignette.addColorStop(1, 'rgba(42,26,20,0.28)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, ARENA_W, ARENA_H)
}

export function buildSprites(scale: number): SpriteSet {
  const ant: [HTMLCanvasElement, HTMLCanvasElement] = [
    sprite(34, 34, scale, (c) => drawAnt(c, 0)),
    sprite(34, 34, scale, (c) => drawAnt(c, 1)),
  ]
  const fly: [HTMLCanvasElement, HTMLCanvasElement] = [
    sprite(32, 32, scale, (c) => drawFly(c, 0)),
    sprite(32, 32, scale, (c) => drawFly(c, 1)),
  ]
  const pigeon = sprite(56, 44, scale, drawPigeon)
  const queen = sprite(84, 60, scale, drawQueen)
  const background = makeCanvas(ARENA_W, ARENA_H, scale)
  drawBackground(background, scale)

  return {
    scale,
    player: sprite(44, 44, scale, drawPlayer),
    ant,
    fly,
    pigeon,
    queen,
    antFlash: flashed(ant[0]),
    flyFlash: flashed(fly[0]),
    pigeonFlash: flashed(pigeon),
    queenFlash: flashed(queen),
    crumb: sprite(14, 14, scale, drawCrumb),
    gem: sprite(18, 20, scale, drawGem),
    toast: sprite(28, 28, scale, drawToast),
    background,
  }
}
