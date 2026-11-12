// Rally de Cocina: piezas compartidas por los decorados: el cuarto (piso, paredes, techo), muebles
// repetidos en una sola llamada de dibujo y texturas dibujadas con canvas.
import * as THREE from 'three'
import { ROOM } from '../../data.ts'
import type { Draw, DecorCtx } from './builder.ts'

/* ============ texturas ============ */
export const css = (n: number) => '#' + n.toString(16).padStart(6, '0')

/** Puntitos al azar sobre toda la textura. */
export function speckle(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  count: number,
  color: (r: number) => string,
  size = 2,
) {
  for (let k = 0; k < count; k++) {
    g.fillStyle = color(Math.random())
    g.fillRect(Math.random() * w, Math.random() * h, size, size)
  }
}

export const drawChecker =
  (c1: string, c2: string, grout: string, cells = 2): Draw =>
  (g, w, h) => {
    const s = w / cells
    for (let i = 0; i < cells; i++)
      for (let j = 0; j < cells; j++) {
        g.fillStyle = (i + j) % 2 ? c1 : c2
        g.fillRect(i * s, j * s, s, s)
      }
    speckle(g, w, h, 1200, (r) => `rgba(60,40,20,${r * 0.05})`)
    g.strokeStyle = grout
    g.lineWidth = 3
    for (let i = 0; i <= cells; i++) {
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

/** Veta de madera horizontal, con tablas. */
export const drawPlanks =
  (base: string, grain: string, boards = 4, vertical = false): Draw =>
  (g, w, h) => {
    g.fillStyle = base
    g.fillRect(0, 0, w, h)
    const bs = (vertical ? w : h) / boards
    for (let i = 0; i < boards; i++) {
      g.fillStyle = `rgba(0,0,0,${0.04 + (i % 3) * 0.03})`
      if (vertical) g.fillRect(i * bs, 0, bs, h)
      else g.fillRect(0, i * bs, w, bs)
    }
    g.strokeStyle = grain
    for (let k = 0; k < 70; k++) {
      g.globalAlpha = 0.1 + Math.random() * 0.14
      g.lineWidth = 1 + Math.random() * 2
      g.beginPath()
      if (vertical) {
        const x = Math.random() * w
        g.moveTo(x, 0)
        g.bezierCurveTo(x + 6, h * 0.3, x - 6, h * 0.7, x + 2, h)
      } else {
        const y = Math.random() * h
        g.moveTo(0, y)
        g.bezierCurveTo(w * 0.3, y + 6, w * 0.7, y - 6, w, y + 2)
      }
      g.stroke()
    }
    g.globalAlpha = 1
    g.strokeStyle = 'rgba(0,0,0,.45)'
    g.lineWidth = 3
    for (let i = 0; i <= boards; i++) {
      g.beginPath()
      if (vertical) {
        g.moveTo(i * bs, 0)
        g.lineTo(i * bs, h)
      } else {
        g.moveTo(0, i * bs)
        g.lineTo(w, i * bs)
      }
      g.stroke()
    }
  }

/** Azulejos de pared (tipo metro). */
export const drawSubway =
  (tile: string, grout: string): Draw =>
  (g, w, h) => {
    g.fillStyle = grout
    g.fillRect(0, 0, w, h)
    const th = h / 6
    const tw = w / 3
    for (let j = 0; j < 6; j++)
      for (let i = -1; i < 3; i++) {
        g.fillStyle = tile
        g.fillRect(i * tw + (j % 2 ? tw / 2 : 0) + 2, j * th + 2, tw - 4, th - 4)
      }
  }

/** Cartel de bolsa de harina. */
export const drawBag =
  (paper: string, ink: string, line1: string, line2: string): Draw =>
  (g, w, h) => {
    g.fillStyle = paper
    g.fillRect(0, 0, w, h)
    g.fillStyle = 'rgba(0,0,0,.08)'
    g.fillRect(0, 0, 6, h)
    g.fillRect(w - 6, 0, 6, h)
    g.fillStyle = ink
    g.fillRect(10, h * 0.2, w - 20, 5)
    g.fillRect(10, h * 0.62, w - 20, 5)
    g.textAlign = 'center'
    g.font = '900 24px "Arial Black",Arial'
    g.fillText(line1, w / 2, h * 0.46)
    g.font = '700 13px Arial'
    g.fillText(line2, w / 2, h * 0.78)
  }

/* ============ el cuarto ============ */
export interface ShellOpts {
  floor: Draw
  /** Lado de una baldosa del piso, en metros del mundo. */
  floorTile?: number
  floorRough?: number
  floorMetal?: number
  wallColor: number
  /** Textura de pared (si falta, color liso). */
  wall?: Draw
  wallTile?: number
  wallRough?: number
  /** Color del techo; `false` = sin techo (cielo). */
  ceiling: number | false
  baseboard?: number | false
}

/** Piso, cuatro paredes, techo y zócalo. */
export function shell(ctx: DecorCtx, o: ShellOpts) {
  const Wd = ROOM.x1 - ROOM.x0
  const D = ROOM.z1 - ROOM.z0
  const Ht = ROOM.h
  const cx = (ROOM.x0 + ROOM.x1) / 2
  const cz = (ROOM.z0 + ROOM.z1) / 2
  const ft = o.floorTile ?? 16
  ctx.add(
    new THREE.PlaneGeometry(Wd, D),
    ctx.texMat(
      256,
      256,
      o.floor,
      { roughness: o.floorRough ?? 0.7, metalness: o.floorMetal ?? 0 },
      { repeat: [Wd / ft, D / ft] },
    ),
    cx,
    0,
    cz,
    { rx: -Math.PI / 2, cast: false },
  )
  const wt = o.wallTile ?? 24
  const wallMat = (len: number) =>
    o.wall
      ? ctx.texMat(
          128,
          128,
          o.wall,
          { roughness: o.wallRough ?? 0.95 },
          { repeat: [len / wt, Ht / wt] },
        )
      : ctx.mat(o.wallColor, { roughness: o.wallRough ?? 0.95 })
  const mz = wallMat(Wd)
  const mx = wallMat(D)
  ctx.add(new THREE.PlaneGeometry(Wd, Ht), mz, cx, Ht / 2, ROOM.z0, { cast: false })
  ctx.add(new THREE.PlaneGeometry(Wd, Ht), mz, cx, Ht / 2, ROOM.z1, { ry: Math.PI, cast: false })
  ctx.add(new THREE.PlaneGeometry(D, Ht), mx, ROOM.x0, Ht / 2, cz, { ry: Math.PI / 2, cast: false })
  ctx.add(new THREE.PlaneGeometry(D, Ht), mx, ROOM.x1, Ht / 2, cz, {
    ry: -Math.PI / 2,
    cast: false,
  })
  if (o.ceiling !== false)
    ctx.add(new THREE.PlaneGeometry(Wd, D), ctx.mat(o.ceiling, { roughness: 1 }), cx, Ht, cz, {
      rx: Math.PI / 2,
      cast: false,
    })
  if (o.baseboard !== false) {
    const bb = ctx.mat(o.baseboard ?? 0xf6f3ec, { roughness: 0.6 })
    ctx.add(ctx.B(Wd, 1.6, 0.6), bb, cx, 0.8, ROOM.z0 + 0.3)
    ctx.add(ctx.B(Wd, 1.6, 0.6), bb, cx, 0.8, ROOM.z1 - 0.3)
    ctx.add(ctx.B(0.6, 1.6, D), bb, ROOM.x0 + 0.3, 0.8, cz)
    ctx.add(ctx.B(0.6, 1.6, D), bb, ROOM.x1 - 0.3, 0.8, cz)
  }
}

/* ============ muebles repetidos ============ */
export interface Spot {
  x: number
  z: number
  /** Altura de apoyo (por defecto 0). */
  y?: number
  /** Giro alrededor de la vertical. */
  ry?: number
  /** Escala uniforme. */
  s?: number
}

export interface Part {
  geo: THREE.BufferGeometry
  mat: THREE.Material
  x: number
  y: number
  z: number
  rx?: number
  ry?: number
  rz?: number
  /** Escala local por eje. */
  sx?: number
  sy?: number
  sz?: number
  /** Colores por copia (se reparten en orden). */
  colors?: number[]
  cast?: boolean
}

const mf = new THREE.Matrix4()
const mt = new THREE.Matrix4()
const mr = new THREE.Matrix4()
const ms = new THREE.Matrix4()
const eul = new THREE.Euler()

/** Pone cada pieza en todos los lugares: una sola llamada de dibujo por pieza. */
export function furniture(ctx: DecorCtx, spots: Spot[], parts: Part[]) {
  for (const p of parts) {
    const mats: THREE.Matrix4[] = []
    for (const s of spots) {
      const k = s.s ?? 1
      // matriz del mueble: trasladar · girar · escalar
      mf.makeTranslation(s.x, s.y ?? 0, s.z)
      mf.multiply(mr.makeRotationY(s.ry ?? 0))
      mf.multiply(ms.makeScale(k, k, k))
      // pieza local: trasladar · girar · escalar
      mt.makeTranslation(p.x, p.y, p.z)
      eul.set(p.rx ?? 0, p.ry ?? 0, p.rz ?? 0)
      mr.makeRotationFromEuler(eul)
      ms.makeScale(p.sx ?? 1, p.sy ?? 1, p.sz ?? 1)
      mats.push(new THREE.Matrix4().multiplyMatrices(mf, mt).multiply(mr).multiply(ms))
    }
    ctx.instancedM(p.geo, p.mat, mats, p.colors, { cast: p.cast ?? true })
  }
}
