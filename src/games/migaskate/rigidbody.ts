// Cuerpo rigido propio, liviano y determinista para la tabla de "Miga Skate" (el equivalente a un
// Rigidbody de Unity). Integra a paso fijo con Euler semi-implicito, tiene centro de masa desplazado
// (`comLocal`), tensor de inercia diagonal en ejes locales, drag lineal y angular, impulsos, torques
// relativos (AddRelativeTorque) e interpolacion entre el paso anterior y el actual para dibujar.

import {
  qInvRotate,
  qIdentity,
  qIntegrate,
  qRotate,
  qSlerp,
  v3,
  vAdd,
  vCross,
  vLerp,
  vScale,
  vSub,
  type Q,
  type V3,
} from './vec.ts'

export interface BodyConfig {
  mass: number
  /** Momentos de inercia principales (ejes locales X, Y, Z) en kg m^2. */
  inertia: V3
  /** Centro de masa respecto del origen de la tabla (local). Unity: Rigidbody.centerOfMass. */
  comLocal: V3
  linearDrag: number
  angularDrag: number
}

export interface BodyPose {
  position: V3
  rotation: Q
}

export class RigidBody {
  readonly mass: number
  readonly inertia: V3
  readonly comLocal: V3
  linearDrag: number
  angularDrag: number
  /** Posicion del CENTRO DE MASA en el mundo. El origen de la tabla se obtiene con `origin`. */
  com: V3 = v3()
  rotation: Q = qIdentity()
  velocity: V3 = v3()
  /** Velocidad angular en ejes de mundo (rad/s). */
  angularVelocity: V3 = v3()
  private force: V3 = v3()
  private torque: V3 = v3()
  private prevOrigin: V3 = v3()
  private prevRotation: Q = qIdentity()

  constructor(config: BodyConfig) {
    this.mass = config.mass
    this.inertia = config.inertia
    this.comLocal = config.comLocal
    this.linearDrag = config.linearDrag
    this.angularDrag = config.angularDrag
  }

  /** Origen de la tabla en el mundo (el pivote del modelo): com - R * comLocal. */
  get origin(): V3 {
    return vSub(this.com, qRotate(this.rotation, this.comLocal))
  }

  setPose(origin: V3, rotation: Q) {
    this.rotation = rotation
    this.com = vAdd(origin, qRotate(rotation, this.comLocal))
    this.snapshot()
  }

  /** Mueve el cuerpo sin tocar el paso anterior (control cinematico, p. ej. sobre un riel). */
  moveTo(origin: V3, rotation: Q) {
    this.rotation = rotation
    this.com = vAdd(origin, qRotate(rotation, this.comLocal))
  }

  toWorld(local: V3): V3 {
    return vAdd(this.origin, qRotate(this.rotation, local))
  }

  /** Transform.InverseTransformDirection: lleva un vector de mundo a los ejes locales de la tabla. */
  toLocalDirection(world: V3): V3 {
    return qInvRotate(this.rotation, world)
  }

  toWorldDirection(local: V3): V3 {
    return qRotate(this.rotation, local)
  }

  /** Velocidad lineal de un punto del cuerpo (v + w x r respecto del centro de masa). */
  pointVelocity(worldPoint: V3): V3 {
    return vAdd(this.velocity, vCross(this.angularVelocity, vSub(worldPoint, this.com)))
  }

  addForce(f: V3) {
    this.force = vAdd(this.force, f)
  }

  /** AddForceAtPosition: la fuerza aplicada fuera del centro de masa tambien genera torque. */
  addForceAtPoint(f: V3, worldPoint: V3) {
    this.force = vAdd(this.force, f)
    this.torque = vAdd(this.torque, vCross(vSub(worldPoint, this.com), f))
  }

  addTorque(t: V3) {
    this.torque = vAdd(this.torque, t)
  }

  /** AddRelativeTorque: torque en ejes locales (N m). */
  addRelativeTorque(local: V3) {
    this.torque = vAdd(this.torque, qRotate(this.rotation, local))
  }

  /** Cambio de velocidad lineal instantaneo (ForceMode.VelocityChange). */
  addVelocityChange(dv: V3) {
    this.velocity = vAdd(this.velocity, dv)
  }

  /** Impulso lineal (ForceMode.Impulse): dv = J / m. */
  addImpulse(j: V3) {
    this.velocity = vAdd(this.velocity, vScale(j, 1 / this.mass))
  }

  /** Cambio de velocidad angular instantaneo en ejes de mundo (rad/s). */
  addAngularVelocityChange(dw: V3) {
    this.angularVelocity = vAdd(this.angularVelocity, dw)
  }

  /** Impulso angular local (AddRelativeTorque con ForceMode.Impulse): dw = I^-1 * L. */
  addRelativeAngularImpulse(local: V3) {
    const dw = v3(local.x / this.inertia.x, local.y / this.inertia.y, local.z / this.inertia.z)
    this.angularVelocity = vAdd(this.angularVelocity, qRotate(this.rotation, dw))
  }

  /** Velocidad angular expresada en ejes locales (lo que mide un giroscopo pegado a la tabla). */
  get localAngularVelocity(): V3 {
    return qInvRotate(this.rotation, this.angularVelocity)
  }

  snapshot() {
    this.prevOrigin = this.origin
    this.prevRotation = this.rotation
  }

  /**
   * Un paso de `dt` segundos. Las fuerzas y torques acumulados se consumen. La orientacion se puede
   * integrar en `angularSteps` tramos; despues de cada uno se llama a `onAngularStep` (que puede
   * reescribir la velocidad angular). Sirve para giros rapidos con ejes que se mueven.
   */
  integrate(dt: number, angularSteps = 1, onAngularStep?: () => void) {
    // Lineal.
    this.velocity = vAdd(this.velocity, vScale(this.force, dt / this.mass))
    this.velocity = vScale(this.velocity, 1 / (1 + this.linearDrag * dt))
    // Angular: el torque se pasa a ejes locales, se divide por la inercia y se vuelve a mundo.
    const tl = qInvRotate(this.rotation, this.torque)
    const al = v3(tl.x / this.inertia.x, tl.y / this.inertia.y, tl.z / this.inertia.z)
    this.angularVelocity = vAdd(this.angularVelocity, vScale(qRotate(this.rotation, al), dt))
    this.angularVelocity = vScale(this.angularVelocity, 1 / (1 + this.angularDrag * dt))
    // Posicion y orientacion.
    this.com = vAdd(this.com, vScale(this.velocity, dt))
    for (let i = 0; i < angularSteps; i++) {
      this.rotation = qIntegrate(this.rotation, this.angularVelocity, dt / angularSteps)
      onAngularStep?.()
    }
    this.force = v3()
    this.torque = v3()
  }

  /** Pose interpolada entre el paso anterior y el actual (alpha 0..1) para dibujar sin tirones. */
  interpolated(alpha: number): BodyPose {
    const a = Math.max(0, Math.min(1, alpha))
    return {
      position: vLerp(this.prevOrigin, this.origin, a),
      rotation: qSlerp(this.prevRotation, this.rotation, a),
    }
  }
}
