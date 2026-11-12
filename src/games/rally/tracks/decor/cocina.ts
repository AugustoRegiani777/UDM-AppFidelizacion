// Rally de Cocina: el decorado de "La Cocina" (la pista original): cuarto, mesada, mesa grande, juguetes.
// Es el de la demo del dueño, movido acá sin cambios de aspecto.
import * as THREE from 'three'
import { ROOM, rand } from '../../data.ts'
import type { DecorCtx, Draw } from './builder.ts'

function drawTiles(g: CanvasRenderingContext2D, w: number, h: number) {
  const s = w / 2
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#efe3cb' : '#bcd4dc'
      g.fillRect(i * s, j * s, s, s)
    }
  for (let k = 0; k < 1800; k++) {
    g.fillStyle = `rgba(60,40,20,${Math.random() * 0.05})`
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2)
  }
  g.strokeStyle = 'rgba(120,104,86,.6)'
  g.lineWidth = 3
  for (let i = 0; i <= 2; i++) {
    g.beginPath()
    g.moveTo(i * s, 0)
    g.lineTo(i * s, h)
    g.stroke()
    g.beginPath()
    g.moveTo(0, i * s)
    g.lineTo(w, i * s)
    g.stroke()
  }
}
function drawCabinet(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#d6a26a'
  g.fillRect(0, 0, w, h)
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(120,70,30,${rand(0.06, 0.18)})`
    g.lineWidth = rand(1, 2.5)
    const x = rand(0, w)
    g.beginPath()
    g.moveTo(x, 0)
    g.bezierCurveTo(x + rand(-8, 8), h * 0.3, x + rand(-8, 8), h * 0.7, x + rand(-5, 5), h)
    g.stroke()
  }
  g.strokeStyle = 'rgba(80,45,18,.6)'
  g.lineWidth = 5
  g.strokeRect(5, 6, w - 10, h - 12)
  g.strokeStyle = 'rgba(255,240,215,.35)'
  g.lineWidth = 3
  g.strokeRect(16, 18, w - 32, h - 36)
  g.fillStyle = '#eef0f3'
  g.fillRect(w - 28, 24, 7, 38)
  g.fillStyle = 'rgba(0,0,0,.25)'
  g.fillRect(w - 21, 24, 2, 38)
}
function drawOven(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#c7ccd2'
  g.fillRect(0, 0, w, h)
  g.fillStyle = '#2a2e35'
  g.fillRect(0, 0, w, 26)
  for (let i = 0; i < 4; i++) {
    g.fillStyle = '#e9ecef'
    g.beginPath()
    g.arc(18 + i * 30, 13, 7, 0, 7)
    g.fill()
    g.fillStyle = '#555'
    g.fillRect(17 + i * 30, 6, 2, 7)
  }
  g.fillStyle = '#e3e6ea'
  g.fillRect(12, 34, w - 24, 8)
  const gr = g.createLinearGradient(0, 50, 0, h - 14)
  gr.addColorStop(0, '#1c1f26')
  gr.addColorStop(1, '#3a2a22')
  g.fillStyle = gr
  g.fillRect(14, 52, w - 28, h - 70)
  g.fillStyle = 'rgba(255,150,60,.25)'
  g.fillRect(20, h - 40, w - 40, 14)
}
function drawSplash(g: CanvasRenderingContext2D, w: number) {
  g.fillStyle = '#cfd9d6'
  g.fillRect(0, 0, w, w)
  const s = w / 4
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++) {
      g.fillStyle = (i + j) % 5 === 0 ? '#e8a84c' : '#f8f9f6'
      g.fillRect(i * s + 2, j * s + 2, s - 4, s - 4)
    }
}
function drawSky(g: CanvasRenderingContext2D, w: number, h: number) {
  const gr = g.createLinearGradient(0, 0, 0, h)
  gr.addColorStop(0, '#8fc9ff')
  gr.addColorStop(1, '#e6f5ff')
  g.fillStyle = gr
  g.fillRect(0, 0, w, h)
  g.fillStyle = 'rgba(255,255,255,.9)'
  for (const [x, y, r] of [
    [60, 50, 18],
    [82, 44, 22],
    [104, 52, 16],
    [190, 80, 14],
    [208, 74, 18],
    [226, 82, 13],
  ] as const) {
    g.beginPath()
    g.arc(x, y, r, 0, 7)
    g.fill()
  }
  g.fillStyle = '#7fb069'
  g.fillRect(0, h - 28, w, 28)
  g.fillStyle = '#5d8f4f'
  for (let i = 0; i < 8; i++) {
    g.beginPath()
    g.arc(i * 40 + 10, h - 26, 18, Math.PI, 0)
    g.fill()
  }
}
function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2
    const rr = i % 2 ? r * 0.45 : r
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  g.closePath()
  g.fill()
}
function drawCereal(g: CanvasRenderingContext2D, w: number, h: number) {
  const gr = g.createLinearGradient(0, 0, 0, h)
  gr.addColorStop(0, '#ffd23f')
  gr.addColorStop(1, '#ff7a1a')
  g.fillStyle = gr
  g.fillRect(0, 0, w, h)
  g.fillStyle = '#ffffff'
  g.fillRect(8, 10, w - 16, 58)
  g.fillStyle = '#7a2e12'
  g.textAlign = 'center'
  g.font = '900 26px "Arial Black",Arial,sans-serif'
  g.fillText('CHOCO', w / 2, 40)
  g.font = '900 15px "Arial Black",Arial,sans-serif'
  g.fillText('ESTRELLAS', w / 2, 60)
  g.fillStyle = '#f4f1ea'
  g.beginPath()
  g.ellipse(w / 2, h - 48, 44, 22, 0, 0, 7)
  g.fill()
  g.fillStyle = '#7a3b16'
  for (let i = 0; i < 14; i++) star(g, w / 2 + rand(-32, 32), h - 56 + rand(-10, 8), rand(4, 7))
  g.fillStyle = '#ff4a3d'
  g.font = '700 11px Arial'
  g.fillText('¡CON SORPRESA!', w / 2, h - 12)
}
const drawBlock =
  (letter: string, bg: string): Draw =>
  (g, w, h) => {
    g.fillStyle = bg
    g.fillRect(0, 0, w, h)
    g.strokeStyle = 'rgba(255,255,255,.7)'
    g.lineWidth = 6
    g.strokeRect(6, 6, w - 12, h - 12)
    g.fillStyle = '#fff'
    g.font = '900 40px "Arial Black",Arial'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(letter, w / 2, h / 2 + 2)
  }
function drawBall(g: CanvasRenderingContext2D, w: number, h: number) {
  const cols = ['#ff4a3d', '#ffffff', '#2f6df0', '#ffd23f', '#ffffff', '#46c24c']
  const s = w / cols.length
  cols.forEach((c, i) => {
    g.fillStyle = c
    g.fillRect(i * s, 0, s + 1, h)
  })
}
function drawRug(g: CanvasRenderingContext2D, w: number, h: number) {
  const cols = ['#c2453b', '#f1e4c8', '#2f5d8a', '#f1e4c8']
  const s = h / 12
  for (let i = 0; i < 12; i++) {
    g.fillStyle = cols[i % 4]!
    g.fillRect(0, i * s, w, s + 1)
  }
}

export function buildCocina(ctx: DecorCtx) {
  const Wd = ROOM.x1 - ROOM.x0
  const D = ROOM.z1 - ROOM.z0
  const Ht = ROOM.h
  const cx = (ROOM.x0 + ROOM.x1) / 2
  const cz = (ROOM.z0 + ROOM.z1) / 2
  ctx.add(
    new THREE.PlaneGeometry(Wd, D),
    new THREE.MeshStandardMaterial({
      map: ctx.tex(256, 256, drawTiles, { repeat: [Wd / 16, D / 16] }),
      roughness: 0.7,
    }),
    cx,
    0,
    cz,
    { rx: -Math.PI / 2, cast: false },
  )
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xbfd9d0, roughness: 0.95 })
  ctx.add(new THREE.PlaneGeometry(Wd, Ht), wallMat, cx, Ht / 2, ROOM.z0, { cast: false })
  ctx.add(new THREE.PlaneGeometry(Wd, Ht), wallMat, cx, Ht / 2, ROOM.z1, {
    ry: Math.PI,
    cast: false,
  })
  ctx.add(new THREE.PlaneGeometry(D, Ht), wallMat, ROOM.x0, Ht / 2, cz, {
    ry: Math.PI / 2,
    cast: false,
  })
  ctx.add(new THREE.PlaneGeometry(D, Ht), wallMat, ROOM.x1, Ht / 2, cz, {
    ry: -Math.PI / 2,
    cast: false,
  })
  ctx.add(new THREE.PlaneGeometry(Wd, D), ctx.mat(0xf4f1ea, { roughness: 1 }), cx, Ht, cz, {
    rx: Math.PI / 2,
    cast: false,
  })
  const bb = ctx.mat(0xf6f3ec, { roughness: 0.6 })
  ctx.add(ctx.B(Wd, 1.6, 0.6), bb, cx, 0.8, ROOM.z0 + 0.3)
  ctx.add(ctx.B(Wd, 1.6, 0.6), bb, cx, 0.8, ROOM.z1 - 0.3)
  ctx.add(ctx.B(0.6, 1.6, D), bb, ROOM.x0 + 0.3, 0.8, cz)
  ctx.add(ctx.B(0.6, 1.6, D), bb, ROOM.x1 - 0.3, 0.8, cz)

  // mesadas contra las paredes norte y este
  const wood = ctx.mat(0xd29a63, { roughness: 0.7 })
  const front = new THREE.MeshStandardMaterial({
    map: ctx.tex(128, 200, drawCabinet, { wrap: false }),
    roughness: 0.65,
  })
  const oven = new THREE.MeshStandardMaterial({
    map: ctx.tex(128, 200, drawOven, { wrap: false }),
    roughness: 0.35,
    metalness: 0.2,
  })
  const top = ctx.mat(0xe9e6df, { roughness: 0.35 })
  const CH = 17
  const CD = 12
  for (let k = 0; k < 19; k++) {
    const x = -88 + 5 + k * 10
    ctx.add(
      ...ctx.faces(10, CH, CD, [wood, wood, wood, wood, k === 11 ? oven : front, wood]),
      x,
      CH / 2,
      ROOM.z0 + CD / 2,
    )
  }
  ctx.add(ctx.B(192, 1.4, CD + 0.8), top, -88 + 95, CH + 0.7, ROOM.z0 + CD / 2 + 0.4)
  for (let k = 0; k < 13; k++) {
    const z = -76 + 5 + k * 10
    ctx.add(
      ...ctx.faces(CD, CH, 10, [wood, front, wood, wood, wood, wood]),
      ROOM.x1 - CD / 2,
      CH / 2,
      z,
    )
  }
  ctx.add(ctx.B(CD + 0.8, 1.4, 130), top, ROOM.x1 - CD / 2 - 0.4, CH + 0.7, -76 + 65)
  ctx.add(
    new THREE.PlaneGeometry(190, 13),
    new THREE.MeshStandardMaterial({
      map: ctx.tex(128, 128, (g, w) => drawSplash(g, w), { repeat: [190 / 8, 13 / 8] }),
      roughness: 0.3,
    }),
    -88 + 95,
    CH + 1.4 + 6.5,
    ROOM.z0 + 0.06,
    { cast: false },
  )
  for (let k = 0; k < 14; k++) {
    const x = -48 + 5 + k * 10
    ctx.add(...ctx.faces(10, 14, 8, [wood, wood, wood, wood, front, wood]), x, 39, ROOM.z0 + 4)
  }
  // cosas sobre la mesada
  ctx.add(
    new THREE.CylinderGeometry(2.4, 2.4, 6, 16),
    ctx.mat(0xd94b3b, { roughness: 0.4 }),
    -60,
    CH + 1.4 + 3,
    ROOM.z0 + 6,
  )
  ctx.add(
    ctx.B(9, 5, 6),
    ctx.mat(0xc9ced4, { metalness: 0.5, roughness: 0.3 }),
    70,
    CH + 1.4 + 2.5,
    ROOM.z0 + 6,
  )
  ctx.add(
    new THREE.CylinderGeometry(3, 2.4, 4, 18),
    ctx.mat(0x3d7f6a, { roughness: 0.6 }),
    ROOM.x1 - 6,
    CH + 1.4 + 2,
    20,
  )

  // heladera
  const fr = ctx.mat(0xf2f4f5, { roughness: 0.25, metalness: 0.1 })
  ctx.add(ctx.B(16, 40, 15), fr, ROOM.x0 + 9, 20, ROOM.z0 + 7.5)
  ctx.add(ctx.B(15.6, 0.3, 0.2), ctx.mat(0x9aa0a6), ROOM.x0 + 9, 27, ROOM.z0 + 15.05)
  ctx.add(
    ctx.B(0.8, 8, 0.8),
    ctx.mat(0xb8bdc3, { metalness: 0.6, roughness: 0.3 }),
    ROOM.x0 + 15,
    32,
    ROOM.z0 + 15.4,
  )
  ctx.add(
    ctx.B(0.8, 12, 0.8),
    ctx.mat(0xb8bdc3, { metalness: 0.6, roughness: 0.3 }),
    ROOM.x0 + 15,
    17,
    ROOM.z0 + 15.4,
  )
  ;(
    [
      [0xff4a3d, 4, 34],
      [0x2f6df0, 7, 30],
      [0xffd23f, 10, 35],
      [0x46c24c, 5, 22],
    ] as const
  ).forEach(([c, dx, y]) =>
    ctx.add(ctx.B(1.4, 1.4, 0.4), ctx.mat(c), ROOM.x0 + dx, y, ROOM.z0 + 15.2),
  )

  // ventana y puerta
  const winX = -10
  const winY = 34
  ctx.add(
    new THREE.PlaneGeometry(36, 22),
    new THREE.MeshBasicMaterial({ map: ctx.tex(256, 160, drawSky, { wrap: false }) }),
    winX,
    winY,
    ROOM.z1 - 0.1,
    { ry: Math.PI, cast: false },
  )
  const frame = ctx.mat(0xffffff, { roughness: 0.5 })
  ctx.add(ctx.B(38, 1.2, 1.2), frame, winX, winY + 11.5, ROOM.z1 - 0.6)
  ctx.add(ctx.B(38, 1.2, 1.2), frame, winX, winY - 11.5, ROOM.z1 - 0.6)
  ctx.add(ctx.B(1.2, 24, 1.2), frame, winX - 18.5, winY, ROOM.z1 - 0.6)
  ctx.add(ctx.B(1.2, 24, 1.2), frame, winX + 18.5, winY, ROOM.z1 - 0.6)
  ctx.add(ctx.B(1, 22, 1), frame, winX, winY, ROOM.z1 - 0.6)
  ctx.add(ctx.B(40, 1, 3), frame, winX, winY - 12.4, ROOM.z1 - 1.5)
  ctx.add(
    new THREE.PlaneGeometry(20, 40),
    ctx.mat(0xa86b3c, { roughness: 0.6 }),
    ROOM.x0 + 0.1,
    20,
    40,
    { ry: Math.PI / 2, cast: false },
  )
  ctx.add(
    new THREE.SphereGeometry(0.9, 12, 8),
    ctx.mat(0xd8c07a, { metalness: 0.7, roughness: 0.3 }),
    ROOM.x0 + 0.9,
    19,
    47,
  )
  ctx.add(
    new THREE.PlaneGeometry(10, 18),
    new THREE.MeshStandardMaterial({
      map: ctx.tex(64, 128, drawRug, { wrap: false }),
      roughness: 1,
    }),
    ROOM.x0 + 7,
    0.04,
    40,
    { rx: -Math.PI / 2, cast: false },
  )

  // la mesa grande bajo la que corre la pista
  const tw = ctx.mat(0x9b6236, { roughness: 0.6 })
  const TX = 0,
    TZ = -11,
    TW = 66,
    TD = 38,
    TH = 15
  ctx.add(ctx.B(TW, 1.4, TD), tw, TX, TH, TZ)
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const lx = TX + sx * (TW / 2 - 2.5)
      const lz = TZ + sz * (TD / 2 - 2.5)
      ctx.add(ctx.B(1.8, TH, 1.8), tw, lx, TH / 2, lz)
      ctx.check('pata', lx, lz, 1.3)
    }
  ctx.add(ctx.B(TW - 4, 1.6, 0.8), tw, TX, TH - 1.5, TZ + TD / 2 - 2.5)
  ctx.add(ctx.B(TW - 4, 1.6, 0.8), tw, TX, TH - 1.5, TZ - TD / 2 + 2.5)
  ctx.add(ctx.B(TW - 10, 0.2, 12), ctx.mat(0xd8473d, { roughness: 0.9 }), TX, TH + 0.8, TZ)
  ctx.add(
    new THREE.CylinderGeometry(5, 3.5, 3, 20),
    ctx.mat(0xf4f1ea, { roughness: 0.4 }),
    TX + 8,
    TH + 2.2,
    TZ + 3,
  )

  const chair = (x: number, z: number, ry: number) => {
    const g = new THREE.Group()
    const cw = ctx.mat(0xc9773c, { roughness: 0.6 })
    const parts: [THREE.BufferGeometry, number, number, number][] = [
      [ctx.B(10, 1, 10), 0, 9, 0],
      [ctx.B(1, 9, 1), -4.3, 4.5, -4.3],
      [ctx.B(1, 9, 1), 4.3, 4.5, -4.3],
      [ctx.B(1, 9, 1), -4.3, 4.5, 4.3],
      [ctx.B(1, 9, 1), 4.3, 4.5, 4.3],
      [ctx.B(1, 11, 1), -4.3, 15, 4.3],
      [ctx.B(1, 11, 1), 4.3, 15, 4.3],
      [ctx.B(9.6, 3, 0.8), 0, 18.5, 4.3],
      [ctx.B(9.6, 1.5, 0.8), 0, 13, 4.3],
    ]
    for (const [geo, px, py, pz] of parts) {
      const m = new THREE.Mesh(geo, cw)
      m.position.set(px, py, pz)
      m.castShadow = m.receiveShadow = true
      g.add(m)
    }
    g.position.set(x, 0, z)
    g.rotation.y = ry
    ctx.root.add(g)
    ctx.check('silla', x, z, 7.2)
  }
  chair(-15, 20, 0.1)
  chair(16, 21, -0.15)

  // juguetes y comida en el centro
  ctx.add(
    ctx.B(7, 10, 2.6),
    [
      ctx.mat(0xff8a1a),
      ctx.mat(0xff8a1a),
      ctx.mat(0xffb030),
      ctx.mat(0xff8a1a),
      new THREE.MeshStandardMaterial({
        map: ctx.tex(128, 180, drawCereal, { wrap: false }),
        roughness: 0.7,
      }),
      ctx.mat(0xff8a1a),
    ],
    40,
    5,
    28,
    { ry: -0.4 },
  )
  ctx.check('cereal', 40, 28, 4.5)
  for (let i = 0; i < 14; i++) {
    const x = 40 + rand(-5, 5)
    const z = 33 + rand(-2, 4)
    ctx.add(new THREE.SphereGeometry(0.32, 6, 4), ctx.mat(0x7a3b16), x, 0.3, z)
  }
  const mug = new THREE.Group()
  {
    const m1 = new THREE.Mesh(
      new THREE.CylinderGeometry(2, 1.8, 2.8, 20),
      ctx.mat(0x2f6df0, { roughness: 0.35 }),
    )
    m1.position.y = 1.4
    m1.castShadow = true
    mug.add(m1)
    const hd = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.25, 8, 16, Math.PI),
      ctx.mat(0x2f6df0, { roughness: 0.35 }),
    )
    hd.position.set(2, 1.4, 0)
    hd.rotation.z = -Math.PI / 2
    hd.castShadow = true
    mug.add(hd)
  }
  mug.position.set(-36, 0, 30)
  mug.rotation.y = 0.6
  ctx.root.add(mug)
  ctx.check('taza', -36, 30, 3)
  for (const [x, z] of [
    [20, 32],
    [23.5, 35],
    [-50, 10],
  ] as const) {
    ctx.add(
      new THREE.SphereGeometry(1.5, 14, 10),
      ctx.mat(0xd8282f, { roughness: 0.35 }),
      x,
      1.5,
      z,
    )
    ctx.add(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 5), ctx.mat(0x5a3a1a), x, 3.2, z)
    ctx.check('manzana', x, z, 1.5)
  }
  const blocks = [
    ['A', '#ff4a3d', -20, 36, 0],
    ['B', '#2f6df0', -17.6, 36.4, 0],
    ['C', '#46c24c', -18.9, 36.1, 1],
    ['D', '#ffd23f', -22, 39, 0],
  ] as const
  for (const [l, c, x, z, lvl] of blocks) {
    ctx.add(
      ctx.B(1.6, 1.6, 1.6),
      new THREE.MeshStandardMaterial({
        map: ctx.tex(64, 64, drawBlock(l, c), { wrap: false }),
        roughness: 0.6,
      }),
      x,
      0.8 + lvl * 1.6,
      z,
      { ry: rand(-0.3, 0.3) },
    )
    ctx.check('bloque', x, z, 1.2)
  }
  ;(
    [
      [0xff4a3d, 55, 10, 0.3],
      [0x2f6df0, 57, 13, -0.5],
      [0xffd23f, 60, 9, 1.1],
      [0x46c24c, 56, 16, 0.9],
    ] as const
  ).forEach(([c, x, z, r]) => {
    const g = new THREE.Group()
    const b = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.32, 5, 6),
      ctx.mat(c, { roughness: 0.5 }),
    )
    b.castShadow = true
    g.add(b)
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 6), ctx.mat(c, { roughness: 0.5 }))
    tip.position.y = 2.9
    g.add(tip)
    g.position.set(x, 0.33, z)
    g.rotation.set(0, r, Math.PI / 2)
    ctx.root.add(g)
    ctx.check('crayón', x, z, 3)
  })
  ctx.add(
    new THREE.SphereGeometry(4.5, 20, 14),
    new THREE.MeshStandardMaterial({
      map: ctx.tex(256, 64, drawBall, { wrap: false }),
      roughness: 0.4,
    }),
    -98,
    4.5,
    64,
    { rz: 0.4 },
  )
  ctx.check('pelota', -98, 64, 4.5)
  ctx.add(
    new THREE.CylinderGeometry(4, 5, 2, 22),
    ctx.mat(0xb8bdc3, { metalness: 0.6, roughness: 0.3 }),
    96,
    1,
    70,
  )
  ctx.add(
    new THREE.CylinderGeometry(3.3, 3.3, 0.2, 22),
    ctx.mat(0x8a5a2b, { roughness: 0.9 }),
    96,
    1.9,
    70,
  )
}
