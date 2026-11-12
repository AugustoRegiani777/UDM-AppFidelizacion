// SkateJuice: el "game feel". Se suscribe a los hooks de la fisica (OnPop, OnLand, OnGrindStart,
// OnGrindStay y los demas) y los conecta con audio procedural, particulas livianas (chispas, polvo,
// estela), squash/stretch de la mascota, vibracion haptica, sacudida de camara, un leve hit-stop y el
// desgaste de los rieles (el brillo del material de cada riel). TypeScript puro: todo sale por `sinks`,
// asi se prueba con espias y el renderer/DOM solo implementan la interfaz.

import type { SkatePhysics, SkaterView } from './skatePhysics.ts'

export interface ParticleBurst {
  x: number
  y: number
  z: number
  count: number
  speed: number
  kind: 'spark' | 'dust'
}

export interface JuiceSinks {
  sfx: {
    pop(power: number): void
    land(intensity: number, sloppy: boolean): void
    flip(): void
    grind(): void
    grindLoop(speed: number): void
    grab(): void
    bump(): void
    bail(): void
    push(): void
    catch(): void
  }
  /** Vibracion (navigator.vibrate donde exista). */
  haptic(pattern: number | number[]): void
  particles: {
    burst(b: ParticleBurst): void
    trail(x: number, y: number, z: number): void
  }
  shake(amount: number): void
  /** Congela el juego esta cantidad de milisegundos (hit-stop). */
  hitStop(ms: number): void
}

export interface JuiceOptions {
  /** prefers-reduced-motion: sin sacudidas, hit-stop ni chispas de adorno. */
  reduced: boolean
}

export class SkateJuice {
  /** Estiramiento (+) o aplastamiento (-) de la mascota, -1..1. */
  squash = 0
  /** Desgaste/brillo por riel (0..1): el renderer lo usa para teñir el material del riel. */
  readonly railWear: Float32Array
  private sparkClock = 0
  private loopClock = 0
  private trailClock = 0
  private readonly off: (() => void)[] = []

  constructor(
    private readonly physics: SkatePhysics,
    private readonly sinks: JuiceSinks,
    private readonly options: JuiceOptions,
  ) {
    this.railWear = new Float32Array(physics.world.rails.length)
    const { sfx, particles } = sinks
    const reduced = options.reduced

    this.off.push(
      physics.onPop((e) => {
        sfx.pop(e.power)
        sinks.haptic(8)
        if (!reduced) this.squash = 0.25 + 0.3 * e.power
        const o = physics.body.origin
        particles.burst({ x: o.x, y: o.y - 0.08, z: o.z, count: 2, speed: 1, kind: 'dust' })
      }),
      physics.onLand((e) => {
        const intensity = Math.max(0.1, Math.min(1, e.impact / 10))
        sfx.land(intensity, e.quality === 'sloppy')
        if (!reduced) this.squash = -0.45 * intensity
        particles.burst({
          x: e.x,
          y: e.y + 0.04,
          z: e.z,
          count: Math.round(3 + 8 * intensity),
          speed: 1.2 + intensity,
          kind: 'dust',
        })
        sinks.haptic(e.quality === 'sloppy' ? 14 : Math.round(8 + 18 * intensity))
        if (e.hard) {
          sinks.shake(0.15)
          if (!reduced) sinks.hitStop(45)
        }
      }),
      physics.onGrindStart((e) => {
        sfx.grind()
        sinks.haptic(12)
        particles.burst({
          x: e.x,
          y: e.y,
          z: e.z,
          count: reduced ? 2 : 6,
          speed: 1.6,
          kind: 'spark',
        })
      }),
      physics.onGrindStay((e) => {
        const dt = 1 / 120
        this.sparkClock += dt
        this.loopClock += dt
        const rail = physics.grind?.rail
        if (rail !== undefined) {
          this.railWear[rail] = Math.min(1, this.railWear[rail]! + dt * 0.35)
        }
        if (this.sparkClock >= 0.05) {
          this.sparkClock = 0
          particles.burst({
            x: e.x,
            y: e.y,
            z: e.z,
            count: reduced ? 1 : 2,
            speed: 1.2,
            kind: 'spark',
          })
        }
        if (this.loopClock >= 0.16) {
          this.loopClock = 0
          sfx.grindLoop(e.speed)
          sinks.haptic(5)
        }
      }),
      physics.on('flip', () => sfx.flip()),
      physics.on('grabStart', () => sfx.grab()),
      physics.on('push', () => sfx.push()),
      physics.on('catch', () => {
        sfx.catch()
        sinks.haptic(6)
      }),
      physics.on('bump', (e) => {
        sfx.bump()
        sinks.shake(Math.min(0.2, 0.05 + e.speed * 0.015))
        sinks.haptic(10)
      }),
      physics.on('bail', () => {
        sfx.bail()
        sinks.shake(0.2)
        sinks.haptic([20, 30, 20])
      }),
    )
  }

  /** Una vez por cuadro dibujado: apaga el squash, desgasta/enfria los rieles y suelta la estela. */
  update(dt: number, view: SkaterView) {
    this.squash += (0 - this.squash) * Math.min(1, dt * 12)
    if (Math.abs(this.squash) < 0.002) this.squash = 0
    for (let i = 0; i < this.railWear.length; i++) {
      if (this.railWear[i]! > 0) this.railWear[i] = Math.max(0, this.railWear[i]! - dt * 0.05)
    }
    if (this.options.reduced) return
    this.trailClock += dt
    const flashy =
      view.airborne &&
      (this.physics.rollTarget !== 0 || this.physics.yawTarget !== 0 || view.speed > 6)
    if (flashy && this.trailClock >= 0.03) {
      this.trailClock = 0
      this.sinks.particles.trail(view.position.x, view.position.y, view.position.z)
    }
  }

  dispose() {
    for (const off of this.off) off()
    this.off.length = 0
  }
}
