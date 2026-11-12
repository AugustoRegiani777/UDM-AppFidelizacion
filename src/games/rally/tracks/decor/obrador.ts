// Rally de Cocina: decorado de "El Obrador": mesada de acero, paredes de azulejo, rodillos, bolsas de harina
// y una batidora gigante en el centro.
import type { DecorCtx, Draw } from './builder.ts'
import { drawBag, drawSubway, furniture, shell, speckle, type Spot } from './common.ts'

const drawSteel: Draw = (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, w, h)
  gr.addColorStop(0, '#b9c0c7')
  gr.addColorStop(0.5, '#d4d9de')
  gr.addColorStop(1, '#aeb6be')
  g.fillStyle = gr
  g.fillRect(0, 0, w, h)
  g.strokeStyle = 'rgba(255,255,255,.35)'
  for (let k = 0; k < 90; k++) {
    g.lineWidth = 1
    const y = Math.random() * h
    g.beginPath()
    g.moveTo(0, y)
    g.lineTo(w, y + (Math.random() - 0.5) * 4)
    g.stroke()
  }
  speckle(g, w, h, 900, (r) => `rgba(60,70,80,${r * 0.08})`)
  g.strokeStyle = 'rgba(80,90,100,.55)'
  g.lineWidth = 3
  g.strokeRect(1, 1, w - 2, h - 2)
}

export function buildObrador(ctx: DecorCtx) {
  shell(ctx, {
    floor: drawSteel,
    floorTile: 26,
    floorRough: 0.3,
    floorMetal: 0.55,
    wallColor: 0xe9eef0,
    wall: drawSubway('#eef3f4', '#b6c2c6'),
    wallTile: 22,
    ceiling: 0xf4f6f7,
    baseboard: 0xaab2ba,
  })
  const steel = ctx.mat(0xc9ced4, { metalness: 0.7, roughness: 0.28 })
  const red = ctx.mat(0xd9573a, { roughness: 0.4 })
  const wood = ctx.mat(0xd9a45f, { roughness: 0.7 })
  const dough = ctx.mat(0xf1dcb0, { roughness: 0.9 })

  // batidora gigante en el centro
  const m = ctx.group(-4, 0, 4, 0.25)
  ctx.part(m, ctx.B(16, 3, 22), red, 0, 1.5, 0)
  ctx.part(m, ctx.B(7, 24, 7), red, 0, 14, -7)
  ctx.part(m, ctx.B(9, 7, 24), red, 0, 25, 1)
  ctx.part(m, ctx.sphere(8.5, 14, 8), steel, 0, 9, 5).scale.y = 0.8
  ctx.part(m, ctx.cyl(0.7, 0.7, 10, 8), steel, 0, 20, 5)
  ctx.part(m, ctx.cyl(4, 6, 3.4, 14), dough, 0, 14.6, 5)
  ctx.check('batidora', -4, 4, 14)

  // rodillos
  const pins: Spot[] = [
    { x: -45, z: -10, ry: 0.3 },
    { x: 40, z: 22, ry: -0.5 },
    { x: -50, z: 79, ry: 0.05 },
    { x: 50, z: -80, ry: -0.05 },
    { x: -70, z: -80, ry: 0.05 },
  ]
  furniture(ctx, pins, [
    { geo: ctx.cyl(2.6, 2.6, 22, 12), mat: wood, x: 0, y: 2.6, z: 0, rz: Math.PI / 2 },
    { geo: ctx.cyl(1, 1, 7, 8), mat: wood, x: 14, y: 2.6, z: 0, rz: Math.PI / 2 },
    { geo: ctx.cyl(1, 1, 7, 8), mat: wood, x: -14, y: 2.6, z: 0, rz: Math.PI / 2 },
  ])
  for (const p of pins) for (const dx of [-12, 0, 12]) ctx.check('rodillo', p.x + dx, p.z, 3.5)

  // bolsas de harina apiladas contra las paredes norte y sur
  const bagMat = ctx.texMat(
    128,
    192,
    drawBag('#f4ecd8', '#c0392b', 'HARINA', '000 · 25 kg'),
    { roughness: 0.9 },
    { wrap: false },
  )
  const bags: Spot[] = []
  for (let x = -90; x <= 90; x += 20) {
    bags.push({ x, z: 82, ry: Math.PI + (x % 3) * 0.05 })
    bags.push({ x: x + 6, z: 82, y: 6.4 * (x % 40 === 0 ? 1 : 0), ry: Math.PI - 0.08 })
  }
  furniture(ctx, bags, [{ geo: ctx.B(12, 6, 16), mat: bagMat, x: 0, y: 3, z: 0 }])
  for (const b of bags) ctx.check('bolsa', b.x, b.z, 7)

  // montañitas de harina y bollos de masa
  const piles: Spot[] = [
    { x: 30, z: -4 },
    { x: -26, z: 28 },
    { x: -72, z: -18 },
    { x: 66, z: 10 },
  ]
  furniture(ctx, piles, [
    {
      geo: ctx.cyl(0.4, 8, 5.5, 9),
      mat: ctx.mat(0xf8f5ee, { roughness: 1, flatShading: true }),
      x: 0,
      y: 2.75,
      z: 0,
    },
  ])
  for (const p of piles) ctx.check('harina', p.x, p.z, 8)
  const balls: Spot[] = []
  for (let k = 0; k < 16; k++) {
    for (let t = 0; t < 20; t++) {
      const x = ctx.rand(-86, 86)
      const z = ctx.rand(-44, 46)
      if (ctx.rt.distToTrack(x, z) > 6 && Math.hypot(x + 4, z - 4) > 18) {
        balls.push({ x, z, s: ctx.rand(0.8, 1.2) })
        break
      }
    }
  }
  furniture(ctx, balls, [{ geo: ctx.sphere(2.3, 10, 7), mat: dough, x: 0, y: 1.6, z: 0, sy: 0.75 }])

  // bandejas colgadas y luces del techo
  const trays: Spot[] = []
  for (let x = -80; x <= 80; x += 20) trays.push({ x, z: -87.4, y: 30 + (x % 40 === 0 ? 6 : 0) })
  furniture(ctx, trays, [
    { geo: ctx.B(14, 0.5, 20), mat: steel, x: 0, y: 0, z: 0, rx: Math.PI / 2 },
  ])
  const lights: Spot[] = []
  for (let x = -80; x <= 80; x += 40) for (const z of [-50, 0, 50]) lights.push({ x, z })
  furniture(ctx, lights, [
    { geo: ctx.B(22, 0.4, 5), mat: ctx.basic(0xffffff), x: 0, y: 55.7, z: 0, cast: false },
  ])
}
