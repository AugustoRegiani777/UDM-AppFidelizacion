// El sanguchito de miga: protagonista de los juegos (se dibuja centrado en (0, 0), sin pupilas).
// Las pupilas las dibuja cada juego aparte para que miren hacia donde corresponde.

const INK = '#2a1a14'

export function drawHero(ctx: CanvasRenderingContext2D) {
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
    ctx.beginPath()
    ctx.ellipse(x, 0.5, 2.6, 1.8, 0, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = INK
  ctx.lineWidth = 1.3
  ctx.beginPath()
  ctx.arc(0, -0.5, 3, 0.15 * Math.PI, 0.85 * Math.PI)
  ctx.stroke()
}
