// Rally de Cocina: decorado de "La Montaña de Harina": una mesa de amasar cubierta de harina, con montañas
// blancas, una cuchara de madera clavada, un colador, huevos y espigas de trigo. La pista sube por encima.
import type { DecorCtx, Draw } from './builder.ts'
import { drawBag, drawPlanks, furniture, shell, speckle, type Spot } from './common.ts'

const drawFlourTable: Draw = (g, w, h) => {
  drawPlanks('#d8b684', 'rgba(110,70,30,.8)', 4)(g, w, h)
  // velo de harina
  for (let k = 0; k < 40; k++) {
    const x = Math.random() * w
    const y = Math.random() * h
    const r = 20 + Math.random() * 50
    const gr = g.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, 'rgba(255,255,255,.55)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = gr
    g.fillRect(x - r, y - r, r * 2, r * 2)
  }
  speckle(g, w, h, 600, (r) => `rgba(255,255,255,${0.2 + r * 0.4})`)
}

export function buildHarina(ctx: DecorCtx) {
  shell(ctx, {
    floor: drawFlourTable,
    floorTile: 22,
    floorRough: 0.9,
    wallColor: 0xf3e6c8,
    wallRough: 1,
    ceiling: 0xf7efdc,
    baseboard: 0xb98a5a,
  })
  const flour = ctx.mat(0xf8f4ea, { roughness: 1, flatShading: true })
  const wood = ctx.mat(0xc58a4c, { roughness: 0.7 })

  // montañas de harina en el valle del centro
  const hills: Spot[] = [
    { x: 0, z: 0, s: 1.7 },
    { x: -50, z: 12, s: 1.1 },
    { x: 50, z: 8, s: 1.2 },
    { x: -20, z: -22, s: 0.8 },
    { x: 24, z: 24, s: 0.9 },
  ]
  furniture(ctx, hills, [
    { geo: ctx.cyl(0.5, 14, 11, 9), mat: flour, x: 0, y: 5.5, z: 0 },
    { geo: ctx.cyl(0.4, 8, 6, 8), mat: flour, x: 8, y: 3, z: 6 },
  ])
  for (const h of hills) ctx.check('montaña', h.x, h.z, 14 * (h.s ?? 1))

  // cuchara de madera clavada en la montaña grande
  const sp = ctx.group(2, 14, -2, 0.4)
  ctx.part(sp, ctx.cyl(0.9, 0.9, 22, 8), wood, 0, 9, 0, { rz: 0.25 })
  const bowl = ctx.part(sp, ctx.sphere(3.6, 10, 8), wood, -2.6, 20.5, 0, { rz: 0.25 })
  bowl.scale.set(0.7, 1.3, 0.35)

  // colador
  const co = ctx.group(-62, 0, -8)
  ctx.part(co, ctx.cyl(9, 8, 6, 18), ctx.mat(0xc9ced4, { metalness: 0.7, roughness: 0.3 }), 0, 3, 0)
  ctx.part(co, ctx.cyl(8.2, 8.2, 0.3, 18), ctx.mat(0xf8f4ea, { roughness: 1 }), 0, 5.8, 0)
  ctx.part(co, ctx.B(14, 1, 2.4), ctx.mat(0xc9ced4, { metalness: 0.7, roughness: 0.3 }), 13, 5, 0)
  ctx.check('colador', -62, -8, 10)

  // huevos
  const eggs: Spot[] = [
    { x: -36, z: 28 },
    { x: 38, z: -18 },
    { x: -8, z: 30 },
    { x: 66, z: 24 },
    { x: -78, z: 18 },
    { x: 10, z: -28 },
    { x: -70, z: -34 },
  ]
  furniture(ctx, eggs, [
    {
      geo: ctx.sphere(3, 10, 8),
      mat: ctx.mat(0xf2e3c6, { roughness: 0.5 }),
      x: 0,
      y: 3.8,
      z: 0,
      sy: 1.3,
      colors: [0xf2e3c6, 0xdcb98a, 0xf2e3c6],
    },
  ])
  for (const e of eggs) ctx.check('huevo', e.x, e.z, 3.4)

  // bolsas de harina contra las paredes
  const bagMat = ctx.texMat(
    128,
    192,
    drawBag('#f6efe0', '#6b8f5a', 'HARINA', 'de la montaña'),
    { roughness: 0.9 },
    { wrap: false },
  )
  const bags: Spot[] = []
  for (let x = -90; x <= 90; x += 22) bags.push({ x, z: 82, ry: Math.PI })
  for (let x = -80; x <= 80; x += 22) bags.push({ x, z: -82, ry: 0 })
  furniture(ctx, bags, [{ geo: ctx.B(12, 6, 16), mat: bagMat, x: 0, y: 3, z: 0 }])
  for (const b of bags) ctx.check('bolsa', b.x, b.z, 7)

  // espigas de trigo
  const wheat: Spot[] = []
  for (let k = 0; k < 70; k++) {
    for (let t = 0; t < 20; t++) {
      const x = ctx.rand(-106, 106)
      const z = ctx.rand(-84, 84)
      if (ctx.rt.distToTrack(x, z) > 4.5 && ctx.rt.maxY > 0) {
        wheat.push({ x, z, ry: ctx.rand(0, 6.28), s: ctx.rand(0.8, 1.3) })
        break
      }
    }
  }
  furniture(ctx, wheat, [
    { geo: ctx.cyl(0.12, 0.16, 8, 4), mat: ctx.mat(0xb99a45), x: 0, y: 4, z: 0, cast: false },
    {
      geo: ctx.sphere(0.5, 6, 5),
      mat: ctx.mat(0xd9b95a, { roughness: 0.8 }),
      x: 0,
      y: 8.2,
      z: 0,
      sy: 2.2,
      cast: false,
    },
  ])

  // luces del techo
  const lights: Spot[] = []
  for (let x = -70; x <= 70; x += 70) for (const z of [-50, 0, 50]) lights.push({ x, z })
  furniture(ctx, lights, [
    { geo: ctx.B(18, 0.4, 5), mat: ctx.basic(0xffffff), x: 0, y: 55.7, z: 0, cast: false },
  ])
}
