// Rally de Cocina: decorado de "La Barra": mostrador de madera, tazas gigantes, granos de café, la cafetera
// y lámparas colgantes. Cálido y un poco oscuro.
import * as THREE from 'three'
import type { DecorCtx } from './builder.ts'
import { drawPlanks, furniture, shell, type Spot } from './common.ts'

export function buildBarra(ctx: DecorCtx) {
  shell(ctx, {
    floor: drawPlanks('#6b4528', 'rgba(30,15,5,.8)', 4),
    floorTile: 20,
    floorRough: 0.55,
    wallColor: 0x4a3020,
    wall: drawPlanks('#5a3a24', 'rgba(25,12,4,.8)', 6, true),
    wallTile: 28,
    ceiling: 0x2b1c12,
    baseboard: 0x2f1d10,
  })
  const ceramic = ctx.mat(0xf6efe3, { roughness: 0.3 })
  const coffee = ctx.mat(0x3b1f0e, { roughness: 0.15, metalness: 0.2 })
  const chrome = ctx.mat(0xcfd4d9, { metalness: 0.85, roughness: 0.22 })
  const dark = ctx.mat(0x23201e, { roughness: 0.5, metalness: 0.3 })
  const copper = ctx.mat(0xb8693a, { metalness: 0.7, roughness: 0.3 })
  const handleGeo = new THREE.TorusGeometry(3.4, 1, 8, 14, Math.PI)

  // tazas gigantes con su plato
  const cups: Spot[] = [
    { x: -55, z: -4, ry: 0.6 },
    { x: -22, z: 16, ry: -0.4 },
    { x: 16, z: -6, ry: 2.4 },
    { x: -62, z: 30, ry: 1.2 },
  ]
  const cupColors = [0xf6efe3, 0xe05a3a, 0x3a7fd9, 0xf2c14e]
  furniture(ctx, cups, [
    { geo: ctx.cyl(12, 12.5, 1, 22), mat: ceramic, x: 0, y: 0.5, z: 0 },
    {
      geo: ctx.cyl(8.2, 6.2, 9.5, 22),
      mat: ctx.mat(0xffffff, { roughness: 0.3 }),
      x: 0,
      y: 5.7,
      z: 0,
      colors: cupColors,
    },
    { geo: ctx.cyl(7.4, 7.4, 0.3, 22), mat: coffee, x: 0, y: 10.3, z: 0 },
    {
      geo: handleGeo,
      mat: ctx.mat(0xffffff, { roughness: 0.3 }),
      x: 8.2,
      y: 6.2,
      z: 0,
      rz: -Math.PI / 2,
      colors: cupColors,
    },
  ])
  for (const c of cups) ctx.check('taza', c.x, c.z, 13)

  // granos de café por todos lados
  const beans: Spot[] = []
  for (let k = 0; k < 150; k++) {
    for (let t = 0; t < 20; t++) {
      const x = ctx.rand(-104, 104)
      const z = ctx.rand(-82, 82)
      if (ctx.rt.distToTrack(x, z) > 3.2) {
        beans.push({ x, z, ry: ctx.rand(0, 6.28), s: ctx.rand(0.8, 1.5) })
        break
      }
    }
  }
  furniture(ctx, beans, [
    {
      geo: ctx.sphere(0.9, 7, 5),
      mat: ctx.mat(0x5a2d12, { roughness: 0.5 }),
      x: 0,
      y: 0.5,
      z: 0,
      sx: 1,
      sy: 0.6,
      sz: 1.35,
      colors: [0x5a2d12, 0x4a2410, 0x6b3a1a],
      cast: false,
    },
  ])

  // la cafetera, contra la pared norte
  const g = ctx.group(-10, 0, -78)
  ctx.part(g, ctx.B(46, 8, 18), dark, 0, 4, 0)
  ctx.part(g, ctx.B(46, 20, 16), chrome, 0, 18, 0)
  ctx.part(g, ctx.cyl(5, 5, 46, 14), copper, 0, 31, 0, { rz: Math.PI / 2 })
  for (const x of [-14, 0, 14]) {
    ctx.part(g, ctx.cyl(2.4, 2.4, 3, 10), dark, x, 12, 9.5)
    ctx.part(g, ctx.cyl(0.8, 0.8, 7, 8), dark, x, 6, 10)
    ctx.part(g, ctx.cyl(2.8, 2.8, 2.4, 12), ceramic, x, 1.5, 12)
  }
  ctx.part(g, ctx.cyl(0.6, 0.6, 12, 6), chrome, 21, 22, 9, { rz: 0.5 })
  for (const dx of [-14, 0, 14]) ctx.check('cafetera', -10 + dx, -78, 10)

  // molinillo en la esquina noroeste
  const m = ctx.group(-88, 0, -76)
  ctx.part(m, ctx.B(10, 16, 10), dark, 0, 8, 0)
  ctx.part(
    m,
    ctx.cyl(1, 6, 10, 12),
    ctx.mat(0xe9edf0, { roughness: 0.3, transparent: true, opacity: 0.7 }),
    0,
    21,
    0,
  )
  ctx.part(m, ctx.cyl(5, 5, 4, 12), coffee, 0, 3, 7)
  ctx.check('molinillo', -88, -76, 8)

  // banquetas contra la pared sur
  const stools: Spot[] = []
  for (let x = -90; x <= 90; x += 20) stools.push({ x, z: 80 })
  furniture(ctx, stools, [
    { geo: ctx.cyl(4, 4, 1.2, 14), mat: ctx.mat(0xb83a2a, { roughness: 0.5 }), x: 0, y: 9.4, z: 0 },
    { geo: ctx.cyl(0.7, 0.7, 9, 8), mat: chrome, x: 0, y: 4.5, z: 0 },
    { geo: ctx.cyl(3.4, 3.8, 0.6, 12), mat: chrome, x: 0, y: 0.3, z: 0 },
  ])
  for (const s of stools) ctx.check('banqueta', s.x, s.z, 4)

  // botellas en un estante sobre la pared este
  const bottles: Spot[] = []
  for (let z = -64; z <= 64; z += 6) bottles.push({ x: 109, z, y: 22 })
  furniture(ctx, bottles, [
    {
      geo: ctx.cyl(1, 1, 5, 7),
      mat: ctx.mat(0xffffff, { roughness: 0.2, transparent: true, opacity: 0.85 }),
      x: 0,
      y: 2.5,
      z: 0,
      colors: [0x2f8f6b, 0xb8693a, 0x3a7fd9, 0xe05a3a, 0xf2c14e],
    },
  ])
  ctx.add(ctx.B(5, 0.6, 140), ctx.mat(0x3b2616), 109.5, 21.6, 0)

  // lámparas colgantes
  const lamps: Spot[] = []
  for (const x of [-60, -20, 20, 60]) for (const z of [-30, 10]) lamps.push({ x, z })
  furniture(ctx, lamps, [
    { geo: ctx.cyl(0.25, 0.25, 14, 5), mat: dark, x: 0, y: 49, z: 0 },
    { geo: ctx.cyl(1, 5.5, 3.4, 12), mat: copper, x: 0, y: 40.3, z: 0 },
    { geo: ctx.sphere(1.6, 8, 6), mat: ctx.basic(0xffe3a0), x: 0, y: 38.6, z: 0, cast: false },
  ])
}
