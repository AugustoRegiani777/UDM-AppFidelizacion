// Rally de Cocina: herramientas para construir el decorado de una pista. Todo lo que se crea acá cuelga
// de un único `Group` (`root`): al cambiar de pista se libera en un solo paso (`dispose`), sin fugas.
import * as THREE from 'three'
import type { TrackRuntime } from '../runtime.ts'

export type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void

export interface InstanceItem {
  x: number
  y: number
  z: number
  ry?: number
  rx?: number
  rz?: number
  sx?: number
  sy?: number
  sz?: number
  color?: number
}

export interface DecorOptions {
  rt: TrackRuntime
  maxAniso: number
  /** Para los tests: una fábrica de canvas falsos (jsdom no dibuja). */
  makeCanvas?: () => HTMLCanvasElement
}

export interface MeshOpts {
  rx?: number
  ry?: number
  rz?: number
  cast?: boolean
  receive?: boolean
  order?: THREE.EulerOrder
}

export interface DecorCtx {
  readonly rt: TrackRuntime
  readonly root: THREE.Group
  readonly warnings: string[]
  /** Azar con semilla (la misma pista se arma siempre igual). */
  readonly rng: () => number
  rand(a: number, b: number): number
  tex(
    w: number,
    h: number,
    draw: Draw,
    opts?: { repeat?: [number, number]; wrap?: boolean },
  ): THREE.CanvasTexture
  mat(color: number, opts?: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial
  /** Material con textura dibujada (no se comparte). */
  texMat(
    w: number,
    h: number,
    draw: Draw,
    opts?: THREE.MeshStandardMaterialParameters,
    texOpts?: { repeat?: [number, number]; wrap?: boolean },
  ): THREE.MeshStandardMaterial
  basic(color: number, opts?: THREE.MeshBasicMaterialParameters): THREE.MeshBasicMaterial
  B(w: number, h: number, d: number): THREE.BoxGeometry
  /** Caja con un material por cara (+x, -x, +y, -y, +z, -z); las caras seguidas con el mismo material se dibujan juntas. */
  faces(
    w: number,
    h: number,
    d: number,
    mats: THREE.Material[],
  ): [THREE.BufferGeometry, THREE.Material[]]
  cyl(rt: number, rb: number, h: number, seg?: number): THREE.CylinderGeometry
  sphere(r: number, ws?: number, hs?: number): THREE.SphereGeometry
  add(
    geo: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    x: number,
    y: number,
    z: number,
    opts?: MeshOpts,
  ): THREE.Mesh
  /** Un grupo para armar un objeto de varias piezas. */
  group(x: number, y: number, z: number, ry?: number): THREE.Group
  /** Pieza dentro de un grupo. */
  part(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    opts?: MeshOpts,
  ): THREE.Mesh
  /** Muchas copias de una geometría en una sola llamada de dibujo. */
  instanced(
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    items: InstanceItem[],
    opts?: { cast?: boolean; receive?: boolean },
  ): THREE.InstancedMesh
  /** Igual que `instanced`, pero con una matriz completa por copia (y color opcional). */
  instancedM(
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    matrices: THREE.Matrix4[],
    colors?: number[],
    opts?: { cast?: boolean; receive?: boolean },
  ): THREE.InstancedMesh
  /** Avisa (en `warnings`) si un objeto de radio `r` pisa la pista. */
  check(name: string, x: number, z: number, r: number): void
  dispose(): void
}

/** Generador con semilla (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export function createDecor(opts: DecorOptions): DecorCtx {
  const { rt, maxAniso } = opts
  const root = new THREE.Group()
  root.name = 'decor:' + rt.id
  const warnings: string[] = []
  const rng = seeded(hashString(rt.id))
  const textures: THREE.Texture[] = []
  const matCache = new Map<string, THREE.Material>()
  const geoCache = new Map<string, THREE.BufferGeometry>()
  const makeCanvas = opts.makeCanvas ?? (() => document.createElement('canvas'))

  function tex(
    w: number,
    h: number,
    draw: Draw,
    { repeat = [1, 1], wrap = true }: { repeat?: [number, number]; wrap?: boolean } = {},
  ) {
    const c = makeCanvas()
    c.width = w
    c.height = h
    const g = c.getContext('2d')
    if (g) draw(g, w, h)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    if (wrap) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(repeat[0], repeat[1])
    }
    t.anisotropy = maxAniso
    textures.push(t)
    return t
  }
  function mat(color: number, o: THREE.MeshStandardMaterialParameters = {}) {
    const k = 'S' + color + JSON.stringify(o)
    let m = matCache.get(k) as THREE.MeshStandardMaterial | undefined
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...o })
      matCache.set(k, m)
    }
    return m
  }
  function basic(color: number, o: THREE.MeshBasicMaterialParameters = {}) {
    const k = 'B' + color + JSON.stringify(o)
    let m = matCache.get(k) as THREE.MeshBasicMaterial | undefined
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, ...o })
      matCache.set(k, m)
    }
    return m
  }
  function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
    let g = geoCache.get(key) as T | undefined
    if (!g) {
      g = make()
      geoCache.set(key, g)
    }
    return g
  }
  const B = (w: number, h: number, d: number) =>
    cached(`B${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d))
  function faces(
    w: number,
    h: number,
    d: number,
    mats: THREE.Material[],
  ): [THREE.BufferGeometry, THREE.Material[]] {
    const unique: THREE.Material[] = []
    const idx = mats.map((m) => {
      let i = unique.indexOf(m)
      if (i < 0) i = unique.push(m) - 1
      return i
    })
    const g = cached(`F${w},${h},${d},${idx.join('')}`, () => {
      const box = new THREE.BoxGeometry(w, h, d)
      box.clearGroups()
      let start = 0
      for (let f = 1; f <= 6; f++) {
        if (f === 6 || idx[f] !== idx[start]) {
          box.addGroup(start * 6, (f - start) * 6, idx[start]!)
          start = f
        }
      }
      return box
    })
    return [g, unique]
  }
  const cyl = (rtop: number, rb: number, h: number, seg = 16) =>
    cached(`C${rtop},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rtop, rb, h, seg))
  const sphere = (r: number, ws = 14, hs = 10) =>
    cached(`S${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs))

  function place(m: THREE.Object3D, x: number, y: number, z: number, o: MeshOpts) {
    if (o.order) m.rotation.order = o.order
    m.position.set(x, y, z)
    m.rotation.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0)
  }
  function add(
    geo: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    x: number,
    y: number,
    z: number,
    o: MeshOpts = {},
  ) {
    const m = new THREE.Mesh(geo, material)
    place(m, x, y, z, o)
    m.castShadow = o.cast ?? true
    m.receiveShadow = o.receive ?? true
    root.add(m)
    return m
  }
  function group(x: number, y: number, z: number, ry = 0) {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    g.rotation.y = ry
    root.add(g)
    return g
  }
  function part(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    o: MeshOpts = {},
  ) {
    const m = new THREE.Mesh(geo, material)
    place(m, x, y, z, o)
    m.castShadow = o.cast ?? true
    m.receiveShadow = o.receive ?? true
    parent.add(m)
    return m
  }
  function instanced(
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    items: InstanceItem[],
    o: { cast?: boolean; receive?: boolean } = {},
  ) {
    const im = new THREE.InstancedMesh(geo, material, Math.max(1, items.length))
    const d = new THREE.Object3D()
    const c = new THREE.Color()
    let colored = false
    items.forEach((it, k) => {
      d.position.set(it.x, it.y, it.z)
      d.rotation.set(it.rx ?? 0, it.ry ?? 0, it.rz ?? 0)
      d.scale.set(it.sx ?? 1, it.sy ?? it.sx ?? 1, it.sz ?? it.sx ?? 1)
      d.updateMatrix()
      im.setMatrixAt(k, d.matrix)
      if (it.color !== undefined) {
        im.setColorAt(k, c.set(it.color))
        colored = true
      }
    })
    if (colored && im.instanceColor) im.instanceColor.needsUpdate = true
    im.count = items.length
    im.castShadow = o.cast ?? false
    im.receiveShadow = o.receive ?? true
    im.frustumCulled = false
    root.add(im)
    return im
  }
  function instancedM(
    geo: THREE.BufferGeometry,
    material: THREE.Material,
    matrices: THREE.Matrix4[],
    colors?: number[],
    o: { cast?: boolean; receive?: boolean } = {},
  ) {
    const im = new THREE.InstancedMesh(geo, material, Math.max(1, matrices.length))
    const c = new THREE.Color()
    matrices.forEach((m, k) => {
      im.setMatrixAt(k, m)
      if (colors) im.setColorAt(k, c.set(colors[k % colors.length]!))
    })
    if (colors && im.instanceColor) im.instanceColor.needsUpdate = true
    im.count = matrices.length
    im.castShadow = o.cast ?? false
    im.receiveShadow = o.receive ?? true
    im.frustumCulled = false
    root.add(im)
    return im
  }
  function check(name: string, x: number, z: number, r: number) {
    const w = rt.chk(name, x, z, r)
    if (w) warnings.push(w)
  }
  function texMat(
    w: number,
    h: number,
    draw: Draw,
    o: THREE.MeshStandardMaterialParameters = {},
    texOpts?: { repeat?: [number, number]; wrap?: boolean },
  ) {
    return new THREE.MeshStandardMaterial({ map: tex(w, h, draw, texOpts), roughness: 0.7, ...o })
  }

  function dispose() {
    // Cada recurso se libera una sola vez (muchas mallas comparten geometría y material).
    const geos = new Set<THREE.BufferGeometry>(geoCache.values())
    const mats = new Set<THREE.Material>(matCache.values())
    const texs = new Set<THREE.Texture>(textures)
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if ((o as THREE.InstancedMesh).isInstancedMesh) (o as THREE.InstancedMesh).dispose()
      if (m.geometry) geos.add(m.geometry)
      for (const mt of m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []) {
        mats.add(mt)
        const std = mt as THREE.MeshStandardMaterial
        if (std.map) texs.add(std.map)
        if (std.emissiveMap) texs.add(std.emissiveMap)
      }
    })
    geos.forEach((g) => g.dispose())
    mats.forEach((m) => m.dispose())
    texs.forEach((tx) => tx.dispose())
    textures.length = 0
    matCache.clear()
    geoCache.clear()
    root.removeFromParent()
    root.clear()
  }

  return {
    rt,
    root,
    warnings,
    rng,
    rand: (a, b) => a + rng() * (b - a),
    tex,
    mat,
    texMat,
    basic,
    B,
    faces,
    cyl,
    sphere,
    add,
    group,
    part,
    instanced,
    instancedM,
    check,
    dispose,
  }
}

/** Un `CanvasRenderingContext2D` que no hace nada: para armar decorados en tests sin canvas real. */
export function noopCanvasFactory(): () => HTMLCanvasElement {
  const grad = { addColorStop() {} }
  const ctx = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => grad
        return () => {}
      },
      set: () => true,
    },
  )
  return () =>
    ({
      width: 0,
      height: 0,
      getContext: () => ctx,
    }) as unknown as HTMLCanvasElement
}

/** Cuántas mallas y llamadas de dibujo cuesta un decorado (una malla con N materiales cuenta N). */
export function drawCost(root: THREE.Object3D): {
  meshes: number
  drawCalls: number
  instances: number
} {
  let meshes = 0
  let drawCalls = 0
  let instances = 0
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    meshes++
    if ((o as THREE.InstancedMesh).isInstancedMesh) instances += (o as THREE.InstancedMesh).count
    if (Array.isArray(m.material)) {
      const mats = m.material
      const groups = m.geometry.groups.filter((g) => mats[g.materialIndex ?? 0])
      drawCalls += groups.length || mats.length
    } else drawCalls++
  })
  return { meshes, drawCalls, instances }
}
