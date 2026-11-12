// Rally de Cocina: las mallas de la pista en sí (asfalto, costados, cordones, arco de largada, rampas y
// zonas especiales). Son iguales para todas las pistas: cambian los colores (`ThemeStyle`) y la altura.
import * as THREE from 'three'
import type { DecorCtx } from './builder.ts'
import type { ThemeStyle } from './style.ts'

function drawRoad(style: ThemeStyle) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    g.fillStyle = style.road.base
    g.fillRect(0, 0, w, h)
    const [r, gg, b] = style.road.speck
    for (let k = 0; k < 2600; k++) {
      const v = Math.random() * 50
      g.fillStyle = `rgba(${r + v},${gg + v},${b + v},.5)`
      g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5)
    }
    g.fillStyle = style.road.edge
    g.fillRect(5, 0, 6, h)
    g.fillRect(w - 11, 0, 6, h)
    g.fillStyle = style.road.center
    g.fillRect(w / 2 - 2, 0, 4, h * 0.45)
  }
}

function drawBanner(g: CanvasRenderingContext2D, w: number, h: number) {
  const s = 16
  for (let i = 0; i < 6; i++)
    for (let j = 0; j < 4; j++) {
      g.fillStyle = (i + j) % 2 ? '#111' : '#f5f5f5'
      g.fillRect(i * s, j * s, s, s)
      g.fillRect(w - (i + 1) * s, j * s, s, s)
    }
  g.fillStyle = '#ff4a3d'
  g.fillRect(96, 0, w - 192, h)
  g.fillStyle = '#fff'
  g.font = '900 40px "Arial Black",Arial'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('META', w / 2, h / 2 + 2)
}

function drawChecker(g: CanvasRenderingContext2D, w: number, h: number) {
  const s = 16
  for (let i = 0; i < w / s; i++)
    for (let j = 0; j < h / s; j++) {
      g.fillStyle = (i + j) % 2 ? '#111' : '#f5f5f5'
      g.fillRect(i * s, j * s, s, s)
    }
}

const drawZone =
  (base: number, accent: string, slick: boolean) =>
  (g: CanvasRenderingContext2D, w: number, h: number) => {
    g.fillStyle = '#' + base.toString(16).padStart(6, '0')
    g.fillRect(0, 0, w, h)
    if (slick) {
      g.strokeStyle = accent
      g.lineWidth = 3
      g.globalAlpha = 0.55
      for (let k = 0; k < 7; k++) {
        g.beginPath()
        g.arc(Math.random() * w, Math.random() * h, 8 + Math.random() * 22, 0, 4.2)
        g.stroke()
      }
      g.globalAlpha = 1
    } else {
      g.fillStyle = accent
      for (let k = 0; k < 420; k++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2)
    }
  }

/** Una tira a lo largo del eje entre dos distancias laterales, pegada al asfalto. */
function stripGeometry(
  ctx: DecorCtx,
  i0: number,
  count: number,
  lat0: number,
  lat1: number,
  lift: number,
  uvScale: number,
): THREE.BufferGeometry {
  const { TP, NRM, Y, n } = ctx.rt
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let k = 0; k <= count; k++) {
    const i = (i0 + k) % n
    const p = TP[i]!
    const nr = NRM[i]!
    pos.push(
      p.x + nr.x * lat1,
      Y[i]! + lift,
      p.z + nr.z * lat1,
      p.x + nr.x * lat0,
      Y[i]! + lift,
      p.z + nr.z * lat0,
    )
    uv.push(0, k * uvScale, 1, k * uvScale)
  }
  for (let k = 0; k < count; k++) {
    const a = k * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

function buildRoad(ctx: DecorCtx, style: ThemeStyle) {
  const { n, TP, NRM, DIST, Y, len, hw } = ctx.rt
  const reps = Math.max(1, Math.round(len / 9))
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= n; i++) {
    const k = i % n
    const p = TP[k]!
    const nr = NRM[k]!
    const v = ((i === n ? len : DIST[k]!) / len) * reps
    pos.push(
      p.x + nr.x * hw,
      Y[k]! + 0.03,
      p.z + nr.z * hw,
      p.x - nr.x * hw,
      Y[k]! + 0.03,
      p.z - nr.z * hw,
    )
    uv.push(0, v, 1, v)
  }
  for (let i = 0; i < n; i++) {
    const a = i * 2
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  const material = ctx.texMat(128, 256, drawRoad(style), {
    roughness: 0.92,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    ...(style.road.glow ? { emissive: style.road.glow, emissiveIntensity: 1 } : {}),
  })
  const mesh = new THREE.Mesh(geo, material)
  mesh.receiveShadow = true
  ctx.root.add(mesh)
}

/** Si la pista está elevada, los costados bajan hasta el piso (una "ladera" que tapa el vacío). */
function buildSkirt(ctx: DecorCtx, style: ThemeStyle) {
  const { n, TP, NRM, Y, hw } = ctx.rt
  const mat = ctx.mat(style.skirt, { roughness: 0.95, side: THREE.DoubleSide })
  for (const side of [1, -1]) {
    const pos: number[] = []
    const idx: number[] = []
    for (let i = 0; i <= n; i++) {
      const k = i % n
      const p = TP[k]!
      const nr = NRM[k]!
      const x = p.x + nr.x * hw * side
      const z = p.z + nr.z * hw * side
      pos.push(x, Y[k]! + 0.03, z, x, -0.02, z)
    }
    for (let i = 0; i < n; i++) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    const m = new THREE.Mesh(geo, mat)
    m.receiveShadow = true
    ctx.root.add(m)
  }
}

function buildCurbs(ctx: DecorCtx, style: ThemeStyle) {
  const { n, TP, NRM, Y, hw } = ctx.rt
  const step = 3
  const items: {
    x: number
    y: number
    z: number
    len: number
    rot: number
    pitch: number
    c: number
  }[] = []
  for (const side of [1, -1])
    for (let i = 0; i < n; i += step) {
      const j = (i + step) % n
      const a = TP[i]!
      const b = TP[j]!
      const na = NRM[i]!
      const nb = NRM[j]!
      const off = hw + 0.35
      const ax = a.x + na.x * off * side
      const az = a.z + na.z * off * side
      const bx = b.x + nb.x * off * side
      const bz = b.z + nb.z * off * side
      const run = Math.hypot(bx - ax, bz - az)
      items.push({
        x: (ax + bx) / 2,
        y: (Y[i]! + Y[j]!) / 2 + 0.35,
        z: (az + bz) / 2,
        len: run + 0.06,
        rot: Math.atan2(bx - ax, bz - az),
        pitch: Math.atan2(Y[j]! - Y[i]!, run),
        c: ((i / step) | 0) % 2,
      })
    }
  const im = new THREE.InstancedMesh(
    ctx.B(0.7, 0.7, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.5 }),
    items.length,
  )
  const d = new THREE.Object3D()
  d.rotation.order = 'YXZ'
  const cA = new THREE.Color(style.curbs[0])
  const cB = new THREE.Color(style.curbs[1])
  items.forEach((it, k) => {
    d.position.set(it.x, it.y, it.z)
    d.rotation.set(-it.pitch, it.rot, 0)
    d.scale.set(1, 1, it.len)
    d.updateMatrix()
    im.setMatrixAt(k, d.matrix)
    im.setColorAt(k, it.c ? cA : cB)
  })
  im.castShadow = true
  im.receiveShadow = true
  im.frustumCulled = false
  ctx.root.add(im)
}

function buildStartGate(ctx: DecorCtx, style: ThemeStyle) {
  const { TP, NRM, Y, hw } = ctx.rt
  const p = TP[0]!
  const n = NRM[0]!
  const y0 = Y[0]!
  const off = hw + 2.2
  const phi = Math.atan2(-n.z, n.x)
  for (const s of [1, -1]) {
    const x = p.x + n.x * off * s
    const z = p.z + n.z * off * s
    ctx.add(
      ctx.cyl(0.9, 0.9, 12, 6),
      ctx.mat(s > 0 ? style.gate.poleA : style.gate.poleB, { roughness: 0.5 }),
      x,
      y0 + 6,
      z,
    )
    ctx.add(
      ctx.cyl(0.95, 0.95, 0.5, 12),
      ctx.mat(style.gate.cap, { metalness: 0.7, roughness: 0.3 }),
      x,
      y0 + 12.2,
      z,
    )
    ctx.add(
      ctx.cyl(0.92, 0.92, 1.3, 12),
      ctx.mat(style.gate.top, { roughness: 0.8 }),
      x,
      y0 + 13.1,
      z,
    )
  }
  ctx.add(
    new THREE.PlaneGeometry(off * 2, 2.6),
    ctx.texMat(512, 64, drawBanner, { side: THREE.DoubleSide }, { wrap: false }),
    p.x,
    y0 + 10.6,
    p.z,
    { ry: phi + Math.PI },
  )
  ctx.add(
    new THREE.PlaneGeometry(hw * 2, 1.6),
    ctx.texMat(
      160,
      32,
      drawChecker,
      { roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -3 },
      { wrap: false },
    ),
    p.x,
    y0 + 0.05,
    p.z,
    { rx: -Math.PI / 2, ry: phi, order: 'YXZ', cast: false },
  )
}

function buildRamps(ctx: DecorCtx) {
  const { TAN, SLOPE, Y } = ctx.rt
  for (const r of ctx.rt.ramps) {
    const t = TAN[r.idx]!
    const sh = new THREE.Shape()
    sh.moveTo(0, 0)
    sh.lineTo(r.len, 0)
    sh.lineTo(r.len, r.h)
    sh.closePath()
    const geo = new THREE.ExtrudeGeometry(sh, { depth: r.w, bevelEnabled: false })
    geo.translate(-r.len / 2, 0, -r.w / 2)
    // El libro apoya sobre el asfalto: si la pista tiene pendiente, se inclina con ella.
    const g = ctx.group(r.x, Y[r.idx]! + 0.02, r.z, Math.atan2(-t.z, t.x))
    const body = ctx.part(g, geo, ctx.mat(0xf1e6cc, { roughness: 0.9 }), 0, 0, 0, {
      rz: Math.atan(SLOPE[r.idx]!),
    })
    body.material = [ctx.mat(0xf1e6cc, { roughness: 0.9 }), ctx.mat(r.color, { roughness: 0.55 })]
    const stripe = new THREE.Mesh(ctx.B(r.len * 1.01, 0.05, 0.5), ctx.mat(0xffd23f))
    stripe.position.set(0, r.h / 2, 0)
    stripe.rotation.z = Math.atan2(r.h, r.len)
    body.add(stripe)
  }
}

function buildZones(ctx: DecorCtx, style: ThemeStyle) {
  const { zones, len, n } = ctx.rt
  const spacing = len / n
  for (const zn of zones) {
    const slick = zn.kind === 'slick'
    const look = slick ? style.slick : style.sand
    const geo = stripGeometry(
      ctx,
      zn.i0,
      zn.count,
      zn.lat0,
      zn.lat1,
      0.07,
      spacing / (zn.lat1 - zn.lat0),
    )
    const material = ctx.texMat(
      128,
      128,
      drawZone(look.color, look.accent, slick),
      {
        roughness: slick ? 0.12 : 1,
        metalness: slick ? 0.25 : 0,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      },
      { wrap: true },
    )
    const m = new THREE.Mesh(geo, material)
    m.receiveShadow = true
    ctx.root.add(m)
  }
}

/** Todo lo que se ve de la pista misma. */
export function buildTrackMeshes(ctx: DecorCtx, style: ThemeStyle) {
  buildRoad(ctx, style)
  if (ctx.rt.maxY > 0.2) buildSkirt(ctx, style)
  buildCurbs(ctx, style)
  buildStartGate(ctx, style)
  buildRamps(ctx)
  buildZones(ctx, style)
}
