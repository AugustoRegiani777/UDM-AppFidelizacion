// Rally de Cocina: el mundo 3D (cocina, pista, autos, partículas, cámara). Porte de la demo a three 0.170.
import * as THREE from 'three'
import {
  FLIP_T,
  HW,
  N,
  PULSE_R,
  ROOM,
  clamp,
  lerp,
  rand,
  random,
  wrapA,
  type CarDef,
} from './data.ts'
import type { Quality } from './quality.ts'
import type { Car, Oil, Rocket, RallySim } from './sim.ts'
import { DIST, LEN, NRM, TAN, TP, chk, ramps, groundAt } from './track.ts'

type Draw = (g: CanvasRenderingContext2D, w: number, h: number) => void

/* ============ texturas dibujadas ============ */
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
function drawTrack(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = '#4b5160'
  g.fillRect(0, 0, w, h)
  for (let k = 0; k < 2600; k++) {
    const v = Math.random() * 50
    g.fillStyle = `rgba(${70 + v},${74 + v},${86 + v},.5)`
    g.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5)
  }
  g.fillStyle = '#f4f1ea'
  g.fillRect(5, 0, 6, h)
  g.fillRect(w - 11, 0, 6, h)
  g.fillStyle = 'rgba(255,210,63,.85)'
  g.fillRect(w / 2 - 2, 0, 4, h * 0.45)
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
}

export interface RallyWorld {
  readonly canvas: HTMLCanvasElement
  readonly warnings: string[]
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
  scene.background = new THREE.Color(0xd9e7e1)
  scene.fog = new THREE.Fog(0xd9e7e1, 150, 420)
  const camera = new THREE.PerspectiveCamera(64, W / H, 0.1, 800)
  camera.position.set(0, 30, 90)

  scene.add(new THREE.HemisphereLight(0xfff7ea, 0xa48c6c, 1.25))
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
  function addMesh(
    geo: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    x: number,
    y: number,
    z: number,
    {
      rx = 0,
      ry = 0,
      rz = 0,
      cast = true,
      receive = true,
      order,
    }: {
      rx?: number
      ry?: number
      rz?: number
      cast?: boolean
      receive?: boolean
      order?: THREE.EulerOrder
    } = {},
  ) {
    const m = new THREE.Mesh(geo, material)
    if (order) m.rotation.order = order
    m.position.set(x, y, z)
    m.rotation.set(rx, ry, rz)
    m.castShadow = cast
    m.receiveShadow = receive
    scene.add(m)
    return m
  }
  const sphereGeo = new THREE.SphereGeometry(1, 16, 10)
  const ringGeo = new THREE.RingGeometry(0.86, 1, 48)
  const warnings: string[] = []
  const check = (name: string, x: number, z: number, r: number) => {
    const w = chk(name, x, z, r)
    if (w) warnings.push(w)
  }

  /* ---------- cocina ---------- */
  function buildKitchen() {
    const Wd = ROOM.x1 - ROOM.x0
    const D = ROOM.z1 - ROOM.z0
    const Ht = ROOM.h
    const cx = (ROOM.x0 + ROOM.x1) / 2
    const cz = (ROOM.z0 + ROOM.z1) / 2
    addMesh(
      new THREE.PlaneGeometry(Wd, D),
      new THREE.MeshStandardMaterial({
        map: canvasTex(256, 256, drawTiles, { repeat: [Wd / 16, D / 16] }),
        roughness: 0.7,
      }),
      cx,
      0,
      cz,
      { rx: -Math.PI / 2, cast: false },
    )
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xbfd9d0, roughness: 0.95 })
    addMesh(new THREE.PlaneGeometry(Wd, Ht), wallMat, cx, Ht / 2, ROOM.z0, { cast: false })
    addMesh(new THREE.PlaneGeometry(Wd, Ht), wallMat, cx, Ht / 2, ROOM.z1, {
      ry: Math.PI,
      cast: false,
    })
    addMesh(new THREE.PlaneGeometry(D, Ht), wallMat, ROOM.x0, Ht / 2, cz, {
      ry: Math.PI / 2,
      cast: false,
    })
    addMesh(new THREE.PlaneGeometry(D, Ht), wallMat, ROOM.x1, Ht / 2, cz, {
      ry: -Math.PI / 2,
      cast: false,
    })
    addMesh(new THREE.PlaneGeometry(Wd, D), mat(0xf4f1ea, { roughness: 1 }), cx, Ht, cz, {
      rx: Math.PI / 2,
      cast: false,
    })
    const bb = mat(0xf6f3ec, { roughness: 0.6 })
    addMesh(B(Wd, 1.6, 0.6), bb, cx, 0.8, ROOM.z0 + 0.3)
    addMesh(B(Wd, 1.6, 0.6), bb, cx, 0.8, ROOM.z1 - 0.3)
    addMesh(B(0.6, 1.6, D), bb, ROOM.x0 + 0.3, 0.8, cz)
    addMesh(B(0.6, 1.6, D), bb, ROOM.x1 - 0.3, 0.8, cz)

    // mesadas contra las paredes norte y este
    const wood = mat(0xd29a63, { roughness: 0.7 })
    const front = new THREE.MeshStandardMaterial({
      map: canvasTex(128, 200, drawCabinet, { wrap: false }),
      roughness: 0.65,
    })
    const oven = new THREE.MeshStandardMaterial({
      map: canvasTex(128, 200, drawOven, { wrap: false }),
      roughness: 0.35,
      metalness: 0.2,
    })
    const top = mat(0xe9e6df, { roughness: 0.35 })
    const CH = 17
    const CD = 12
    for (let k = 0; k < 19; k++) {
      const x = -88 + 5 + k * 10
      addMesh(
        B(10, CH, CD),
        [wood, wood, wood, wood, k === 11 ? oven : front, wood],
        x,
        CH / 2,
        ROOM.z0 + CD / 2,
      )
    }
    addMesh(B(192, 1.4, CD + 0.8), top, -88 + 95, CH + 0.7, ROOM.z0 + CD / 2 + 0.4)
    for (let k = 0; k < 13; k++) {
      const z = -76 + 5 + k * 10
      addMesh(B(CD, CH, 10), [wood, front, wood, wood, wood, wood], ROOM.x1 - CD / 2, CH / 2, z)
    }
    addMesh(B(CD + 0.8, 1.4, 130), top, ROOM.x1 - CD / 2 - 0.4, CH + 0.7, -76 + 65)
    addMesh(
      new THREE.PlaneGeometry(190, 13),
      new THREE.MeshStandardMaterial({
        map: canvasTex(128, 128, (g, w) => drawSplash(g, w), { repeat: [190 / 8, 13 / 8] }),
        roughness: 0.3,
      }),
      -88 + 95,
      CH + 1.4 + 6.5,
      ROOM.z0 + 0.06,
      { cast: false },
    )
    for (let k = 0; k < 14; k++) {
      const x = -48 + 5 + k * 10
      addMesh(B(10, 14, 8), [wood, wood, wood, wood, front, wood], x, 39, ROOM.z0 + 4)
    }
    // cosas sobre la mesada
    addMesh(
      new THREE.CylinderGeometry(2.4, 2.4, 6, 16),
      mat(0xd94b3b, { roughness: 0.4 }),
      -60,
      CH + 1.4 + 3,
      ROOM.z0 + 6,
    )
    addMesh(
      B(9, 5, 6),
      mat(0xc9ced4, { metalness: 0.5, roughness: 0.3 }),
      70,
      CH + 1.4 + 2.5,
      ROOM.z0 + 6,
    )
    addMesh(
      new THREE.CylinderGeometry(3, 2.4, 4, 18),
      mat(0x3d7f6a, { roughness: 0.6 }),
      ROOM.x1 - 6,
      CH + 1.4 + 2,
      20,
    )

    // heladera
    const fr = mat(0xf2f4f5, { roughness: 0.25, metalness: 0.1 })
    addMesh(B(16, 40, 15), fr, ROOM.x0 + 9, 20, ROOM.z0 + 7.5)
    addMesh(B(15.6, 0.3, 0.2), mat(0x9aa0a6), ROOM.x0 + 9, 27, ROOM.z0 + 15.05)
    addMesh(
      B(0.8, 8, 0.8),
      mat(0xb8bdc3, { metalness: 0.6, roughness: 0.3 }),
      ROOM.x0 + 15,
      32,
      ROOM.z0 + 15.4,
    )
    addMesh(
      B(0.8, 12, 0.8),
      mat(0xb8bdc3, { metalness: 0.6, roughness: 0.3 }),
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
    ).forEach(([c, dx, y]) => addMesh(B(1.4, 1.4, 0.4), mat(c), ROOM.x0 + dx, y, ROOM.z0 + 15.2))

    // ventana y puerta
    const winX = -10
    const winY = 34
    addMesh(
      new THREE.PlaneGeometry(36, 22),
      new THREE.MeshBasicMaterial({ map: canvasTex(256, 160, drawSky, { wrap: false }) }),
      winX,
      winY,
      ROOM.z1 - 0.1,
      { ry: Math.PI, cast: false },
    )
    const frame = mat(0xffffff, { roughness: 0.5 })
    addMesh(B(38, 1.2, 1.2), frame, winX, winY + 11.5, ROOM.z1 - 0.6)
    addMesh(B(38, 1.2, 1.2), frame, winX, winY - 11.5, ROOM.z1 - 0.6)
    addMesh(B(1.2, 24, 1.2), frame, winX - 18.5, winY, ROOM.z1 - 0.6)
    addMesh(B(1.2, 24, 1.2), frame, winX + 18.5, winY, ROOM.z1 - 0.6)
    addMesh(B(1, 22, 1), frame, winX, winY, ROOM.z1 - 0.6)
    addMesh(B(40, 1, 3), frame, winX, winY - 12.4, ROOM.z1 - 1.5)
    addMesh(
      new THREE.PlaneGeometry(20, 40),
      mat(0xa86b3c, { roughness: 0.6 }),
      ROOM.x0 + 0.1,
      20,
      40,
      { ry: Math.PI / 2, cast: false },
    )
    addMesh(
      new THREE.SphereGeometry(0.9, 12, 8),
      mat(0xd8c07a, { metalness: 0.7, roughness: 0.3 }),
      ROOM.x0 + 0.9,
      19,
      47,
    )
    addMesh(
      new THREE.PlaneGeometry(10, 18),
      new THREE.MeshStandardMaterial({
        map: canvasTex(64, 128, drawRug, { wrap: false }),
        roughness: 1,
      }),
      ROOM.x0 + 7,
      0.04,
      40,
      { rx: -Math.PI / 2, cast: false },
    )

    // la mesa grande bajo la que corre la pista
    const tw = mat(0x9b6236, { roughness: 0.6 })
    const TX = 0,
      TZ = -11,
      TW = 66,
      TD = 38,
      TH = 15
    addMesh(B(TW, 1.4, TD), tw, TX, TH, TZ)
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const lx = TX + sx * (TW / 2 - 2.5)
        const lz = TZ + sz * (TD / 2 - 2.5)
        addMesh(B(1.8, TH, 1.8), tw, lx, TH / 2, lz)
        check('pata', lx, lz, 1.3)
      }
    addMesh(B(TW - 4, 1.6, 0.8), tw, TX, TH - 1.5, TZ + TD / 2 - 2.5)
    addMesh(B(TW - 4, 1.6, 0.8), tw, TX, TH - 1.5, TZ - TD / 2 + 2.5)
    addMesh(B(TW - 10, 0.2, 12), mat(0xd8473d, { roughness: 0.9 }), TX, TH + 0.8, TZ)
    addMesh(
      new THREE.CylinderGeometry(5, 3.5, 3, 20),
      mat(0xf4f1ea, { roughness: 0.4 }),
      TX + 8,
      TH + 2.2,
      TZ + 3,
    )

    const chair = (x: number, z: number, ry: number) => {
      const g = new THREE.Group()
      const cw = mat(0xc9773c, { roughness: 0.6 })
      const parts: [THREE.BufferGeometry, number, number, number][] = [
        [B(10, 1, 10), 0, 9, 0],
        [B(1, 9, 1), -4.3, 4.5, -4.3],
        [B(1, 9, 1), 4.3, 4.5, -4.3],
        [B(1, 9, 1), -4.3, 4.5, 4.3],
        [B(1, 9, 1), 4.3, 4.5, 4.3],
        [B(1, 11, 1), -4.3, 15, 4.3],
        [B(1, 11, 1), 4.3, 15, 4.3],
        [B(9.6, 3, 0.8), 0, 18.5, 4.3],
        [B(9.6, 1.5, 0.8), 0, 13, 4.3],
      ]
      for (const [geo, px, py, pz] of parts) {
        const m = new THREE.Mesh(geo, cw)
        m.position.set(px, py, pz)
        m.castShadow = m.receiveShadow = true
        g.add(m)
      }
      g.position.set(x, 0, z)
      g.rotation.y = ry
      scene.add(g)
      check('silla', x, z, 7.2)
    }
    chair(-15, 20, 0.1)
    chair(16, 21, -0.15)

    // juguetes y comida en el centro
    addMesh(
      B(7, 10, 2.6),
      [
        mat(0xff8a1a),
        mat(0xff8a1a),
        mat(0xffb030),
        mat(0xff8a1a),
        new THREE.MeshStandardMaterial({
          map: canvasTex(128, 180, drawCereal, { wrap: false }),
          roughness: 0.7,
        }),
        mat(0xff8a1a),
      ],
      40,
      5,
      28,
      { ry: -0.4 },
    )
    check('cereal', 40, 28, 4.5)
    for (let i = 0; i < 14; i++) {
      const x = 40 + rand(-5, 5)
      const z = 33 + rand(-2, 4)
      addMesh(new THREE.SphereGeometry(0.32, 6, 4), mat(0x7a3b16), x, 0.3, z)
    }
    const mug = new THREE.Group()
    {
      const m1 = new THREE.Mesh(
        new THREE.CylinderGeometry(2, 1.8, 2.8, 20),
        mat(0x2f6df0, { roughness: 0.35 }),
      )
      m1.position.y = 1.4
      m1.castShadow = true
      mug.add(m1)
      const hd = new THREE.Mesh(
        new THREE.TorusGeometry(0.95, 0.25, 8, 16, Math.PI),
        mat(0x2f6df0, { roughness: 0.35 }),
      )
      hd.position.set(2, 1.4, 0)
      hd.rotation.z = -Math.PI / 2
      hd.castShadow = true
      mug.add(hd)
    }
    mug.position.set(-36, 0, 30)
    mug.rotation.y = 0.6
    scene.add(mug)
    check('taza', -36, 30, 3)
    for (const [x, z] of [
      [20, 32],
      [23.5, 35],
      [-50, 10],
    ] as const) {
      addMesh(new THREE.SphereGeometry(1.5, 14, 10), mat(0xd8282f, { roughness: 0.35 }), x, 1.5, z)
      addMesh(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 5), mat(0x5a3a1a), x, 3.2, z)
      check('manzana', x, z, 1.5)
    }
    const blocks = [
      ['A', '#ff4a3d', -20, 36, 0],
      ['B', '#2f6df0', -17.6, 36.4, 0],
      ['C', '#46c24c', -18.9, 36.1, 1],
      ['D', '#ffd23f', -22, 39, 0],
    ] as const
    for (const [l, c, x, z, lvl] of blocks) {
      addMesh(
        B(1.6, 1.6, 1.6),
        new THREE.MeshStandardMaterial({
          map: canvasTex(64, 64, drawBlock(l, c), { wrap: false }),
          roughness: 0.6,
        }),
        x,
        0.8 + lvl * 1.6,
        z,
        { ry: rand(-0.3, 0.3) },
      )
      check('bloque', x, z, 1.2)
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
        mat(c, { roughness: 0.5 }),
      )
      b.castShadow = true
      g.add(b)
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.8, 6), mat(c, { roughness: 0.5 }))
      tip.position.y = 2.9
      g.add(tip)
      g.position.set(x, 0.33, z)
      g.rotation.set(0, r, Math.PI / 2)
      scene.add(g)
      check('crayón', x, z, 3)
    })
    addMesh(
      new THREE.SphereGeometry(4.5, 20, 14),
      new THREE.MeshStandardMaterial({
        map: canvasTex(256, 64, drawBall, { wrap: false }),
        roughness: 0.4,
      }),
      -98,
      4.5,
      64,
      { rz: 0.4 },
    )
    check('pelota', -98, 64, 4.5)
    addMesh(
      new THREE.CylinderGeometry(4, 5, 2, 22),
      mat(0xb8bdc3, { metalness: 0.6, roughness: 0.3 }),
      96,
      1,
      70,
    )
    addMesh(
      new THREE.CylinderGeometry(3.3, 3.3, 0.2, 22),
      mat(0x8a5a2b, { roughness: 0.9 }),
      96,
      1.9,
      70,
    )
  }

  function buildTrack() {
    const pos: number[] = []
    const uv: number[] = []
    const idx: number[] = []
    const reps = Math.max(1, Math.round(LEN / 9))
    for (let i = 0; i <= N; i++) {
      const k = i % N
      const p = TP[k]!
      const n = NRM[k]!
      const v = ((i === N ? LEN : DIST[k]!) / LEN) * reps
      pos.push(p.x + n.x * HW, 0.03, p.z + n.z * HW, p.x - n.x * HW, 0.03, p.z - n.z * HW)
      uv.push(0, v, 1, v)
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2,
        b = a + 1,
        c = a + 2,
        d = a + 3
      idx.push(a, b, c, b, d, c)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    geo.setIndex(idx)
    geo.computeVertexNormals()
    const trackMesh = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        map: canvasTex(128, 256, drawTrack),
        roughness: 0.92,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
    )
    trackMesh.receiveShadow = true
    scene.add(trackMesh)
  }
  function buildCurbs() {
    const step = 3
    const items: { x: number; z: number; len: number; rot: number; c: number }[] = []
    for (const side of [1, -1])
      for (let i = 0; i < N; i += step) {
        const j = (i + step) % N
        const a = TP[i]!,
          b = TP[j]!,
          na = NRM[i]!,
          nb = NRM[j]!
        const off = HW + 0.35
        const ax = a.x + na.x * off * side,
          az = a.z + na.z * off * side
        const bx = b.x + nb.x * off * side,
          bz = b.z + nb.z * off * side
        items.push({
          x: (ax + bx) / 2,
          z: (az + bz) / 2,
          len: Math.hypot(bx - ax, bz - az) + 0.06,
          rot: Math.atan2(bx - ax, bz - az),
          c: ((i / step) | 0) % 2,
        })
      }
    const im = new THREE.InstancedMesh(
      B(0.7, 0.7, 1),
      new THREE.MeshStandardMaterial({ roughness: 0.5 }),
      items.length,
    )
    const d = new THREE.Object3D()
    const cA = new THREE.Color(0xe8392b)
    const cB = new THREE.Color(0xf6f1e7)
    items.forEach((it, k) => {
      d.position.set(it.x, 0.35, it.z)
      d.rotation.set(0, it.rot, 0)
      d.scale.set(1, 1, it.len)
      d.updateMatrix()
      im.setMatrixAt(k, d.matrix)
      im.setColorAt(k, it.c ? cA : cB)
    })
    im.castShadow = true
    im.receiveShadow = true
    scene.add(im)
  }
  function buildStartGate() {
    const p = TP[0]!
    const n = NRM[0]!
    const off = HW + 2.2
    const phi = Math.atan2(-n.z, n.x)
    for (const s of [1, -1]) {
      const x = p.x + n.x * off * s
      const z = p.z + n.z * off * s
      addMesh(
        new THREE.CylinderGeometry(0.9, 0.9, 12, 6),
        mat(s > 0 ? 0xffc928 : 0x3fa7ff, { roughness: 0.5 }),
        x,
        6,
        z,
      )
      addMesh(
        new THREE.CylinderGeometry(0.95, 0.95, 0.5, 12),
        mat(0xc0c4c8, { metalness: 0.7, roughness: 0.3 }),
        x,
        12.2,
        z,
      )
      addMesh(
        new THREE.CylinderGeometry(0.92, 0.92, 1.3, 12),
        mat(0xff8fa8, { roughness: 0.8 }),
        x,
        13.1,
        z,
      )
    }
    addMesh(
      new THREE.PlaneGeometry(off * 2, 2.6),
      new THREE.MeshStandardMaterial({
        map: canvasTex(512, 64, drawBanner, { wrap: false }),
        roughness: 0.7,
        side: THREE.DoubleSide,
      }),
      p.x,
      10.6,
      p.z,
      { ry: phi + Math.PI },
    )
    const lt = canvasTex(
      160,
      32,
      (g, w, h) => {
        const s = 16
        for (let i = 0; i < w / s; i++)
          for (let j = 0; j < h / s; j++) {
            g.fillStyle = (i + j) % 2 ? '#111' : '#f5f5f5'
            g.fillRect(i * s, j * s, s, s)
          }
      },
      { wrap: false },
    )
    addMesh(
      new THREE.PlaneGeometry(HW * 2, 1.6),
      new THREE.MeshStandardMaterial({
        map: lt,
        roughness: 0.8,
        polygonOffset: true,
        polygonOffsetFactor: -3,
      }),
      p.x,
      0.05,
      p.z,
      { rx: -Math.PI / 2, ry: phi, order: 'YXZ', cast: false },
    )
  }
  function buildRamps() {
    for (const r of ramps) {
      const t = TAN[r.idx]!
      const sh = new THREE.Shape()
      sh.moveTo(0, 0)
      sh.lineTo(r.len, 0)
      sh.lineTo(r.len, r.h)
      sh.closePath()
      const geo = new THREE.ExtrudeGeometry(sh, { depth: r.w, bevelEnabled: false })
      geo.translate(-r.len / 2, 0, -r.w / 2)
      const m = addMesh(
        geo,
        [mat(0xf1e6cc, { roughness: 0.9 }), mat(r.color, { roughness: 0.55 })],
        r.x,
        0.02,
        r.z,
        { ry: Math.atan2(-t.z, t.x) },
      )
      // una franja en la tapa para que parezca un libro
      const stripe = new THREE.Mesh(B(r.len * 1.01, 0.05, 0.5), mat(0xffd23f))
      stripe.position.set(0, r.h / 2, 0)
      stripe.rotation.z = Math.atan2(r.h, r.len)
      m.add(stripe)
    }
  }

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
    for (let k = 0; k < sim.pickups.length; k++) {
      const mesh = new THREE.Mesh(pickGeo, pickMat)
      mesh.castShadow = true
      scene.add(mesh)
      pickMeshes.push(mesh)
    }
  }
  function updatePickupMeshes() {
    sim.pickups.forEach((p, k) => {
      const mesh = pickMeshes[k]!
      mesh.visible = p.active
      if (!p.active) return
      mesh.position.set(
        p.x,
        groundAt(p.x, p.z) + 1.05 + Math.sin(sim.time * 3 + p.phase) * 0.15,
        p.z,
      )
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
    P.push({ dead: true, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0, life: 0, max: 1, grav: 0 })
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
      if (p.y < 0.05 && p.grav > 0) {
        p.y = 0.05
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
        7,
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
    camDes.set(c.x - fx_ * dist, c.y * 0.7 + hh, c.z - fz_ * dist)
    if (camSnap) {
      camera.position.copy(camDes)
      camSnap = false
    }
    camera.position.lerp(camDes, 1 - Math.exp(-dt * 12))
    camera.position.y = Math.max(camera.position.y, 0.6)
    camLook.set(c.x + fx_ * 3, c.y * 0.85 + 0.9, c.z + fz_ * 3)
    camera.lookAt(camLook)
    setFov(64 + (Math.min(sp, 45) * 0.28 + (c.turbo > 0 ? 6 : 0)) * fovGain, dt)
  }

  /* ---------- armado ---------- */
  buildKitchen()
  buildTrack()
  buildCurbs()
  buildStartGate()
  buildRamps()
  buildPickups()

  const world: RallyWorld = {
    canvas,
    warnings,
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
        m.position.set(o.x, groundAt(o.x, o.z) + 0.05, o.z)
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
