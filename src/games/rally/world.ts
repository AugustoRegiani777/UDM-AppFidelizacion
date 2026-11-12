// Rally de Cocina: el mundo 3D (pista y decorado por ambiente, autos, partículas, cámara). Porte de la demo a three 0.170.
// El decorado de cada pista vive en tracks/decor y se construye y libera entero al cambiar de pista.
import * as THREE from 'three'
import { FLIP_T, PULSE_R, ROOM, clamp, lerp, rand, random, wrapA, type CarDef } from './data.ts'
import type { Quality } from './quality.ts'
import type { Car, Oil, Rocket, RallySim } from './sim.ts'
import { buildDecor, type BuiltDecor } from './tracks/decor/index.ts'
import type { TrackRuntime } from './tracks/runtime.ts'

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void

/* ============ texturas dibujadas ============ */

function drawOil(g: CanvasRenderingContext2D, w: number, h: number) {
  g.clearRect(0, 0, w, h)
  for (let k = 0; k < 8; k++) {
    const r = rand(16, 30)
    const x = w / 2 + rand(-26, 26)
    const y = h / 2 + rand(-26, 26)
    const gr = g.createRadialGradient(x, y, 0, x, y, r)
    gr.addColorStop(0, 'rgba(22,18,30,1)')
    gr.addColorStop(0.82, 'rgba(22,18,30,.96)')
    gr.addColorStop(1, 'rgba(22,18,30,0)')
    g.fillStyle = gr
    g.beginPath()
    g.arc(x, y, r, 0, 7)
    g.fill()
  }
  g.globalCompositeOperation = 'source-atop'
  const s = g.createLinearGradient(0, 0, w, h)
  s.addColorStop(0, 'rgba(130,90,210,.28)')
  s.addColorStop(0.5, 'rgba(60,170,190,.22)')
  s.addColorStop(1, 'rgba(210,120,60,.22)')
  g.fillStyle = s
  g.fillRect(0, 0, w, h)
}
function drawPickup(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#16a3a0'
  g.fillRect(0, 0, w, h)
  g.fillStyle = '#ffd23f'
  g.fillRect(w / 2 - 7, 0, 14, h)
  g.fillRect(0, h / 2 - 7, w, 14)
  g.fillStyle = '#0d1330'
  g.beginPath()
  g.arc(w / 2, h / 2, 17, 0, 7)
  g.fill()
  g.fillStyle = '#fff'
  g.font = '900 28px "Arial Black",Arial'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('?', w / 2, h / 2 + 2)
}

/* ============ modelo de auto ============ */
export interface CarModel {
  root: THREE.Group
  tilt: THREE.Group
  body: THREE.Group
  wheels: THREE.Group[]
  steerPivots: THREE.Group[]
  antPivot: THREE.Group
  flame: THREE.Group
  wheelR: number
  /** Materiales y geometrías propios de este auto (se liberan al sacarlo de la pista). */
  own: { dispose(): void }[]
}

interface Fx {
  mesh: THREE.Mesh
  t: number
  dur: number
  s0: number
  s1: number
  o0: number
  follow?: { x: number; z: number }
}
interface Particle {
  dead: boolean
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  size: number
  life: number
  max: number
  grav: number
  /** Altura del piso donde rebota (el asfalto puede estar elevado). */
  floor: number
}

export interface RallyWorld {
  readonly canvas: HTMLCanvasElement
  readonly warnings: string[]
  /** Id de la pista cuyo decorado está armado. */
  readonly trackId: string
  /** Cambia el decorado (y la luz) a la pista de `rt`; libera el anterior. `sim.setTrack` va antes. */
  setTrack(rt: TrackRuntime): void
  /** Costo del último cuadro dibujado y dónde está la cámara (para pruebas). */
  stats(): { calls: number; triangles: number; camera: [number, number, number] }
  camMode: number
  hooks: {
    emit(
      x: number,
      y: number,
      z: number,
      vx: number,
      vy: number,
      vz: number,
      color: number,
      size: number,
      life: number,
      grav: number,
    ): void
    fx(kind: 'explode' | 'pulse', x: number, y: number, z: number, follow?: Car): void
    onClear(): void
    onCarCreated(car: Car): void
    onRaceStarted(attract: boolean): void
    onRocketSpawn(r: Rocket): void
    onRocketRemove(r: Rocket): void
    onOilSpawn(o: Oil): void
    onOilRemove(o: Oil): void
  }
  update(dt: number): void
  updateCamera(dt: number): void
  render(): void
  resize(w: number, h: number): void
  setPixelRatio(r: number): void
  getPixelRatio(): number
  setShadows(on: boolean): void
  dispose(): void
}

export function createWorld(
  container: HTMLElement,
  sim: RallySim,
  q: Quality,
  camMode0: number,
): RallyWorld {
  const renderer = new THREE.WebGLRenderer({
    antialias: q.antialias,
    powerPreference: 'high-performance',
  })
  let pixelRatio = q.pixelRatio
  renderer.setPixelRatio(pixelRatio)
  let W = Math.max(1, container.clientWidth)
  let H = Math.max(1, container.clientHeight)
  renderer.setSize(W, H, false)
  renderer.shadowMap.enabled = q.shadowSize > 0
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const canvas = renderer.domElement
  canvas.style.display = 'block'
  canvas.style.width = '100%'
  canvas.style.height = '100%'
  container.appendChild(canvas)

  const scene = new THREE.Scene()
  const bg = new THREE.Color(0xd9e7e1)
  const fog = new THREE.Fog(0xd9e7e1, 150, 420)
  scene.background = bg
  scene.fog = fog
  const camera = new THREE.PerspectiveCamera(64, W / H, 0.1, 800)
  camera.position.set(0, 30, 90)

  const hemi = new THREE.HemisphereLight(0xfff7ea, 0xa48c6c, 1.25)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.1)
  sun.castShadow = q.shadowSize > 0
  if (q.shadowSize > 0) sun.shadow.mapSize.set(q.shadowSize, q.shadowSize)
  {
    const sc = sun.shadow.camera
    const SB = 62
    sc.left = -SB
    sc.right = SB
    sc.top = SB
    sc.bottom = -SB
    sc.near = 1
    sc.far = 320
    sc.updateProjectionMatrix()
  }
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03
  scene.add(sun)
  scene.add(sun.target)
  const SUN_OFF = new THREE.Vector3(-45, 110, 60)
  function applyStyle(st: BuiltDecor['style']) {
    bg.set(st.background)
    fog.color.set(st.fog.color)
    fog.near = st.fog.near
    fog.far = st.fog.far
    hemi.color.set(st.hemi.sky)
    hemi.groundColor.set(st.hemi.ground)
    hemi.intensity = st.hemi.intensity
    sun.color.set(st.sun.color)
    sun.intensity = st.sun.intensity
    SUN_OFF.set(...st.sun.offset)
  }
  function placeSun(x: number, z: number) {
    const s = 0.5
    x = Math.round(x / s) * s
    z = Math.round(z / s) * s
    sun.target.position.set(x, 0, z)
    sun.position.set(x + SUN_OFF.x, SUN_OFF.y, z + SUN_OFF.z)
  }
  placeSun(0, 0)

  const MAX_ANISO = q.touch
    ? Math.min(4, renderer.capabilities.getMaxAnisotropy())
    : renderer.capabilities.getMaxAnisotropy()
  const textures: THREE.Texture[] = []
  function canvasTex(
    w: number,
    h: number,
    draw: Draw,
    { repeat = [1, 1], wrap = true }: { repeat?: [number, number]; wrap?: boolean } = {},
  ) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')!
    draw(g, w, h)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    if (wrap) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(repeat[0], repeat[1])
    }
    t.anisotropy = MAX_ANISO
    textures.push(t)
    return t
  }
  const matCache = new Map<string, THREE.MeshStandardMaterial>()
  function mat(color: number, opts: THREE.MeshStandardMaterialParameters = {}) {
    const k = color + JSON.stringify(opts)
    let m = matCache.get(k)
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...opts })
      matCache.set(k, m)
    }
    return m
  }
  const B = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d)
  const sphereGeo = new THREE.SphereGeometry(1, 16, 10)
  const ringGeo = new THREE.RingGeometry(0.86, 1, 48)

  /* ---------- cajas sorpresa ---------- */
  const pickGeo = B(1.2, 1.2, 1.2)
  const pickMat = new THREE.MeshStandardMaterial({
    map: canvasTex(64, 64, drawPickup, { wrap: false }),
    emissive: 0x16a3a0,
    emissiveIntensity: 0.35,
    roughness: 0.4,
  })
  const pickMeshes: THREE.Mesh[] = []
  function buildPickups() {
    for (const m of pickMeshes) scene.remove(m)
    pickMeshes.length = 0
    for (let k = 0; k < sim.pickups.length; k++) {
      const mesh = new THREE.Mesh(pickGeo, pickMat)
      mesh.castShadow = true
      scene.add(mesh)
      pickMeshes.push(mesh)
    }
  }
  function updatePickupMeshes() {
    sim.pickups.forEach((p, k) => {
      const mesh = pickMeshes[k]
      if (!mesh) return
      mesh.visible = p.active
      if (!p.active) return
      mesh.position.set(p.x, p.y + 1.05 + Math.sin(sim.time * 3 + p.phase) * 0.15, p.z)
      mesh.rotation.set(0.45, sim.time * 1.6 + p.phase, 0.2)
      mesh.scale.setScalar(1 - p.pop * 2)
    })
  }

  /* ---------- autos ---------- */
  function buildCarModel(def: CarDef): CarModel {
    const root = new THREE.Group()
    const tilt = new THREE.Group()
    const body = new THREE.Group()
    root.add(tilt)
    tilt.add(body)
    const own: { dispose(): void }[] = []
    const paint = new THREE.MeshStandardMaterial({
      color: def.color,
      roughness: 0.32,
      metalness: 0.12,
    })
    own.push(paint)
    const acc = mat(def.accent, { roughness: 0.45 })
    const dark = mat(0x23262d, { roughness: 0.8 })
    const glass = mat(0x1b2a3a, { roughness: 0.12, metalness: 0.35 })
    const lamp = mat(0xfff4c2, { emissive: 0xffe9a0, emissiveIntensity: 0.8 })
    const add = (
      g: THREE.BufferGeometry,
      m: THREE.Material,
      x: number,
      y: number,
      z: number,
      parent: THREE.Object3D = body,
    ) => {
      const o = new THREE.Mesh(g, m)
      o.position.set(x, y, z)
      o.castShadow = true
      parent.add(o)
      return o
    }
    let wr = 0.3,
      ww = 0.26,
      tr = 0.56
    const wb = 0.62
    let antY = 0.6
    add(B(0.92, 0.12, 1.72), dark, 0, 0.26, 0)
    if (def.style === 'sport') {
      add(B(0.98, 0.26, 1.46), paint, 0, 0.45, -0.02)
      add(B(0.9, 0.15, 0.42), paint, 0, 0.4, 0.78)
      add(B(0.62, 0.24, 0.62), glass, 0, 0.69, -0.14)
      add(B(0.08, 0.22, 0.08), dark, -0.32, 0.66, -0.7)
      add(B(0.08, 0.22, 0.08), dark, 0.32, 0.66, -0.7)
      add(B(1.06, 0.06, 0.3), acc, 0, 0.79, -0.74)
      add(B(0.22, 0.012, 1.47), acc, 0, 0.585, -0.02)
      add(B(0.18, 0.08, 0.04), lamp, 0.3, 0.45, 0.99)
      add(B(0.18, 0.08, 0.04), lamp, -0.3, 0.45, 0.99)
    } else if (def.style === 'buggy') {
      wr = 0.36
      ww = 0.3
      tr = 0.6
      antY = 0.62
      add(B(0.7, 0.22, 1.3), paint, 0, 0.46, 0.05)
      add(B(0.84, 0.1, 0.42), paint, 0, 0.42, 0.76)
      for (const x of [-0.28, 0.28]) {
        add(B(0.06, 0.42, 0.06), acc, x, 0.78, 0.16)
        add(B(0.06, 0.42, 0.06), acc, x, 0.78, -0.4)
        add(B(0.06, 0.06, 0.62), acc, x, 0.99, -0.12)
      }
      add(B(0.62, 0.06, 0.06), acc, 0, 0.99, 0.16)
      add(B(0.62, 0.06, 0.06), acc, 0, 0.99, -0.4)
      add(B(0.38, 0.22, 0.34), glass, 0, 0.67, -0.1)
      add(B(0.5, 0.25, 0.36), mat(0x9aa3ad, { metalness: 0.6, roughness: 0.35 }), 0, 0.5, -0.68)
      add(B(0.16, 0.08, 0.04), lamp, 0.22, 0.47, 0.98)
      add(B(0.16, 0.08, 0.04), lamp, -0.22, 0.47, 0.98)
    } else {
      wr = 0.38
      ww = 0.32
      tr = 0.6
      antY = 1.12
      add(B(1.0, 0.36, 1.62), paint, 0, 0.64, 0)
      add(B(0.86, 0.3, 0.72), glass, 0, 0.96, 0.06)
      add(B(0.9, 0.06, 0.74), paint, 0, 1.13, 0.06)
      add(B(1.06, 0.12, 0.18), acc, 0, 0.5, 0.86)
      add(B(1.06, 0.12, 0.18), acc, 0, 0.5, -0.86)
      add(B(0.7, 0.08, 0.1), lamp, 0, 1.2, 0.32)
      add(B(0.2, 0.1, 0.04), lamp, 0.32, 0.68, 0.82)
      add(B(0.2, 0.1, 0.04), lamp, -0.32, 0.68, 0.82)
    }
    const antPivot = new THREE.Group()
    antPivot.position.set(0.32, antY, -0.55)
    body.add(antPivot)
    add(new THREE.CylinderGeometry(0.016, 0.022, 1.3, 5), dark, 0, 0.65, 0, antPivot)
    add(new THREE.SphereGeometry(0.055, 8, 6), acc, 0, 1.3, 0, antPivot)
    const flame = new THREE.Group()
    flame.position.set(0, 0.45, -0.95)
    body.add(flame)
    const cg = new THREE.ConeGeometry(0.16, 0.7, 8)
    cg.rotateX(-Math.PI / 2)
    cg.translate(0, 0, -0.35)
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x7fd4ff,
      transparent: true,
      opacity: 0.85,
    })
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xffb030 })
    own.push(outerMat, innerMat, cg)
    flame.add(new THREE.Mesh(cg, outerMat))
    const inner = new THREE.Mesh(cg, innerMat)
    inner.scale.set(0.55, 0.55, 0.6)
    flame.add(inner)
    flame.visible = false
    const tg = new THREE.CylinderGeometry(wr, wr, ww, 16)
    tg.rotateZ(Math.PI / 2)
    const hg = new THREE.CylinderGeometry(wr * 0.55, wr * 0.55, ww + 0.02, 8)
    hg.rotateZ(Math.PI / 2)
    const tm = mat(0x17181b, { roughness: 0.95 })
    const hm = mat(def.accent === 0xffffff ? 0xd3d8de : def.accent, {
      roughness: 0.4,
      metalness: 0.4,
    })
    const wheels: THREE.Group[] = []
    const steerPivots: THREE.Group[] = []
    for (const [sx, sz] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ] as const) {
      const piv = new THREE.Group()
      piv.position.set(sx * tr, wr, sz * wb)
      tilt.add(piv)
      const spin = new THREE.Group()
      piv.add(spin)
      add(tg, tm, 0, 0, 0, spin)
      add(hg, hm, 0, 0, 0, spin)
      add(B(ww + 0.05, wr * 1.45, 0.07), hm, 0, 0, 0, spin)
      wheels.push(spin)
      if (sz > 0) steerPivots.push(piv)
    }
    own.push(tg, hg)
    return { root, tilt, body, wheels, steerPivots, antPivot, flame, wheelR: wr, own }
  }
  const models = new Map<Car, CarModel>()

  function visuals(c: Car, dt: number) {
    const m = models.get(c)
    if (!m) return
    m.root.position.set(c.x, c.y, c.z)
    m.root.rotation.y = c.heading
    const sa = (c.vf * dt) / m.wheelR
    for (const w of m.wheels) w.rotation.x += sa
    for (const p of m.steerPivots) p.rotation.y = c.steer * 0.42
    m.tilt.rotation.x = c.pitch
    m.tilt.rotation.z = c.flipT > 0 ? (1 - c.flipT / FLIP_T) * Math.PI * 2 * c.flipDir : 0
    m.body.rotation.z = c.roll
    m.body.rotation.x = c.dive
    c.squash = Math.max(0, c.squash - dt)
    const sq = c.squash > 0 && !q.reducedMotion ? Math.sin((c.squash / 0.25) * Math.PI) * 0.12 : 0
    m.body.scale.set(1 + sq * 0.5, 1 - sq, 1 + sq * 0.5)
    m.antPivot.rotation.x = c.antA
    m.antPivot.rotation.z = c.antB
    m.flame.visible = c.turbo > 0
    if (c.turbo > 0) {
      const s = 0.8 + random() * 0.5
      m.flame.scale.set(s, s, s * (1 + random() * 0.6))
    }
    m.root.visible = !(c.blink > 0 && Math.floor(sim.time * 20) % 2 === 0)
  }

  /* ---------- partículas y efectos ---------- */
  const PMAX = q.particles
  const pMesh = new THREE.InstancedMesh(
    B(1, 1, 1),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
    PMAX,
  )
  pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  pMesh.frustumCulled = false
  scene.add(pMesh)
  const P: Particle[] = []
  const dummy = new THREE.Object3D()
  const tmpC = new THREE.Color()
  let pNext = 0
  dummy.position.set(0, -50, 0)
  dummy.scale.setScalar(0)
  dummy.updateMatrix()
  for (let i = 0; i < PMAX; i++) {
    P.push({
      dead: true,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      size: 0,
      life: 0,
      max: 1,
      grav: 0,
      floor: 0.05,
    })
    pMesh.setMatrixAt(i, dummy.matrix)
    pMesh.setColorAt(i, tmpC.set(0xffffff))
  }
  function emit(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    color: number,
    size: number,
    life: number,
    grav: number,
  ) {
    if (q.particleScale < 1 && Math.random() > q.particleScale) return
    const i = pNext
    pNext = (pNext + 1) % PMAX
    const p = P[i]!
    p.x = x
    p.y = y
    p.z = z
    p.vx = vx
    p.vy = vy
    p.vz = vz
    p.size = size
    p.life = life
    p.max = life
    p.grav = grav || 0
    p.floor = Math.max(0.05, y - 1.2)
    p.dead = false
    pMesh.setColorAt(i, tmpC.set(color))
    pMesh.instanceColor!.needsUpdate = true
  }
  function updateParticles(dt: number) {
    for (let i = 0; i < PMAX; i++) {
      const p = P[i]!
      if (p.dead) continue
      p.life -= dt
      if (p.life <= 0) {
        p.dead = true
        dummy.position.set(0, -50, 0)
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        pMesh.setMatrixAt(i, dummy.matrix)
        continue
      }
      p.vy -= p.grav * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
      if (p.y < p.floor && p.grav > 0) {
        p.y = p.floor
        p.vy *= -0.3
        p.vx *= 0.7
        p.vz *= 0.7
      }
      const k = p.life / p.max
      dummy.position.set(p.x, p.y, p.z)
      dummy.rotation.set(p.life * 5, p.life * 3, 0)
      dummy.scale.setScalar(p.size * (0.3 + 0.7 * k))
      dummy.updateMatrix()
      pMesh.setMatrixAt(i, dummy.matrix)
    }
    pMesh.instanceMatrix.needsUpdate = true
  }
  const fxList: Fx[] = []
  function addFx(
    mesh: THREE.Mesh,
    dur: number,
    s0: number,
    s1: number,
    o0: number,
    follow?: { x: number; z: number },
  ) {
    scene.add(mesh)
    fxList.push({ mesh, t: 0, dur, s0, s1, o0, follow })
  }
  function removeFx(f: Fx) {
    scene.remove(f.mesh)
    ;(f.mesh.material as THREE.Material).dispose()
  }
  function updateFx(dt: number) {
    for (let k = fxList.length - 1; k >= 0; k--) {
      const f = fxList[k]!
      f.t += dt
      const qq = Math.min(1, f.t / f.dur)
      const e = 1 - (1 - qq) * (1 - qq)
      f.mesh.scale.setScalar(lerp(f.s0, f.s1, e))
      ;(f.mesh.material as THREE.MeshBasicMaterial).opacity = f.o0 * (1 - qq)
      if (f.follow) {
        f.mesh.position.x = f.follow.x
        f.mesh.position.z = f.follow.z
      }
      if (qq >= 1) {
        removeFx(f)
        fxList.splice(k, 1)
      }
    }
  }

  /* ---------- cohetes y aceite ---------- */
  interface RocketView {
    g: THREE.Group
    own: { dispose(): void }[]
  }
  const rocketMeshes = new Map<Rocket, RocketView>()
  function makeRocketMesh(): RocketView {
    const g = new THREE.Group()
    const own: { dispose(): void }[] = []
    const cb = new THREE.CylinderGeometry(0.16, 0.16, 0.9, 8)
    const cn = new THREE.ConeGeometry(0.16, 0.35, 8)
    const f1g = B(0.55, 0.04, 0.22)
    const f2g = B(0.04, 0.55, 0.22)
    const gg = new THREE.SphereGeometry(0.14, 8, 6)
    own.push(cb, cn, f1g, f2g, gg)
    const b = new THREE.Mesh(cb, mat(0xff4a3d))
    b.rotation.x = Math.PI / 2
    g.add(b)
    const n = new THREE.Mesh(cn, mat(0xffffff))
    n.rotation.x = Math.PI / 2
    n.position.z = 0.62
    g.add(n)
    const f1 = new THREE.Mesh(f1g, mat(0xffd23f))
    f1.position.z = -0.35
    g.add(f1)
    const f2 = new THREE.Mesh(f2g, mat(0xffd23f))
    f2.position.z = -0.35
    g.add(f2)
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffe066 })
    own.push(glowMat)
    const glow = new THREE.Mesh(gg, glowMat)
    glow.position.z = -0.5
    g.add(glow)
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = true
    })
    return { g, own }
  }
  function updateRocketMeshes() {
    for (const r of sim.rockets) {
      const v = rocketMeshes.get(r)
      if (!v) continue
      v.g.position.set(r.x, r.y, r.z)
      v.g.rotation.y = r.heading
      emit(
        r.x - Math.sin(r.heading) * 0.6,
        r.y,
        r.z - Math.cos(r.heading) * 0.6,
        rand(-0.5, 0.5),
        rand(0, 1),
        rand(-0.5, 0.5),
        Math.random() < 0.5 ? 0xdddddd : 0xffb030,
        rand(0.15, 0.28),
        0.45,
        -1,
      )
    }
  }
  const oilTex = canvasTex(128, 128, drawOil, { wrap: false })
  const oilGeo = new THREE.PlaneGeometry(4.2, 4.2)
  const oilMeshes = new Map<Oil, THREE.Mesh>()
  function updateOilMeshes() {
    for (const o of sim.oils) {
      const m = oilMeshes.get(o)
      if (m) (m.material as THREE.MeshStandardMaterial).opacity = clamp(o.life / 2, 0, 1)
    }
  }

  /* ---------- cámara ---------- */
  let camMode = camMode0
  let camSnap = true
  let camH = 0
  let camOrbit = 0
  const camLook = new THREE.Vector3()
  const camDes = new THREE.Vector3()
  const tmpV = new THREE.Vector3()
  const fovGain = q.reducedMotion ? 0.3 : 1
  function setFov(f: number, dt: number) {
    camera.fov += (f - camera.fov) * Math.min(1, dt * 3)
    camera.updateProjectionMatrix()
  }
  function updateCamera(dt: number) {
    const player = sim.player
    if (sim.attract || !player) {
      const lead = sim.ranked[0] ?? sim.cars[0]
      if (!lead) return
      camOrbit += dt * 0.13
      camDes.set(
        clamp(lead.x + Math.cos(camOrbit) * 18, ROOM.x0 + 3, ROOM.x1 - 3),
        lead.y + 7,
        clamp(lead.z + Math.sin(camOrbit) * 18, ROOM.z0 + 3, ROOM.z1 - 3),
      )
      tmpV.set(lead.x, lead.y + 0.8, lead.z)
      if (camSnap) {
        camera.position.copy(camDes)
        camLook.copy(tmpV)
        camSnap = false
      }
      camera.position.lerp(camDes, 1 - Math.exp(-dt * 2))
      camLook.lerp(tmpV, 1 - Math.exp(-dt * 6))
      camera.lookAt(camLook)
      setFov(58, dt)
      return
    }
    const c = player
    const sp = Math.hypot(c.vx, c.vz)
    let th = c.heading
    if ((c.spinVel || c.slip > 0 || c.flipT > 0) && sp > 2) th = Math.atan2(c.vx, c.vz)
    else if (c.spinVel || c.flipT > 0) th = camH
    if (camSnap) camH = th
    camH += wrapA(th - camH) * Math.min(1, dt * 6)
    const dist = camMode ? 8.6 : 5.4
    const hh = camMode ? 3.8 : 2.3
    const fx_ = Math.sin(camH)
    const fz_ = Math.cos(camH)
    // La cámara sigue el asfalto (no los saltos): sube y baja con el relieve y amortigua las rampas.
    const base = sim.track.baseAt(c.x, c.z, c.idx)
    const air = c.y - base
    camDes.set(c.x - fx_ * dist, base + air * 0.7 + hh, c.z - fz_ * dist)
    if (camSnap) {
      camera.position.copy(camDes)
      camSnap = false
    }
    camera.position.lerp(camDes, 1 - Math.exp(-dt * 12))
    // Nunca por debajo del suelo que tiene debajo (en las bajadas la pista queda más alto atrás).
    const floor = sim.track.flat ? 0 : sim.track.baseAt(camera.position.x, camera.position.z, c.idx)
    camera.position.y = Math.max(camera.position.y, floor + 0.6, 0.6)
    camLook.set(c.x + fx_ * 3, base + air * 0.85 + 0.9, c.z + fz_ * 3)
    camera.lookAt(camLook)
    setFov(64 + (Math.min(sp, 45) * 0.28 + (c.turbo > 0 ? 6 : 0)) * fovGain, dt)
  }

  /* ---------- armado ---------- */
  let built: BuiltDecor | null = null
  function setTrack(rt: TrackRuntime) {
    built?.ctx.dispose()
    built = buildDecor({ rt, maxAniso: MAX_ANISO })
    scene.add(built.ctx.root)
    applyStyle(built.style)
    buildPickups()
    camSnap = true
  }
  setTrack(sim.track)

  const world: RallyWorld = {
    canvas,
    get warnings() {
      return built?.ctx.warnings ?? []
    },
    setTrack,
    get trackId() {
      return built?.ctx.rt.id ?? ''
    },
    get camMode() {
      return camMode
    },
    set camMode(v: number) {
      camMode = v
    },
    hooks: {
      emit,
      fx(kind, x, y, z, follow) {
        if (kind === 'explode') {
          const m = new THREE.Mesh(
            sphereGeo,
            new THREE.MeshBasicMaterial({
              color: 0xffb030,
              transparent: true,
              opacity: 0.9,
              depthWrite: false,
            }),
          )
          m.position.set(x, y, z)
          addFx(m, 0.35, 0.4, 3.2, 0.9)
        } else {
          const m = new THREE.Mesh(
            sphereGeo,
            new THREE.MeshBasicMaterial({
              color: 0x7ef0ff,
              transparent: true,
              opacity: 0.4,
              depthWrite: false,
            }),
          )
          m.position.set(x, y + 0.5, z)
          addFx(m, 0.45, 1, PULSE_R, 0.4, follow)
          const ring = new THREE.Mesh(
            ringGeo,
            new THREE.MeshBasicMaterial({
              color: 0xffffff,
              transparent: true,
              opacity: 0.8,
              depthWrite: false,
              side: THREE.DoubleSide,
            }),
          )
          ring.rotation.x = -Math.PI / 2
          ring.position.set(x, y + 0.15, z)
          addFx(ring, 0.4, 1, PULSE_R, 0.8, follow)
        }
      },
      onClear() {
        for (const m of models.values()) {
          scene.remove(m.root)
          m.own.forEach((d) => d.dispose())
        }
        models.clear()
        for (const v of rocketMeshes.values()) {
          scene.remove(v.g)
          v.own.forEach((d) => d.dispose())
        }
        rocketMeshes.clear()
        for (const m of oilMeshes.values()) {
          scene.remove(m)
          ;(m.material as THREE.Material).dispose()
        }
        oilMeshes.clear()
        for (const f of fxList) removeFx(f)
        fxList.length = 0
      },
      onCarCreated(car) {
        const model = buildCarModel(car.def)
        scene.add(model.root)
        models.set(car, model)
        visuals(car, 0)
      },
      onRaceStarted() {
        camSnap = true
      },
      onRocketSpawn(r) {
        const v = makeRocketMesh()
        scene.add(v.g)
        rocketMeshes.set(r, v)
      },
      onRocketRemove(r) {
        const v = rocketMeshes.get(r)
        if (v) {
          scene.remove(v.g)
          v.own.forEach((d) => d.dispose())
        }
        rocketMeshes.delete(r)
      },
      onOilSpawn(o) {
        const m = new THREE.Mesh(
          oilGeo,
          new THREE.MeshStandardMaterial({
            map: oilTex,
            transparent: true,
            roughness: 0.12,
            metalness: 0.3,
            depthWrite: false,
            polygonOffset: true,
            polygonOffsetFactor: -4,
          }),
        )
        m.rotation.set(-Math.PI / 2, 0, Math.random() * 6.28)
        m.position.set(o.x, sim.track.groundAt(o.x, o.z) + 0.05, o.z)
        m.receiveShadow = true
        scene.add(m)
        oilMeshes.set(o, m)
      },
      onOilRemove(o) {
        const m = oilMeshes.get(o)
        if (m) {
          scene.remove(m)
          ;(m.material as THREE.Material).dispose()
        }
        oilMeshes.delete(o)
      },
    },
    update(dt) {
      for (const c of sim.cars) visuals(c, dt)
      updatePickupMeshes()
      updateOilMeshes()
      updateFx(dt)
      updateRocketMeshes()
      updateParticles(dt)
      const focus = sim.player && !sim.attract ? sim.player : sim.ranked[0]
      if (focus) placeSun(focus.x, focus.z)
    },
    updateCamera,
    stats: () => ({
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      camera: [camera.position.x, camera.position.y, camera.position.z],
    }),
    render() {
      renderer.render(scene, camera)
    },
    resize(w, h) {
      W = Math.max(1, w)
      H = Math.max(1, h)
      renderer.setSize(W, H, false)
      camera.aspect = W / H
      camera.updateProjectionMatrix()
    },
    setPixelRatio(r) {
      pixelRatio = r
      renderer.setPixelRatio(r)
      renderer.setSize(W, H, false)
    },
    getPixelRatio: () => pixelRatio,
    setShadows(on) {
      sun.castShadow = on && q.shadowSize > 0
    },
    dispose() {
      built?.ctx.dispose()
      built = null
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        if (m.geometry) m.geometry.dispose()
        const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : []
        for (const mt of mats) {
          const mm = mt as THREE.MeshStandardMaterial
          mm.map?.dispose()
          mt.dispose()
        }
      })
      for (const t of textures) t.dispose()
      for (const g of [sphereGeo, ringGeo, oilGeo, pickGeo]) g.dispose()
      for (const m of [...matCache.values(), pickMat]) m.dispose()
      for (const m of models.values()) m.own.forEach((d) => d.dispose())
      for (const v of rocketMeshes.values()) v.own.forEach((d) => d.dispose())
      pMesh.dispose()
      sun.shadow.map?.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    },
  }
  return world
}
