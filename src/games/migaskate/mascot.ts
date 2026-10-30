// La mascota de Uno de Miga en 3D, armada con primitivas de three.js (sin modelos que descargar):
// un sanguche de miga con carita sonriente, relleno de jamon y rucula a la vista, brazos y piernas
// plateados y zapatillas plateadas. Brazos y piernas se acomodan con IK de dos huesos para que sigan
// a la tabla y a las manos sin trucos preprogramados.

import {
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  MeshPhongMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import type { Skater } from './physics.ts'

const UP = new Vector3(0, 1, 0)
const Y_AXIS = new Vector3(0, 1, 0)

/** El pecho mira hacia la derecha y un poco atras: asi la cara se ve desde la camara. */
const STANCE = -1.85
const BOARD_Y = 0.1
const HIP_Y = 0.56
const LEG = 0.34
const ARM = 0.26
const CAP_R_LEG = 0.055
const CAP_R_ARM = 0.048

const cream = new MeshLambertMaterial({ color: 0xf6e8cb })
const silver = new MeshPhongMaterial({ color: 0xcfd4da, specular: 0xffffff, shininess: 90 })
const ham = new MeshLambertMaterial({ color: 0xe88b86 })
const cheese = new MeshLambertMaterial({ color: 0xfff2d2 })
const green = new MeshLambertMaterial({ color: 0x4f9a3a })
const white = new MeshLambertMaterial({ color: 0xffffff })
const iris = new MeshLambertMaterial({ color: 0x5d6f8c })
const dark = new MeshLambertMaterial({ color: 0x2a2320 })
const brow = new MeshLambertMaterial({ color: 0x5a4a3a })
const mouthRed = new MeshLambertMaterial({ color: 0x8e1c2c })
const tongue = new MeshLambertMaterial({ color: 0xe46b7a })
const deck = new MeshLambertMaterial({ color: 0xc8102e })
const deckTop = new MeshLambertMaterial({ color: 0x2a2320 })
const wheelMat = new MeshLambertMaterial({ color: 0xfaf3e3 })

function mesh(geometry: BufferGeometry, material: Material, parent: Group) {
  const m = new Mesh(geometry, material)
  parent.add(m)
  return m
}

const tmpA = new Vector3()
const tmpB = new Vector3()
const tmpQ = new Quaternion()

/** Estira una capsula (vertical, de largo `base`) entre dos puntos. */
function place(m: Mesh, a: Vector3, b: Vector3, base: number) {
  tmpA.subVectors(b, a)
  const len = Math.max(0.001, tmpA.length())
  m.position.copy(a).addScaledVector(tmpA, 0.5)
  m.quaternion.copy(tmpQ.setFromUnitVectors(UP, tmpA.divideScalar(len)))
  m.scale.set(1, len / base, 1)
}

/** IK de dos huesos: devuelve la rodilla (o el codo) entre `a` y `b`, doblada hacia `pole`. */
function joint(a: Vector3, b: Vector3, l1: number, l2: number, pole: Vector3, out: Vector3) {
  tmpA.subVectors(b, a)
  const dist = Math.min(Math.max(tmpA.length(), 0.02), l1 + l2 - 0.002)
  tmpA.normalize()
  const x = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist)
  const h = Math.sqrt(Math.max(l1 * l1 - x * x, 0))
  tmpB.copy(pole).addScaledVector(tmpA, -pole.dot(tmpA))
  if (tmpB.lengthSq() < 1e-6) tmpB.set(0, 0, 1)
  tmpB.normalize()
  return out.copy(a).addScaledVector(tmpA, x).addScaledVector(tmpB, h)
}

interface Limb {
  upper: Mesh
  lower: Mesh
  end: Mesh
  elbow: Vector3
}

const easeOut = (t: number) => 1 - (1 - t) * (1 - t)

export class Mascot {
  readonly group = new Group()
  private readonly board = new Group()
  private readonly body = new Group()
  private readonly mouth: Mesh
  private readonly arms: Limb[] = []
  private readonly legs: Limb[] = []
  private grabAmount = 0
  private slideYaw = 0
  private crouch = 0
  private lean = 0

  constructor() {
    this.group.add(this.board, this.body)
    this.buildBoard()
    this.mouth = this.buildBody()
    for (let i = 0; i < 2; i++) {
      this.legs.push(this.buildLimb(LEG, CAP_R_LEG, true))
      this.arms.push(this.buildLimb(ARM, CAP_R_ARM, false))
    }
  }

  private buildBoard() {
    const d = new RoundedBoxGeometry(0.22, 0.03, 0.82, 2, 0.015)
    mesh(d, deck, this.board).position.y = 0.0
    const grip = new BoxGeometry(0.2, 0.006, 0.78)
    mesh(grip, deckTop, this.board).position.y = 0.018
    // Nariz y cola levantadas.
    for (const z of [-0.43, 0.43]) {
      const kick = mesh(new RoundedBoxGeometry(0.22, 0.03, 0.12, 2, 0.015), deck, this.board)
      kick.position.set(0, 0.02, z)
      kick.rotation.x = z > 0 ? -0.35 : 0.35
    }
    const wheel = new SphereGeometry(0.05, 8, 6)
    for (const z of [-0.27, 0.27]) {
      for (const x of [-0.1, 0.1]) {
        const w = mesh(wheel, wheelMat, this.board)
        w.position.set(x, -0.045, z)
        w.scale.set(0.6, 1, 1)
      }
    }
  }

  private buildBody(): Mesh {
    const b = this.body
    // Dos rebanadas de miga con el relleno al medio. La de atras es plateada, como en la mascota.
    mesh(new RoundedBoxGeometry(0.62, 0.72, 0.1, 3, 0.07), silver, b).position.set(0, 0, -0.1)
    const frontSlice = mesh(new RoundedBoxGeometry(0.62, 0.72, 0.1, 3, 0.07), cream, b)
    frontSlice.position.set(0, 0, 0.1)
    mesh(new BoxGeometry(0.6, 0.68, 0.07), ham, b).position.set(0, 0, -0.01)
    mesh(new BoxGeometry(0.61, 0.69, 0.025), cheese, b).position.set(0, 0, 0.04)
    // Rucula y jamon asomando por los costados.
    for (let i = 0; i < 6; i++) {
      const leaf = mesh(new BoxGeometry(0.07, 0.1, 0.12), green, b)
      leaf.position.set(i % 2 ? -0.31 : 0.31, -0.28 + i * 0.1, -0.02 + (i % 3) * 0.015)
      leaf.rotation.z = (i - 2.5) * 0.18
    }
    for (let i = 0; i < 3; i++) {
      const slice = mesh(new BoxGeometry(0.05, 0.16, 0.1), ham, b)
      slice.position.set(-0.315, -0.2 + i * 0.22, 0.02)
    }
    // Cara sobre la rebanada de adelante.
    const faceZ = 0.155
    for (const x of [-0.14, 0.14]) {
      const eye = mesh(new SphereGeometry(1, 12, 8), white, b)
      eye.scale.set(0.075, 0.1, 0.025)
      eye.position.set(x, 0.1, faceZ)
      const pupil = mesh(new SphereGeometry(1, 8, 6), iris, b)
      pupil.scale.set(0.042, 0.052, 0.02)
      pupil.position.set(x * 0.93, 0.09, faceZ + 0.018)
      const dot = mesh(new SphereGeometry(1, 6, 4), dark, b)
      dot.scale.set(0.02, 0.026, 0.01)
      dot.position.set(x * 0.93, 0.09, faceZ + 0.036)
      const eyebrow = mesh(new BoxGeometry(0.15, 0.028, 0.02), brow, b)
      eyebrow.position.set(x, 0.225, faceZ + 0.005)
      eyebrow.rotation.z = x < 0 ? 0.18 : -0.18
    }
    const mouth = mesh(new CircleGeometry(0.13, 16, Math.PI, Math.PI), mouthRed, b)
    mouth.position.set(0, -0.06, faceZ + 0.004)
    const teeth = mesh(new BoxGeometry(0.24, 0.03, 0.006), white, b)
    teeth.position.set(0, -0.062, faceZ + 0.008)
    const tongueMesh = mesh(new SphereGeometry(1, 8, 6), tongue, b)
    tongueMesh.scale.set(0.06, 0.03, 0.01)
    tongueMesh.position.set(0, -0.15, faceZ + 0.01)
    return mouth
  }

  private buildLimb(length: number, radius: number, leg: boolean): Limb {
    const geo = new CapsuleGeometry(radius, length - radius * 2, 3, 8)
    const upper = new Mesh(geo, silver)
    const lower = new Mesh(geo, silver)
    this.group.add(upper, lower)
    let end: Mesh
    if (leg) {
      end = new Mesh(new RoundedBoxGeometry(0.15, 0.09, 0.27, 2, 0.04), silver)
    } else {
      end = new Mesh(new SphereGeometry(0.075, 10, 8), silver)
    }
    this.group.add(end)
    return { upper, lower, end, elbow: new Vector3() }
  }

  /** Acomoda todo segun el estado de la fisica. `time` en segundos. */
  update(sk: Skater, steer: number, time: number, dt: number) {
    const { board, body } = this
    const air = sk.mode === 'air'
    const grind = sk.mode === 'grind'
    const bail = sk.mode === 'bail'
    const bailP = bail ? 1 - Math.max(0, sk.bailT) / 1.15 : 0

    this.group.position.set(sk.x, sk.y, sk.z)
    this.group.rotation.set(0, sk.heading, 0)
    // Inclinacion al doblar.
    this.lean += (steer * 0.22 - this.lean) * Math.min(1, dt * 8)
    this.group.rotation.z = bail ? 0 : -this.lean

    // --- Tabla ---
    let pitch = 0
    if (sk.manual)
      pitch = sk.manual.bal * 0.5 * (sk.manual.nose ? -1 : 1) + (sk.manual.nose ? 0.18 : -0.18)
    else if (sk.popped && air) {
      const t = Math.min(sk.popAge / 0.45, 1)
      pitch = 0.5 * Math.sin(Math.PI * t) * (sk.nollie ? -1 : 1)
    }
    if (grind) pitch = 0.08
    const slideTarget = grind && sk.grind?.kind === 'boardslide' ? Math.PI / 2 : 0
    this.slideYaw += (slideTarget - this.slideYaw) * Math.min(1, dt * 14)
    board.rotation.set(-pitch, sk.yaw + this.slideYaw, sk.roll, 'YXZ')
    board.position.set(0, BOARD_Y + (air ? 0.02 : 0), 0)
    if (bail) {
      board.position.z = 0.9 * easeOut(bailP)
      board.position.y = BOARD_Y + 0.05 * Math.sin(bailP * Math.PI)
      board.rotation.set(0.3, bailP * 7, bailP * 4, 'YXZ')
    }

    // --- Cuerpo ---
    const speed = Math.min(1, Math.abs(sk.speed) / 9)
    const targetCrouch = air ? (sk.vy > 0 ? 0.25 : 0.5) : grind ? 0.45 : 0.25 + speed * 0.15
    this.crouch += (targetCrouch - this.crouch) * Math.min(1, dt * 10)
    const hipY = HIP_Y - 0.12 * this.crouch
    const bodyY = hipY + 0.36
    body.position.set(0, bodyY, 0)
    const tilt = sk.manual ? -sk.manual.bal * 0.25 : 0
    body.rotation.set(0.12 + tilt + (air ? 0.05 : 0), STANCE + sk.spin, 0, 'YXZ')
    // Cara contenta: la sonrisa se agranda en el aire y se achica un poco al caerse.
    this.mouth.scale.set(1, air || grind ? 1.45 : bail ? 0.7 : 1, 1)

    if (bail) {
      body.position.y = bodyY - 0.45 * easeOut(Math.min(1, bailP * 1.6))
      body.position.z = -0.25 * bailP
      body.rotation.set(
        -1.3 * easeOut(Math.min(1, bailP * 1.4)) + Math.sin(bailP * 9) * 0.2,
        STANCE + bailP * 2,
        Math.sin(bailP * 6) * 0.5 * (1 - bailP),
        'YXZ',
      )
    } else {
      body.position.z = 0
    }

    // --- Pies: se quedan donde estan aunque la tabla gire (flips y shove-its pasan por debajo) ---
    const footY = BOARD_Y + 0.045 + (air ? 0.02 : 0)
    const footFront = new Vector3(0, footY, 0.22 - (grind ? 0.02 : 0))
    const footBack = new Vector3(0, footY, -0.22)
    if (pitch !== 0) {
      for (const f of [footFront, footBack]) f.applyAxisAngle(new Vector3(1, 0, 0), -pitch)
    }
    if (bail) {
      const spread = 0.35 * easeOut(bailP)
      footFront.set(0.2 + spread, 0.22 * (1 - bailP) + 0.1, 0.35 + spread)
      footBack.set(-0.2 - spread, 0.18 * (1 - bailP) + 0.1, -0.1 - spread * 0.5)
    }
    const hipBase = new Vector3(0, bodyY - 0.36, 0)
    const hipOffset = new Vector3(0, 0, 0)
    const legs: [Limb, Vector3][] = [
      [this.legs[0]!, footFront],
      [this.legs[1]!, footBack],
    ]
    const pole = new Vector3()
    const hip = new Vector3()
    const knee = new Vector3()
    legs.forEach(([limb, foot], i) => {
      // La cadera sigue al cuerpo (que puede estar girado).
      hipOffset.set(i === 0 ? 0.13 : -0.13, 0, 0).applyAxisAngle(Y_AXIS, body.rotation.y)
      hip.copy(hipBase).add(hipOffset)
      if (bail) hip.y = body.position.y - 0.36
      pole.set(0, 0.2, 1)
      joint(hip, foot, LEG, LEG, pole, knee)
      place(limb.upper, hip, knee, LEG)
      place(limb.lower, knee, foot, LEG)
      limb.end.position.set(foot.x, foot.y + 0.03, foot.z + 0.03)
      limb.end.rotation.set(-pitch, 0, 0)
    })

    // --- Manos ---
    const swing = Math.sin(time * 9) * 0.5 * speed
    const grabbing = sk.grab !== null
    this.grabAmount += ((grabbing ? 1 : 0) - this.grabAmount) * Math.min(1, dt * 16)
    const shoulderY = bodyY + 0.16
    const shoulderBase = new Vector3()
    const hand = new Vector3()
    const rest = new Vector3()
    this.arms.forEach((limb, i) => {
      const side = i === 0 ? 1 : -1
      shoulderBase.set(0.36 * side, 0, 0).applyAxisAngle(Y_AXIS, body.rotation.y)
      shoulderBase.y = shoulderY - 0.0
      if (bail) shoulderBase.y = body.position.y + 0.16
      const shoulder = shoulderBase
      if (air) {
        // Brazos arriba y abiertos para equilibrar.
        rest.set(0.5 * side, shoulderY + 0.12, 0.05 + 0.1 * side)
      } else if (grind) {
        rest.set(0.46 * side, shoulderY - 0.1, 0.05 * side)
      } else {
        rest.set(0.44 * side, shoulderY - 0.12 + swing * 0.15 * side, 0.32 * side + swing * 0.2)
      }
      if (bail) {
        rest.set(0.5 * side, shoulderBase.y + 0.2 + Math.sin(bailP * 14 + side) * 0.15, 0.2 * side)
      }
      hand.copy(rest)
      if (this.grabAmount > 0.01 && !bail) {
        // La mano que agarra va al canto de la tabla.
        const target = new Vector3(0.12 * side, BOARD_Y + 0.05, 0.12 * side)
        hand.lerp(target, this.grabAmount * (i === 0 ? 1 : 0.15))
      }
      pole.set(0.6 * side, -0.4, -0.2)
      joint(shoulder, hand, ARM, ARM, pole, knee)
      place(limb.upper, shoulder, knee, ARM)
      place(limb.lower, knee, hand, ARM)
      limb.end.position.copy(hand)
    })
  }
}
