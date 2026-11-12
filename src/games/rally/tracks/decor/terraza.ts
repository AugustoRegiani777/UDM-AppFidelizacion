// Rally de Cocina: decorado de "La Terraza": patio de bar al atardecer, con mesas, sillas, sombrillas,
// plantas y guirnaldas. Todo lo repetido va instanciado.
import * as THREE from 'three'
import { ROOM } from '../../data.ts'
import type { DecorCtx, Draw } from './builder.ts'
import { drawChecker, furniture, shell, type Part, type Spot } from './common.ts'

const drawFacade: Draw = (g, w, h) => {
  g.fillStyle = '#f0d3a4'
  g.fillRect(0, 0, w, h)
  for (let k = 0; k < 600; k++) {
    g.fillStyle = `rgba(120,80,40,${Math.random() * 0.06})`
    g.fillRect(Math.random() * w, Math.random() * h, 3, 3)
  }
  // ventana con persianas verdes
  g.fillStyle = '#6f4a2c'
  g.fillRect(w * 0.3, h * 0.18, w * 0.4, h * 0.56)
  g.fillStyle = '#ffd98a'
  g.fillRect(w * 0.33, h * 0.22, w * 0.34, h * 0.48)
  g.fillStyle = '#2f8f6b'
  g.fillRect(w * 0.18, h * 0.18, w * 0.11, h * 0.56)
  g.fillRect(w * 0.71, h * 0.18, w * 0.11, h * 0.56)
  g.fillStyle = '#6f4a2c'
  g.fillRect(w * 0.49, h * 0.22, w * 0.02, h * 0.48)
  g.fillRect(w * 0.33, h * 0.44, w * 0.34, h * 0.02)
}
const drawStripes: Draw = (g, w, h) => {
  for (let i = 0; i < 10; i++) {
    g.fillStyle = i % 2 ? '#fff4df' : '#e05a3a'
    g.fillRect((i * w) / 10, 0, w / 10 + 1, h)
  }
}

export function buildTerraza(ctx: DecorCtx) {
  shell(ctx, {
    floor: drawChecker('#c98a5e', '#b8a18a', 'rgba(110,80,56,.7)', 4),
    floorTile: 14,
    floorRough: 0.85,
    wallColor: 0xf0d3a4,
    wall: drawFacade,
    wallTile: 22,
    ceiling: false,
    baseboard: 0xb98a5a,
  })
  // sol bajo en la pared oeste
  ctx.add(new THREE.CircleGeometry(11, 24), ctx.basic(0xfff0c8), ROOM.x0 + 0.2, 30, 8, {
    ry: Math.PI / 2,
    cast: false,
    receive: false,
  })
  ctx.add(
    new THREE.CircleGeometry(20, 24),
    ctx.basic(0xffc98a, { transparent: true, opacity: 0.35 }),
    ROOM.x0 + 0.15,
    30,
    8,
    { ry: Math.PI / 2, cast: false, receive: false },
  )
  // toldo a rayas sobre la pared norte
  ctx.add(
    ctx.B(200, 0.8, 12),
    ctx.texMat(128, 32, drawStripes, { roughness: 0.8 }),
    0,
    33,
    ROOM.z0 + 6,
    { rx: 0.18 },
  )

  // mesas bistró con sillas y sombrillas, en el centro del óvalo
  const tables: Spot[] = [
    { x: -48, z: 10 },
    { x: -8, z: 22 },
    { x: 34, z: 14 },
    { x: 56, z: -8 },
    { x: -34, z: -22 },
    { x: 12, z: -14 },
  ]
  const wood = ctx.mat(0x7a4a2a, { roughness: 0.7 })
  const iron = ctx.mat(0x2b2f36, { roughness: 0.5, metalness: 0.4 })
  const tops = [0xe05a3a, 0xf2c14e, 0x2f8f6b, 0x3a7fd9, 0xe8e2d4, 0xd96aa0]
  furniture(ctx, tables, [
    {
      geo: ctx.cyl(5.5, 5.5, 0.8, 18),
      mat: ctx.mat(0xffffff, { roughness: 0.5 }),
      x: 0,
      y: 9,
      z: 0,
      colors: tops,
    },
    { geo: ctx.cyl(0.6, 0.6, 9, 8), mat: iron, x: 0, y: 4.5, z: 0 },
    { geo: ctx.cyl(3.2, 3.6, 0.6, 14), mat: iron, x: 0, y: 0.3, z: 0 },
    // sombrilla
    { geo: ctx.cyl(0.35, 0.35, 15, 6), mat: wood, x: 0, y: 8.5, z: 0 },
    {
      geo: ctx.cyl(0.1, 11, 3.4, 10),
      mat: ctx.mat(0xffffff, { roughness: 0.8 }),
      x: 0,
      y: 17.2,
      z: 0,
      colors: [0xfff1d2, 0xe05a3a, 0xfff1d2, 0x2f8f6b, 0xfff1d2, 0xf2c14e],
    },
  ])
  const chairs: Spot[] = []
  for (const t of tables)
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + 0.4 + (t.x % 7) * 0.1
      chairs.push({ x: t.x + Math.sin(a) * 8.6, z: t.z + Math.cos(a) * 8.6, ry: a + Math.PI })
    }
  const chairWood = ctx.mat(0xc9773c, { roughness: 0.6 })
  const legs: Part[] = [
    [-2.1, -2.1],
    [2.1, -2.1],
    [-2.1, 2.1],
    [2.1, 2.1],
  ].map(([x, z]) => ({ geo: ctx.B(0.6, 5, 0.6), mat: chairWood, x: x!, y: 2.5, z: z! }))
  furniture(ctx, chairs, [
    { geo: ctx.B(5.2, 0.7, 5.2), mat: chairWood, x: 0, y: 5.2, z: 0 },
    { geo: ctx.B(5.2, 4.5, 0.6), mat: chairWood, x: 0, y: 8, z: -2.4 },
    ...legs,
  ])
  for (const t of tables) ctx.check('mesa', t.x, t.z, 12.5)

  // árbol en el centro
  const treeG = ctx.group(-4, 0, -2)
  ctx.part(treeG, ctx.cyl(1.4, 2, 13, 8), ctx.mat(0x6b4426), 0, 6.5, 0)
  for (const [x, y, z, r] of [
    [0, 17, 0, 9],
    [-5, 14, 3, 6.5],
    [5, 14, -3, 6.5],
  ] as const)
    ctx.part(
      treeG,
      ctx.sphere(r, 9, 7),
      ctx.mat(0x4f9a52, { roughness: 0.9, flatShading: true }),
      x,
      y,
      z,
    )
  ctx.check('árbol', -4, -2, 9)

  // macetas con arbustos contra las paredes norte y sur
  const pots: Spot[] = []
  for (let x = -92; x <= 92; x += 23) {
    pots.push({ x, z: 80 })
    pots.push({ x: x + 11, z: -80 })
  }
  furniture(ctx, pots, [
    {
      geo: ctx.cyl(4.2, 3.2, 5, 10),
      mat: ctx.mat(0xc2623a, { roughness: 0.8 }),
      x: 0,
      y: 2.5,
      z: 0,
    },
    {
      geo: ctx.sphere(4.6, 8, 6),
      mat: ctx.mat(0x3f8f4a, { roughness: 0.9, flatShading: true }),
      x: 0,
      y: 7,
      z: 0,
      colors: [0x3f8f4a, 0x56a552, 0x2f7d46],
    },
  ])
  for (const p of pots) ctx.check('maceta', p.x, p.z, 5)

  // postes con guirnaldas
  const posts: [number, number][] = [
    [-70, -26],
    [-70, 40],
    [70, -22],
    [72, 38],
  ]
  const postGeo = ctx.cyl(0.5, 0.6, 26, 6)
  for (const [x, z] of posts) {
    ctx.add(postGeo, iron, x, 13, z)
    ctx.check('poste', x, z, 1)
  }
  const bulbs: Spot[] = []
  const wire = new THREE.LineBasicMaterial({ color: 0x20242a })
  const lines: [number, number, number, number][] = [
    [0, 1, 0, 0],
    [2, 3, 0, 0],
    [0, 2, 0, 0],
    [1, 3, 0, 0],
  ]
  for (const [i, j] of lines) {
    const a = posts[i!]!
    const b = posts[j!]!
    const pts: THREE.Vector3[] = []
    const n = 24
    for (let k = 0; k <= n; k++) {
      const t = k / n
      const x = a[0] + (b[0] - a[0]) * t
      const z = a[1] + (b[1] - a[1]) * t
      const y = 25 - Math.sin(t * Math.PI) * 4.5
      pts.push(new THREE.Vector3(x, y, z))
      if (k % 2 === 1) bulbs.push({ x, y: y - 0.7, z })
    }
    ctx.root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire))
  }
  furniture(ctx, bulbs, [
    {
      geo: ctx.sphere(0.55, 6, 4),
      mat: ctx.basic(0xffffff),
      x: 0,
      y: 0,
      z: 0,
      cast: false,
      colors: [0xfff0b0, 0xffd27a, 0xffe2a0],
    },
  ])
}
