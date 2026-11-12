// SkateCamera: camara desacoplada de la tabla. TypeScript puro (devuelve posicion, punto de mira y fov; el
// renderer solo los copia a la camara de three.js). Sigue la posicion de la tabla con SmoothDamp y rota
// SOLO en el eje Y hacia el vector velocidad (no hacia la orientacion de la tabla: los flips y los
// shove-its no la marean), con anticipacion y un limite de velocidad angular.

import { clamp, v3, wrapPi, type V3 } from './vec.ts'

/** Smooth damping critico tipo Unity (Mathf.SmoothDamp). `vel` guarda la velocidad entre llamadas. */
export function smoothDamp(
  current: number,
  target: number,
  vel: { v: number },
  smoothTime: number,
  maxSpeed: number,
  dt: number,
): number {
  const st = Math.max(0.0001, smoothTime)
  const omega = 2 / st
  const x = omega * dt
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const maxChange = maxSpeed * st
  const change = clamp(current - target, -maxChange, maxChange)
  const originalTo = target
  const t = current - change
  const temp = (vel.v + omega * change) * dt
  vel.v = (vel.v - omega * temp) * e
  let out = t + (change + temp) * e
  // Evita pasarse del objetivo.
  if (originalTo - current > 0 === out > originalTo) {
    out = originalTo
    vel.v = (out - originalTo) / dt
  }
  return out
}

export function smoothDampAngle(
  current: number,
  target: number,
  vel: { v: number },
  smoothTime: number,
  maxSpeed: number,
  dt: number,
): number {
  return smoothDamp(current, current + wrapPi(target - current), vel, smoothTime, maxSpeed, dt)
}

export interface CameraTarget {
  position: V3
  velocity: V3
  /** El jugador esta en el suelo, en el aire, en un riel o cayendose (para la altura y el mirar). */
  state: string
}

export interface CameraOptions {
  reduced: boolean
  portrait: boolean
}

export interface CameraPose {
  position: V3
  lookAt: V3
  fov: number
}

/** Velocidad angular maxima del giro de la camara (rad/s); con movimiento reducido es mas lenta. */
export const MAX_YAW_RATE = 2.4
export const MAX_YAW_RATE_REDUCED = 0.9

export class SkateCamera {
  yaw = 0
  private focus = v3()
  private readonly vx = { v: 0 }
  private readonly vy = { v: 0 }
  private readonly vz = { v: 0 }
  private readonly vyaw = { v: 0 }
  private ready = false
  private shakeAmp = 0
  private shakePhase = 0
  private lastYaw = 0
  /** Velocidad angular real del ultimo cuadro (rad/s), para vigilar que no maree. */
  yawRate = 0

  constructor(private readonly options: CameraOptions) {}

  setOptions(options: Partial<CameraOptions>) {
    Object.assign(this.options, options)
  }

  /** Sacudida de camara (se amortigua sola). No hace nada con movimiento reducido. */
  shake(amount: number) {
    if (!this.options.reduced) this.shakeAmp = Math.min(0.5, this.shakeAmp + amount)
  }

  snapTo(target: CameraTarget) {
    this.yaw = Math.atan2(target.velocity.x, target.velocity.z)
    this.focus = { ...target.position }
    this.vx.v = this.vy.v = this.vz.v = this.vyaw.v = 0
    this.ready = true
  }

  update(dt: number, target: CameraTarget): CameraPose {
    if (!this.ready) this.snapTo(target)
    const reduced = this.options.reduced
    const step = clamp(dt, 0.0001, 0.1)
    const hv = Math.hypot(target.velocity.x, target.velocity.z)

    // Rumbo: hacia la velocidad (si hay), con SmoothDamp y tope de velocidad angular.
    if (hv > 1.2 && target.state !== 'bailed') {
      const maxRate = reduced ? MAX_YAW_RATE_REDUCED : MAX_YAW_RATE
      const want = Math.atan2(target.velocity.x, target.velocity.z)
      const prev = this.yaw
      const next = smoothDampAngle(this.yaw, want, this.vyaw, reduced ? 0.7 : 0.4, maxRate, step)
      // Tope duro: nunca mas de `maxRate` rad/s aunque haya un cambio brusco de velocidad.
      const d = clamp(wrapPi(next - prev), -maxRate * step, maxRate * step)
      this.yaw = prev + d
    } else {
      this.vyaw.v *= Math.pow(0.05, step)
    }
    this.yawRate = wrapPi(this.yaw - this.lastYaw) / step
    this.lastYaw = this.yaw

    // Anticipacion: mira un poco por delante de la tabla segun la velocidad.
    const ahead = 0.18
    const tx = target.position.x + clamp(target.velocity.x * ahead, -1.4, 1.4)
    const tz = target.position.z + clamp(target.velocity.z * ahead, -1.4, 1.4)
    const follow = reduced ? 0.26 : 0.14
    this.focus.x = smoothDamp(this.focus.x, tx, this.vx, follow, 60, step)
    this.focus.z = smoothDamp(this.focus.z, tz, this.vz, follow, 60, step)
    // En vertical es mas lenta: las rampas y los saltos no hacen cabecear la imagen.
    this.focus.y = smoothDamp(
      this.focus.y,
      target.position.y,
      this.vy,
      reduced ? 0.45 : 0.28,
      40,
      step,
    )

    const fx = Math.sin(this.yaw)
    const fz = Math.cos(this.yaw)
    const back = this.options.portrait ? 7.4 : 6
    const side = 2.4
    const rx = -fz
    const rz = fx
    const pos = v3(
      this.focus.x - fx * back + rx * side,
      Math.max(1.4, this.focus.y + 2.7),
      this.focus.z - fz * back + rz * side,
    )
    const look = v3(this.focus.x + fx * 1.6, this.focus.y + 0.75, this.focus.z + fz * 1.6)

    if (this.shakeAmp > 0.001) {
      this.shakePhase += step * 61
      pos.x += Math.sin(this.shakePhase * 1.7) * this.shakeAmp * 0.5
      pos.y += Math.sin(this.shakePhase * 2.3 + 1) * this.shakeAmp * 0.5
      this.shakeAmp *= Math.pow(0.002, step)
    }

    const base = this.options.portrait ? 66 : 58
    const fov = reduced ? base : base + clamp(hv * 0.35, 0, 4)
    return { position: pos, lookAt: look, fov }
  }
}
