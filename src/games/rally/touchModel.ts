// Rally de Cocina: modelo de los controles táctiles (sin DOM, para poder probarlo y simularlo).
//
// Dos esquemas a elegir en el menú:
//  - "Un pulgar" (`one`): la mitad izquierda es UNA superficie. La posición vertical ABSOLUTA del pulgar
//    elige el pedal (arriba = acelerar, abajo = frenar / marcha atrás; la línea es PEDAL_SPLIT) y el
//    desplazamiento horizontal respecto de donde apoyó dobla (origen flotante, proporcional, con rampa).
//    Derecha: botones de ítem y freno de mano.
//  - "Dos pulgares" (`two`): la mitad izquierda solo dirección (igual que arriba) y la derecha son los
//    pedales (misma línea). El ítem y el freno de mano van en una columna sobre el borde derecho.
// Sin tocar los pedales = punto muerto (sin acelerar, frenado suave automático). Frenar + doblar = derrape.

export type Scheme = 'one' | 'two'
export type ActionButton = 'item' | 'handbrake'
export type TouchButton = ActionButton
export type Pedal = 'gas' | 'brake' | 'none'

/** Fracción desde ARRIBA de la superficie de pedales donde empieza el freno: arriba acelera, abajo frena. */
export const PEDAL_SPLIT = 0.6

export interface PadConfig {
  scheme: Scheme
  /** Multiplica el giro por desplazamiento (0.75 suave, 1 normal, 1.3 alto). */
  sensitivity: number
  /** Desplazamiento horizontal de referencia, en px: con ~0,85 de esto el giro ya es total. */
  radius: number
}

export const DEFAULT_PAD_CONFIG: PadConfig = { scheme: 'one', sensitivity: 1, radius: 58 }

/** Constantes de ajuste (ver docs/RALLY-CONTROLES.md). Las distancias de giro son fracciones del radio. */
export interface Tuning {
  steerDeadEnter: number
  steerDeadExit: number
  steerFull: number
  steerCurve: number
  follow: number
  rise: number
  fall: number
  pedalHyst: number
  idleBrake: number
  driftMin: number
  driftBrake: number
  driftDuty: number
  driftHz: number
}

export const TUNING: Tuning = {
  /** Zona muerta del giro: al entrar y al salir (histéresis). */
  steerDeadEnter: 0.16,
  steerDeadExit: 0.11,
  /** Desplazamiento con el que el giro llega al máximo. */
  steerFull: 0.85,
  /** Forma de la curva del giro (1 = lineal; más alto = más fino cerca del centro). */
  steerCurve: 1,
  /** Si el pulgar se aleja más de esto, el origen lo sigue. */
  follow: 1.25,
  /** Velocidades de la rampa del giro, en unidades de volante por segundo. */
  rise: 9,
  fall: 14,
  /** Histéresis de la línea de pedales, en px. */
  pedalHyst: 8,
  /** Frenado suave automático en punto muerto (0..1 del freno). */
  idleBrake: 0.12,
  /** Derrape: frenar con giro mayor a `driftMin`. Freno reducido y freno de mano pulsado (duty). */
  driftMin: 0.3,
  driftBrake: 0.2,
  driftDuty: 0.25,
  driftHz: 10,
}

export interface TouchState {
  throttle: number
  brake: number
  /** > 0 dobla a la izquierda, < 0 a la derecha (igual que el teclado de la demo). Analógico. */
  steer: number
  handbrake: boolean
  /** Verdadero mientras el botón del ítem está apretado. */
  useItem: boolean
  /** Ningún pedal tocado: punto muerto. */
  idle: boolean
  /** Frenando y doblando a la vez. */
  drift: boolean
}

export const EMPTY_TOUCH: TouchState = {
  throttle: 0,
  brake: 0,
  steer: 0,
  handbrake: false,
  useItem: false,
  idle: false,
  drift: false,
}

export interface Rect {
  left: number
  top: number
  right: number
  bottom: number
}
export interface Point {
  x: number
  y: number
}
export type Surface = 'left' | 'right'

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v)

/** En punto muerto (sin pedales) y andando hacia adelante, frena suave. Lo usa el juego sobre el Control final. */
export function withIdleBrake<T extends { throttle: number; brake: number }>(
  control: T,
  touch: Pick<TouchState, 'idle'>,
  forwardSpeed: number,
): T {
  if (touch.idle && control.throttle === 0 && control.brake === 0 && forwardSpeed > 1)
    return { ...control, brake: TUNING.idleBrake }
  return control
}

export class TouchControls {
  cfg: PadConfig
  readonly actions: ActionModel
  private left: Rect = { left: 0, top: 0, right: 1e9, bottom: 1e9 }
  private right: Rect = { left: 0, top: 0, right: 1e9, bottom: 1e9 }
  private steerId: number | null = null
  private pedalId: number | null = null
  private pedalSticky: Pedal = 'none'
  private ox = 0
  private px = 0
  private py = 0
  private pedalY = 0
  private steering = false
  private target = 0
  private out = 0
  private phase = 0

  constructor(cfg: Partial<PadConfig> = {}, onPress?: (button: TouchButton) => void) {
    this.cfg = { ...DEFAULT_PAD_CONFIG, ...cfg }
    this.actions = new ActionModel(onPress)
  }

  configure(cfg: Partial<PadConfig>) {
    const scheme = this.cfg.scheme
    this.cfg = { ...this.cfg, ...cfg }
    if (this.cfg.scheme !== scheme) this.clear()
    else if (this.steerId !== null) this.evaluateSteer()
  }

  /** Rectángulos (en px de pantalla) de la superficie izquierda y de la de pedales de la derecha. */
  setLayout(left: Rect, right: Rect) {
    this.left = left
    this.right = right
  }

  /** Superficie que decide los pedales según el esquema. */
  get pedalRect(): Rect {
    return this.cfg.scheme === 'one' ? this.left : this.right
  }
  /** Línea de pedales (y en px de pantalla). */
  get pedalLineY(): number {
    const r = this.pedalRect
    return r.top + (r.bottom - r.top) * PEDAL_SPLIT
  }

  get steerPointer() {
    return this.steerId
  }
  get pedalPointer() {
    return this.pedalId
  }
  /** Origen y posición del pulgar que dobla (para dibujar). */
  get origin() {
    return this.ox
  }
  get thumbX() {
    return this.px
  }
  get thumbY() {
    return this.py
  }
  get pedalThumbY() {
    return this.pedalY
  }
  get pedal(): Pedal {
    return this.pedalId === null ? 'none' : this.pedalSticky
  }
  get steerTarget() {
    return this.target
  }
  get steer() {
    return this.out
  }

  /** Un dedo apoya en una superficie. Devuelve si lo tomó el control. */
  down(id: number, surface: Surface, x: number, y: number): boolean {
    if (surface === 'left') {
      if (this.steerId !== null) return false
      this.steerId = id
      this.ox = x
      this.px = x
      this.py = y
      this.steering = false
      this.target = 0
      this.evaluateSteer()
      if (this.cfg.scheme === 'one') {
        this.pedalId = id
        this.pedalSticky = 'none'
        this.setPedal(y)
      }
      return true
    }
    if (this.cfg.scheme !== 'two' || this.pedalId !== null) return false
    this.pedalId = id
    this.pedalSticky = 'none'
    this.setPedal(y)
    return true
  }

  move(id: number, x: number, y: number) {
    if (id === this.steerId) {
      this.px = x
      this.py = y
      this.evaluateSteer()
      if (this.cfg.scheme === 'one') this.setPedal(y)
    } else if (id === this.pedalId) this.setPedal(y)
  }

  up(id: number) {
    if (id === this.steerId) {
      this.steerId = null
      this.steering = false
      this.target = 0
      if (this.cfg.scheme === 'one') this.releasePedal()
    }
    if (id === this.pedalId) this.releasePedal()
    this.actions.up(id)
  }
  cancel(id: number) {
    this.up(id)
  }
  clear() {
    this.steerId = null
    this.steering = false
    this.target = 0
    this.out = 0
    this.releasePedal()
    this.actions.clear()
  }

  private releasePedal() {
    this.pedalId = null
    this.pedalSticky = 'none'
  }

  /** Pedal por posición vertical ABSOLUTA dentro de la superficie, con histéresis en la línea. */
  private setPedal(y: number) {
    this.pedalY = y
    const line = this.pedalLineY
    const h = TUNING.pedalHyst
    if (this.pedalSticky === 'gas') this.pedalSticky = y > line + h ? 'brake' : 'gas'
    else if (this.pedalSticky === 'brake') this.pedalSticky = y < line - h ? 'gas' : 'brake'
    else this.pedalSticky = y >= line ? 'brake' : 'gas'
  }

  private evaluateSteer() {
    const t = TUNING
    const R = this.cfg.radius
    // El origen sigue al pulgar si se aleja de más: no hay que "volver" a un punto que quedó atrás.
    const lim = R * t.follow
    const raw = this.px - this.ox
    if (Math.abs(raw) > lim) this.ox += Math.sign(raw) * (Math.abs(raw) - lim)
    const dx = (this.px - this.ox) / R
    const ax = Math.abs(dx)
    const sd = this.steering ? t.steerDeadExit : t.steerDeadEnter
    const x = ax * this.cfg.sensitivity
    if (x <= sd) {
      this.steering = false
      this.target = 0
    } else {
      this.steering = true
      const v = clamp((x - sd) / (t.steerFull - sd), 0, 1) ** t.steerCurve
      this.target = dx < 0 ? v : -v // a la izquierda del origen => doblar a la izquierda (steer > 0)
    }
  }

  /** Avanza la rampa del giro y el pulso del derrape; devuelve lo que piden los pulgares. */
  step(dt: number): TouchState {
    const t = TUNING
    const target = this.target
    const growing = Math.abs(target) > Math.abs(this.out) && target * this.out >= 0
    const rate = (growing ? t.rise : t.fall) * dt
    const diff = target - this.out
    this.out = Math.abs(diff) <= rate ? target : this.out + Math.sign(diff) * rate
    this.phase = (this.phase + dt * t.driftHz) % 1
    return this.state()
  }

  state(): TouchState {
    const t = TUNING
    const pedal = this.pedal
    const braking = pedal === 'brake'
    const drift = braking && Math.abs(this.out) > t.driftMin
    const p = this.actions.pressed()
    return {
      throttle: pedal === 'gas' ? 1 : 0,
      brake: braking ? (drift ? t.driftBrake : 1) : 0,
      steer: this.out,
      handbrake: p.has('handbrake') || (drift && this.phase < t.driftDuty),
      useItem: p.has('item'),
      idle: pedal === 'none',
      drift,
    }
  }

  release() {
    this.clear()
  }
}

/** Botón de acción bajo el dedo. Si cae entre varios (hasta `slop` px de uno), toma el más cercano. */
export function hitTest(
  rects: Partial<Record<TouchButton, Rect>>,
  x: number,
  y: number,
  slop = 14,
): TouchButton | null {
  let best: TouchButton | null = null
  let bestD = Infinity
  for (const id of Object.keys(rects) as TouchButton[]) {
    const r = rects[id]!
    const dx = Math.max(r.left - x, 0, x - r.right)
    const dy = Math.max(r.top - y, 0, y - r.bottom)
    const d = Math.hypot(dx, dy)
    if (d <= slop && d < bestD) {
      bestD = d
      best = id
    }
  }
  return best
}

/** Botones de acción: cada dedo se queda con el botón donde apoyó hasta que lo levanta. */
export class ActionModel {
  private readonly pointers = new Map<number, TouchButton>()

  constructor(private readonly onPress?: (button: TouchButton) => void) {}

  down(id: number, button: TouchButton | null): boolean {
    if (!button) return false
    this.pointers.set(id, button)
    this.onPress?.(button)
    return true
  }
  has(id: number) {
    return this.pointers.has(id)
  }
  up(id: number) {
    this.pointers.delete(id)
  }
  clear() {
    this.pointers.clear()
  }
  pressed(): Set<TouchButton> {
    return new Set(this.pointers.values())
  }
}
