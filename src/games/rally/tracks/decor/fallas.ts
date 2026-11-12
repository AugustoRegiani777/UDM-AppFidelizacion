// Rally de Cocina: decorado de "Noche de Fallas": calles de noche con edificios de ventanas encendidas,
// guirnaldas de luces, banderines, faroles, ninots (figuras de cartón) y un cielo con estrellas.
import * as THREE from 'three'
import type { DecorCtx, Draw } from './builder.ts'
import { furniture, shell, speckle, type Spot } from './common.ts'

const drawCobble: Draw = (g, w, h) => {
  g.fillStyle = '#1b2038'
  g.fillRect(0, 0, w, h)
  const s = w / 8
  for (let j = 0; j < 8; j++)
    for (let i = 0; i < 8; i++) {
      const v = 38 + Math.random() * 22
      g.fillStyle = `rgb(${v},${v + 4},${v + 26})`
      g.fillRect(i * s + (j % 2 ? s / 2 : 0) + 2, j * s + 2, s - 4, s - 4)
    }
  speckle(g, w, h, 500, (r) => `rgba(160,190,255,${r * 0.1})`)
}

const drawWindows: Draw = (g, w, h) => {
  g.fillStyle = '#141a36'
  g.fillRect(0, 0, w, h)
  const cols = 4
  const rows = 6
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const lit = Math.random() < 0.6
      g.fillStyle = lit ? (Math.random() < 0.5 ? '#ffd27a' : '#ffb066') : '#232c55'
      g.fillRect(
        8 + (i * (w - 16)) / cols,
        8 + (j * (h - 16)) / rows,
        (w - 16) / cols - 8,
        (h - 16) / rows - 10,
      )
    }
}

export function buildFallas(ctx: DecorCtx) {
  shell(ctx, {
    floor: drawCobble,
    floorTile: 16,
    floorRough: 0.35,
    floorMetal: 0.1,
    wallColor: 0x141a36,
    wall: drawWindows,
    wallTile: 28,
    ceiling: false,
    baseboard: false,
  })
  // estrellas
  const star: number[] = []
  for (let k = 0; k < 220; k++)
    star.push(ctx.rand(-300, 300), ctx.rand(70, 220), ctx.rand(-300, 300))
  const sg = new THREE.BufferGeometry()
  sg.setAttribute('position', new THREE.Float32BufferAttribute(star, 3))
  const stars = new THREE.Points(
    sg,
    new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: true, fog: false }),
  )
  stars.frustumCulled = false
  ctx.root.add(stars)
  // luna
  ctx.add(new THREE.CircleGeometry(9, 24), ctx.basic(0xfff2c8, { fog: false }), 30, 90, -140, {
    cast: false,
    receive: false,
  })

  // edificios en los cuatro rincones (con ventanas encendidas)
  const winTex = ctx.tex(128, 192, drawWindows, { wrap: false })
  const bld = new THREE.MeshStandardMaterial({
    map: winTex,
    emissiveMap: winTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.75,
    roughness: 0.9,
  })
  const blocks: Spot[] = [
    { x: 52, z: -58, s: 1 },
    { x: 86, z: -52, s: 1.1 },
    { x: -52, z: -58, s: 1 },
    { x: -86, z: -54, s: 0.9 },
    { x: -56, z: 52, s: 1 },
    { x: -90, z: 46, s: 1.1 },
    { x: 60, z: 50, s: 1 },
  ]
  furniture(ctx, blocks, [{ geo: ctx.B(22, 26, 18), mat: bld, x: 0, y: 13, z: 0 }])
  for (const b of blocks) ctx.check('edificio', b.x, b.z, 14 * (b.s ?? 1))

  // ninots: figuras de cartón sobre un pedestal
  const ninots: Spot[] = [
    { x: 38, z: -36, ry: 0.4 },
    { x: -38, z: 38, ry: -0.5 },
    { x: -40, z: -38, ry: 0.9 },
    { x: 40, z: 38, ry: 2.6 },
  ]
  const body = [0xff3d8b, 0x3a7fd9, 0xffe14d, 0x2fbf8f]
  furniture(ctx, ninots, [
    { geo: ctx.B(13, 3, 13), mat: ctx.mat(0x6b4a2c, { roughness: 0.7 }), x: 0, y: 1.5, z: 0 },
    {
      geo: ctx.B(7, 9, 5),
      mat: ctx.mat(0xffffff, { roughness: 0.6 }),
      x: 0,
      y: 7.5,
      z: 0,
      colors: body,
    },
    {
      geo: ctx.sphere(3.4, 10, 8),
      mat: ctx.mat(0xf4c9a0, { roughness: 0.6 }),
      x: 0,
      y: 14.6,
      z: 0,
    },
    {
      geo: ctx.cyl(0, 3.8, 5, 8),
      mat: ctx.mat(0xffffff, { roughness: 0.6 }),
      x: 0,
      y: 19.6,
      z: 0,
      colors: [0xffe14d, 0xff3d8b, 0x3a7fd9, 0xff8a1a],
    },
    {
      geo: ctx.B(3, 8, 3),
      mat: ctx.mat(0xf4c9a0, { roughness: 0.6 }),
      x: -5.4,
      y: 8,
      z: 0,
      rz: 0.4,
    },
    {
      geo: ctx.B(3, 8, 3),
      mat: ctx.mat(0xf4c9a0, { roughness: 0.6 }),
      x: 5.4,
      y: 8,
      z: 0,
      rz: -0.4,
    },
  ])
  for (const n of ninots) ctx.check('ninot', n.x, n.z, 8)

  // postes de las guirnaldas y faroles
  const poles: Spot[] = [
    { x: -70, z: -29 },
    { x: -70, z: 29 },
    { x: -45, z: -29 },
    { x: -45, z: 29 },
    { x: 45, z: -29 },
    { x: 45, z: 29 },
    { x: 70, z: -29 },
    { x: 70, z: 29 },
    { x: -29, z: -50 },
    { x: 29, z: -50 },
    { x: -29, z: 40 },
    { x: 29, z: 40 },
  ]
  furniture(ctx, poles, [
    {
      geo: ctx.cyl(0.45, 0.6, 24, 6),
      mat: ctx.mat(0x3a3f55, { metalness: 0.5, roughness: 0.5 }),
      x: 0,
      y: 12,
      z: 0,
    },
  ])
  for (const p of poles) ctx.check('poste', p.x, p.z, 1)
  const pairs: [number, number][] = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [8, 9],
    [10, 11],
  ]
  const bulbs: Spot[] = []
  const flags: Spot[] = []
  const wire = new THREE.LineBasicMaterial({ color: 0x7c86b8 })
  for (const [i, j] of pairs) {
    const a = poles[i]!
    const b = poles[j]!
    const pts: THREE.Vector3[] = []
    const n = 26
    for (let k = 0; k <= n; k++) {
      const t = k / n
      const x = a.x + (b.x - a.x) * t
      const z = a.z + (b.z - a.z) * t
      const y = 23.5 - Math.sin(t * Math.PI) * 4.2
      pts.push(new THREE.Vector3(x, y, z))
      if (k > 0 && k < n) {
        if (k % 2) bulbs.push({ x, y: y - 0.6, z })
        else flags.push({ x, y: y - 1.2, z, ry: Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2 })
      }
    }
    ctx.root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wire))
  }
  furniture(ctx, bulbs, [
    {
      geo: ctx.sphere(0.6, 6, 4),
      mat: ctx.basic(0xffffff),
      x: 0,
      y: 0,
      z: 0,
      cast: false,
      colors: [0xffe14d, 0xff3d8b, 0x7ef0ff, 0xffb066],
    },
  ])
  furniture(ctx, flags, [
    {
      geo: ctx.cyl(0, 1.2, 2.6, 3),
      mat: ctx.basic(0xffffff, { side: THREE.DoubleSide }),
      x: 0,
      y: 0,
      z: 0,
      rz: Math.PI,
      cast: false,
      colors: [0xff3d8b, 0xffe14d, 0x3a7fd9, 0x2fbf8f, 0xff8a1a],
    },
  ])

  // faroles de papel sobre postes bajos
  const lanterns: Spot[] = []
  for (const [x, z] of [
    [-92, -34],
    [-92, 34],
    [96, -34],
    [96, 34],
    [0, -84],
    [0, 76],
    [-8, 0],
    [8, 0],
  ] as const)
    lanterns.push({ x, z })
  furniture(ctx, lanterns, [
    { geo: ctx.cyl(0.3, 0.3, 10, 5), mat: ctx.mat(0x3a3f55), x: 0, y: 5, z: 0 },
    {
      geo: ctx.sphere(2.2, 8, 6),
      mat: ctx.basic(0xffffff),
      x: 0,
      y: 11,
      z: 0,
      sy: 1.25,
      cast: false,
      colors: [0xff5a5a, 0xffb347, 0xff5a9a, 0xffe14d],
    },
  ])
  for (const l of lanterns) ctx.check('farol', l.x, l.z, 2.5)
}
