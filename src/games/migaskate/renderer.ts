// Dibujo 3D de "Miga Skate" con three.js. Estilo low-poly: materiales Lambert planos, sin sombras
// reales (una mancha bajo el skater), niebla corta y resolucion adaptativa desde el controlador.
// Este modulo se carga con import() para no engordar el paquete inicial de la app.

import {
  AmbientLight,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  ExtrudeGeometry,
  Fog,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Quaternion,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  Shape,
  Vector3,
  WebGLRenderer,
} from 'three'
import { Mascot } from './mascot.ts'
import {
  heightAt,
  profileHeight,
  surfaceLength,
  type Skater,
  type Surface,
  type WorldDef,
} from './physics.ts'
import type { SpotTheme } from './spots.ts'

const MAX_PARTICLES = 48

function mulberry(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function tileTexture(base: number, line: number): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = `#${base.toString(16).padStart(6, '0')}`
  g.fillRect(0, 0, 128, 128)
  g.strokeStyle = `#${line.toString(16).padStart(6, '0')}`
  g.lineWidth = 4
  g.strokeRect(0, 0, 128, 128)
  const t = new CanvasTexture(c)
  t.wrapS = t.wrapT = RepeatWrapping
  t.colorSpace = SRGBColorSpace
  return t
}

function signTexture(): CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#c8102e'
  g.fillRect(0, 0, 512, 128)
  g.fillStyle = '#faf3e3'
  g.font = 'bold 84px "Bebas Neue", Impact, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('UNO DE MIGA', 256, 70)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

/** Perfil (altura segun la distancia) de una superficie, como forma extruible. */
function profileShape(s: Surface): Shape {
  const len = surfaceLength(s)
  const shape = new Shape()
  shape.moveTo(0, 0)
  if (s.type === 'stairs') {
    const n = s.steps ?? 6
    for (let k = 0; k < n; k++) {
      const x0 = (k / n) * len
      const x1 = ((k + 1) / n) * len
      const h = (s.height * (k + 1)) / n
      shape.lineTo(x0, h)
      shape.lineTo(x1, h)
    }
  } else if (s.type === 'quarter') {
    const samples = 14
    const curve = Math.min(len, 6)
    for (let i = 0; i <= samples; i++) {
      const a = (i / samples) * curve
      shape.lineTo(a, profileHeight(s, a))
    }
    shape.lineTo(len, s.height)
  } else {
    shape.lineTo(len, profileHeight(s, len))
  }
  shape.lineTo(len, 0)
  shape.lineTo(0, 0)
  return shape
}

const concrete = new MeshLambertMaterial({ color: 0xc4bfb4 })
const concreteDark = new MeshLambertMaterial({ color: 0xa9a49a })
const bowlMat = new MeshLambertMaterial({ color: 0xa9b1c4 })
const metal = new MeshPhongMaterial({ color: 0xdde2e8, specular: 0xffffff, shininess: 70 })
const outline = new LineBasicMaterial({ color: 0x4a4036 })

function addOutline(m: Mesh, parent: Group) {
  const lines = new LineSegments(new EdgesGeometry(m.geometry, 35), outline)
  lines.position.copy(m.position)
  lines.rotation.copy(m.rotation)
  parent.add(lines)
}

export interface SparkOptions {
  x: number
  y: number
  z: number
  count: number
  speed: number
}

export class SkateRenderer {
  private readonly renderer: WebGLRenderer
  private readonly scene = new Scene()
  private readonly camera = new PerspectiveCamera(62, 1, 0.1, 120)
  private readonly mascot = new Mascot()
  private readonly blob: Mesh
  private readonly points: Points
  private readonly positions = new Float32Array(MAX_PARTICLES * 3)
  private readonly velocities = new Float32Array(MAX_PARTICLES * 3)
  private readonly lives = new Float32Array(MAX_PARTICLES)
  private camHeading = 0
  private camInit = false
  private shake = 0
  private last = 0
  private readonly disposables: { dispose(): void }[] = []

  constructor(
    canvas: HTMLCanvasElement,
    private readonly world: WorldDef,
    theme: SpotTheme,
    private readonly reduced: boolean,
  ) {
    this.renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    })
    this.scene.background = new Color(theme.sky)
    this.scene.fog = new Fog(theme.fog, 22, 62)
    this.scene.add(new HemisphereLight(0xffffff, theme.ground, 1.15))
    this.scene.add(new AmbientLight(0xffffff, 0.25))
    const sun = new DirectionalLight(0xfff1d6, 1.1)
    sun.position.set(8, 14, -5)
    this.scene.add(sun)

    this.buildGround(theme)
    this.buildSurroundings(theme)
    this.buildObstacles()
    this.scene.add(this.mascot.group)

    this.blob = new Mesh(
      new CircleGeometry(0.55, 14),
      new MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
    )
    this.blob.rotation.x = -Math.PI / 2
    this.scene.add(this.blob)

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(this.positions, 3))
    this.points = new Points(
      geo,
      new PointsMaterial({ color: 0xffb347, size: 0.16, transparent: true, depthWrite: false }),
    )
    this.points.frustumCulled = false
    this.positions.fill(-1000)
    this.scene.add(this.points)
    this.disposables.push(geo)
  }

  private buildGround(theme: SpotTheme) {
    const { halfX, halfZ } = this.world
    const tex = tileTexture(theme.ground, theme.line)
    tex.repeat.set(halfX, halfZ)
    const floor = new Mesh(
      new PlaneGeometry(halfX * 2, halfZ * 2),
      new MeshLambertMaterial({ map: tex }),
    )
    floor.rotation.x = -Math.PI / 2
    this.scene.add(floor)
    const outer = new Mesh(
      new PlaneGeometry(260, 260),
      new MeshLambertMaterial({ color: new Color(0x8fc486) }),
    )
    outer.rotation.x = -Math.PI / 2
    outer.position.y = -0.03
    this.scene.add(outer)
    this.disposables.push(tex, floor.geometry, outer.geometry)
  }

  private buildSurroundings(theme: SpotTheme) {
    const { halfX, halfZ } = this.world
    const random = mulberry(halfX * 31 + halfZ)
    const wall = new MeshLambertMaterial({ color: theme.wall })
    const accent = new MeshLambertMaterial({ color: theme.accent })
    // Vallas bajas alrededor del mapa.
    const fence = (x: number, z: number, w: number, d: number) => {
      const m = new Mesh(new BoxGeometry(w, 0.9, d), wall)
      m.position.set(x, 0.45, z)
      this.scene.add(m)
    }
    fence(0, halfZ + 0.3, halfX * 2 + 1, 0.5)
    fence(0, -halfZ - 0.3, halfX * 2 + 1, 0.5)
    fence(halfX + 0.3, 0, 0.5, halfZ * 2 + 1)
    fence(-halfX - 0.3, 0, 0.5, halfZ * 2 + 1)
    // Edificios y arboles de fondo.
    for (let i = 0; i < 26; i++) {
      const angle = (i / 26) * Math.PI * 2
      const rx = halfX + 14 + random() * 10
      const rz = halfZ + 14 + random() * 10
      const h = 4 + random() * 7
      const b = new Mesh(
        new BoxGeometry(4 + random() * 5, h, 4 + random() * 5),
        i % 5 === 0 ? accent : wall,
      )
      b.position.set(Math.cos(angle) * rx, h / 2, Math.sin(angle) * rz)
      this.scene.add(b)
    }
    const trunk = new CylinderGeometry(0.15, 0.2, 1.4, 6)
    const crown = new ConeGeometry(1, 2.6, 7)
    const trunkMat = new MeshLambertMaterial({ color: 0x7a5230 })
    const leafMat = new MeshLambertMaterial({ color: 0x3f8f4a })
    for (let i = 0; i < 14; i++) {
      const angle = random() * Math.PI * 2
      const rx = halfX + 4 + random() * 4
      const rz = halfZ + 4 + random() * 4
      const t = new Mesh(trunk, trunkMat)
      t.position.set(Math.cos(angle) * rx, 0.7, Math.sin(angle) * rz)
      const c = new Mesh(crown, leafMat)
      c.position.set(t.position.x, 2.5, t.position.z)
      this.scene.add(t, c)
    }
    // Cartel de la casa al fondo del mapa.
    const tex = signTexture()
    const sign = new Mesh(new PlaneGeometry(9, 2.25), new MeshBasicMaterial({ map: tex }))
    sign.position.set(0, 3.2, halfZ + 0.7)
    sign.rotation.y = Math.PI
    this.scene.add(sign)
    const sign2 = sign.clone()
    sign2.position.set(0, 3.2, -halfZ - 0.7)
    sign2.rotation.y = 0
    this.scene.add(sign2)
    this.disposables.push(tex)
  }

  private buildObstacles() {
    const group = new Group()
    this.scene.add(group)
    for (const s of this.world.surfaces) {
      if (s.type === 'box') {
        const m = new Mesh(new BoxGeometry(s.w, s.height, s.d), concrete)
        m.position.set(s.x, s.height / 2, s.z)
        group.add(m)
        addOutline(m, group)
        continue
      }
      const width = s.dir === 'px' || s.dir === 'nx' ? s.d : s.w
      const geo = new ExtrudeGeometry(profileShape(s), { depth: width, bevelEnabled: false })
      const m = new Mesh(
        geo,
        s.type === 'quarter' ? bowlMat : s.type === 'stairs' ? concrete : concreteDark,
      )
      switch (s.dir) {
        case 'px':
          m.position.set(s.x - s.w / 2, 0, s.z - s.d / 2)
          break
        case 'nx':
          m.rotation.y = Math.PI
          m.position.set(s.x + s.w / 2, 0, s.z + s.d / 2)
          break
        case 'pz':
          m.rotation.y = -Math.PI / 2
          m.position.set(s.x + s.w / 2, 0, s.z - s.d / 2)
          break
        case 'nz':
          m.rotation.y = Math.PI / 2
          m.position.set(s.x - s.w / 2, 0, s.z + s.d / 2)
          break
      }
      group.add(m)
      addOutline(m, group)
    }

    const up = new Vector3(0, 1, 0)
    const a = new Vector3()
    const b = new Vector3()
    const q = new Quaternion()
    for (const r of this.world.rails) {
      if (r.ledge) {
        // La cornisa ya es un bloque: se le suma una tapa metalica fina.
        const cap = new Mesh(
          new BoxGeometry(Math.abs(r.bx - r.ax) + 0.92, 0.04, Math.abs(r.bz - r.az) + 0.92),
          metal,
        )
        cap.position.set((r.ax + r.bx) / 2, r.ay + 0.02, (r.az + r.bz) / 2)
        group.add(cap)
        continue
      }
      a.set(r.ax, r.ay, r.az)
      b.set(r.bx, r.by, r.bz)
      const dir = b.clone().sub(a)
      const len = dir.length()
      const pipe = new Mesh(new CylinderGeometry(0.045, 0.045, len, 8), metal)
      pipe.position.copy(a).addScaledVector(dir, 0.5)
      pipe.quaternion.copy(q.setFromUnitVectors(up, dir.normalize()))
      group.add(pipe)
      // Soportes: uno cada ~2 metros hasta el suelo.
      const posts = Math.max(2, Math.round(len / 2) + 1)
      for (let i = 0; i < posts; i++) {
        const t = i / (posts - 1)
        const h = r.ay + (r.by - r.ay) * t
        const post = new Mesh(new CylinderGeometry(0.035, 0.035, h, 6), concreteDark)
        post.position.set(r.ax + (r.bx - r.ax) * t, h / 2, r.az + (r.bz - r.az) * t)
        group.add(post)
      }
    }
  }

  resize(width: number, height: number, dpr: number) {
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(width, height, true)
    this.camera.aspect = width / Math.max(1, height)
    // En vertical se abre un poco el campo para ver mas del costado.
    this.camera.fov = this.camera.aspect < 1 ? 66 : 58
    // La tabla tactil tapa parte de la pantalla (abajo en vertical, a la derecha en horizontal):
    // se corre la imagen para que el skater quede en la parte libre.
    if (this.camera.aspect < 1)
      this.camera.setViewOffset(width, height, 0, height * 0.2, width, height)
    else this.camera.setViewOffset(width, height, width * 0.2, 0, width, height)
    this.camera.updateProjectionMatrix()
  }

  /** Chispas y polvo (se apagan solas). Con movimiento reducido no hace nada. */
  burst({ x, y, z, count, speed }: SparkOptions) {
    if (this.reduced) return
    let made = 0
    for (let i = 0; i < MAX_PARTICLES && made < count; i++) {
      if (this.lives[i]! > 0) continue
      this.lives[i] = 0.5 + Math.random() * 0.3
      this.positions[i * 3] = x
      this.positions[i * 3 + 1] = y
      this.positions[i * 3 + 2] = z
      this.velocities[i * 3] = (Math.random() - 0.5) * speed
      this.velocities[i * 3 + 1] = Math.random() * speed
      this.velocities[i * 3 + 2] = (Math.random() - 0.5) * speed
      made++
    }
  }

  addShake(amount: number) {
    if (!this.reduced) this.shake = Math.min(0.5, this.shake + amount)
  }

  /** Dibuja un cuadro. `steer` es el giro del dedo (-1..1). */
  render(sk: Skater, steer: number, now: number) {
    const dt = Math.min(0.1, this.last ? (now - this.last) / 1000 : 0.016)
    this.last = now
    this.mascot.update(sk, steer, now / 1000, dt)

    // Mancha de sombra pegada al suelo, mas chica y suave cuanto mas alto.
    const ground = heightAt(this.world, sk.x, sk.z)
    const up = Math.max(0, sk.y - ground)
    this.blob.position.set(sk.x, ground + 0.02, sk.z)
    const k = 1 / (1 + up * 0.7)
    this.blob.scale.setScalar(k)
    ;(this.blob.material as MeshBasicMaterial).opacity = 0.12 + 0.18 * k

    // Camara: detras y un poco al costado del lado donde mira la mascota, siguiendo el rumbo con retraso.
    if (!this.camInit) {
      this.camHeading = sk.heading
      this.camInit = true
    }
    let diff = sk.heading - this.camHeading
    diff = Math.atan2(Math.sin(diff), Math.cos(diff))
    this.camHeading += diff * Math.min(1, dt * (sk.mode === 'grind' ? 2 : 3.2))
    const fx = Math.sin(this.camHeading)
    const fz = Math.cos(this.camHeading)
    const rx = -fz
    const rz = fx
    const back = this.camera.aspect < 1 ? 7.4 : 6
    const side = 2.4
    const camY = Math.max(1.4, ground + 2.9 + up * 0.35)
    this.camera.position.set(sk.x - fx * back + rx * side, camY, sk.z - fz * back + rz * side)
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake
      this.camera.position.y += (Math.random() - 0.5) * this.shake
      this.shake *= Math.pow(0.002, dt)
    }
    this.camera.lookAt(sk.x + fx * 1.6, sk.y + 0.7 + up * 0.2, sk.z + fz * 1.6)

    this.stepParticles(dt)
    this.renderer.render(this.scene, this.camera)
  }

  private stepParticles(dt: number) {
    let any = false
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const life = this.lives[i]!
      if (life <= 0) continue
      any = true
      this.lives[i] = life - dt
      this.velocities[i * 3 + 1]! -= 9 * dt
      this.positions[i * 3]! += this.velocities[i * 3]! * dt
      this.positions[i * 3 + 1]! += this.velocities[i * 3 + 1]! * dt
      this.positions[i * 3 + 2]! += this.velocities[i * 3 + 2]! * dt
      if (this.lives[i]! <= 0) this.positions[i * 3 + 1] = -1000
    }
    if (any) this.points.geometry.attributes.position!.needsUpdate = true
  }

  get contextLost() {
    return this.renderer.getContext().isContextLost()
  }

  dispose() {
    this.scene.traverse((obj) => {
      const m = obj as Mesh
      m.geometry?.dispose?.()
    })
    for (const d of this.disposables) d.dispose()
    this.renderer.dispose()
    this.renderer.forceContextLoss()
  }
}
