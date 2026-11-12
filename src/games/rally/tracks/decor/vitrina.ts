// Rally de Cocina: decorado de "La Vitrina": adentro de la vitrina de pastelería, con medialunas gigantes,
// frascos de dulce de leche, pilas de alfajores, tortas bajo cúpula y paneles de vidrio.
import * as THREE from 'three'
import type { DecorCtx, Draw } from './builder.ts'
import { drawChecker, furniture, shell, type Spot } from './common.ts'

const drawPastel: Draw = (g, w, h) => {
  g.fillStyle = '#fbe4ea'
  g.fillRect(0, 0, w, h)
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? 'rgba(255,255,255,.55)' : 'rgba(244,177,200,.35)'
    g.fillRect((i * w) / 8, 0, w / 8, h)
  }
  g.fillStyle = 'rgba(190,120,150,.35)'
  for (let i = 0; i <= 8; i++) g.fillRect((i * w) / 8 - 1, 0, 2, h)
}

export function buildVitrina(ctx: DecorCtx) {
  shell(ctx, {
    floor: drawChecker('#fff4f6', '#f6c9d6', 'rgba(190,130,150,.6)', 4),
    floorTile: 14,
    floorRough: 0.25,
    wallColor: 0xfbe4ea,
    wall: drawPastel,
    wallTile: 24,
    ceiling: 0xfff7f8,
    baseboard: 0xe8a8bd,
  })
  const silver = ctx.mat(0xd7dbe0, { metalness: 0.8, roughness: 0.25 })
  const crust = ctx.mat(0xe2a24c, { roughness: 0.55 })
  const brown = ctx.mat(0x8a4a1a, { roughness: 0.18, metalness: 0.15 })
  const cream = ctx.mat(0xfff0cf, { roughness: 0.5 })
  const glass = ctx.mat(0xcfeaf2, {
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
  })

  // medialunas gigantes sobre bandejas
  const luna: Spot[] = [
    { x: -60, z: 12, ry: 0.5 },
    { x: -30, z: -8, ry: 2.2 },
    { x: 28, z: 6, ry: -0.6 },
    { x: -8, z: 36, ry: 1.2 },
    { x: 58, z: -4, ry: 3.4 },
  ]
  furniture(ctx, luna, [
    { geo: ctx.B(30, 0.8, 18), mat: silver, x: 0, y: 0.4, z: 0 },
    {
      geo: new THREE.TorusGeometry(7, 3.1, 7, 12, Math.PI * 1.25),
      mat: crust,
      x: 0,
      y: 3.6,
      z: 0,
      rx: -Math.PI / 2,
    },
    {
      geo: new THREE.TorusGeometry(7, 1.3, 5, 12, Math.PI * 1.1),
      mat: ctx.mat(0xf3c274, { roughness: 0.5 }),
      x: 0,
      y: 5.9,
      z: 0,
      rx: -Math.PI / 2,
      ry: 0,
    },
  ])
  for (const l of luna) ctx.check('bandeja', l.x, l.z, 16)

  // frascos de dulce de leche
  const jars: Spot[] = [
    { x: 0, z: 10, s: 1.5 },
    { x: -48, z: 38 },
    { x: 66, z: 24 },
  ]
  furniture(ctx, jars, [
    { geo: ctx.cyl(6, 6, 10, 16), mat: brown, x: 0, y: 5, z: 0 },
    { geo: ctx.cyl(6.5, 6.5, 1.6, 16), mat: cream, x: 0, y: 10.8, z: 0 },
    { geo: ctx.cyl(6.1, 6.1, 4, 16), mat: cream, x: 0, y: 5, z: 0, sx: 1.002, sz: 1.002 },
  ])
  for (const j of jars) ctx.check('frasco', j.x, j.z, 10)

  // pilas de alfajores
  const stacks: Spot[] = [
    { x: -76, z: -26 },
    { x: 40, z: -22, s: 1.2 },
    { x: 78, z: 6 },
    { x: -34, z: 22 },
  ]
  const cookie = ctx.mat(0xf1d9a8, { roughness: 0.7 })
  const choc = ctx.mat(0x4a2616, { roughness: 0.3 })
  const fill = ctx.mat(0xb8691e, { roughness: 0.2 })
  furniture(ctx, stacks, [
    { geo: ctx.cyl(4.2, 4.2, 1.5, 14), mat: cookie, x: 0, y: 0.75, z: 0 },
    { geo: ctx.cyl(3.9, 3.9, 0.9, 14), mat: fill, x: 0, y: 1.95, z: 0 },
    { geo: ctx.cyl(4.2, 4.2, 1.5, 14), mat: cookie, x: 0, y: 3.15, z: 0 },
    { geo: ctx.cyl(3.9, 3.9, 0.9, 14), mat: fill, x: 0, y: 4.35, z: 0 },
    { geo: ctx.cyl(4.3, 4.3, 1.7, 14), mat: choc, x: 0, y: 5.6, z: 0 },
  ])
  for (const s of stacks) ctx.check('alfajores', s.x, s.z, 6)

  // tortas bajo cúpula de vidrio
  const cakes: Spot[] = [
    { x: -62, z: -30 },
    { x: 18, z: 34 },
  ]
  furniture(ctx, cakes, [
    { geo: ctx.cyl(1.2, 1.2, 4, 8), mat: silver, x: 0, y: 2, z: 0 },
    { geo: ctx.cyl(10, 10, 0.8, 18), mat: silver, x: 0, y: 4.2, z: 0 },
    {
      geo: ctx.cyl(6.5, 6.5, 5.5, 16),
      mat: ctx.mat(0xf4a6c0, { roughness: 0.5 }),
      x: 0,
      y: 7.4,
      z: 0,
    },
    { geo: ctx.sphere(1.3, 8, 6), mat: ctx.mat(0xd8282f, { roughness: 0.3 }), x: 0, y: 10.7, z: 0 },
    {
      geo: new THREE.SphereGeometry(9, 16, 9, 0, Math.PI * 2, 0, Math.PI / 2),
      mat: glass,
      x: 0,
      y: 4.6,
      z: 0,
      cast: false,
    },
  ])
  for (const c of cakes) ctx.check('torta', c.x, c.z, 11)

  // paneles de vidrio contra las paredes norte y sur, con marcos
  const panes: Spot[] = []
  for (let x = -90; x <= 90; x += 30) {
    panes.push({ x, z: -84 })
    panes.push({ x, z: 84 })
  }
  furniture(ctx, panes, [
    { geo: ctx.B(27, 28, 0.5), mat: glass, x: 0, y: 14.5, z: 0, cast: false },
    { geo: ctx.B(28, 0.8, 1), mat: silver, x: 0, y: 0.5, z: 0 },
    { geo: ctx.B(28, 0.8, 1), mat: silver, x: 0, y: 28.6, z: 0 },
  ])
  // luces del techo
  const lights: Spot[] = []
  for (let x = -75; x <= 75; x += 50) for (const z of [-55, -5, 45]) lights.push({ x, z })
  furniture(ctx, lights, [
    { geo: ctx.B(20, 0.4, 20), mat: ctx.basic(0xfffaf4), x: 0, y: 55.7, z: 0, cast: false },
  ])
}
