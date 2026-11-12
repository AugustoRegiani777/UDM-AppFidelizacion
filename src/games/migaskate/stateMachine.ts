// Maquina de estados explicita de la tabla. Cuatro estados de la especificacion (Grounded, Popping,
// Airborne, Grinding) mas `bailed`, un estado de recuperacion (caida amable y rapida) que el diseno
// necesita para no dejar la tabla tirada mientras se muestra el cartel de animo.
//
// Transiciones permitidas (las demas se rechazan y se ignoran):
//
//   grounded  -> popping     ollie / nollie / pop shove-it aceptado en el suelo
//   grounded  -> airborne    las ruedas perdieron contacto (labio de una rampa, escalon hacia abajo)
//   grounded  -> bailed      manual perdido o choque feo
//   popping   -> airborne    termino la ventana del pop (0.10 s) o se despegaron las ruedas
//   airborne  -> grounded    aterrizaje limpio o torpe (>= 2 ruedas con contacto)
//   airborne  -> popping     ollie tardio dentro del tiempo de coyote (salto tolerante)
//   airborne  -> grinding    la tabla engancho un riel alineada
//   airborne  -> bailed      aterrizaje con la tabla de canto / de espaldas / girando
//   grinding  -> airborne    fin del riel o velocidad insuficiente
//   grinding  -> popping     ollie para salir del riel
//   grinding  -> bailed      perdiste el equilibrio
//   bailed    -> grounded    pasado el tiempo de recuperacion

export type SkateState = 'grounded' | 'popping' | 'airborne' | 'grinding' | 'bailed'

export const SKATE_STATES: readonly SkateState[] = [
  'grounded',
  'popping',
  'airborne',
  'grinding',
  'bailed',
]

export const TRANSITIONS: Readonly<Record<SkateState, readonly SkateState[]>> = {
  grounded: ['popping', 'airborne', 'bailed'],
  popping: ['airborne'],
  airborne: ['grounded', 'popping', 'grinding', 'bailed'],
  grinding: ['airborne', 'popping', 'bailed'],
  bailed: ['grounded'],
}

export type StateListener = (from: SkateState, to: SkateState) => void

export class SkateStateMachine {
  private current: SkateState = 'grounded'
  private readonly listeners = new Set<StateListener>()
  /** Segundos desde la ultima transicion (lo avanza la fisica). */
  elapsed = 0

  get state(): SkateState {
    return this.current
  }

  canTransition(to: SkateState): boolean {
    return TRANSITIONS[this.current].includes(to)
  }

  /** Intenta pasar a `to`. Devuelve false (y no cambia nada) si la transicion esta prohibida. */
  transition(to: SkateState): boolean {
    if (!this.canTransition(to)) return false
    const from = this.current
    this.current = to
    this.elapsed = 0
    for (const l of this.listeners) l(from, to)
    return true
  }

  /** Reinicia sin pasar por las reglas (solo para empezar una sesion o en pruebas). */
  reset(state: SkateState = 'grounded') {
    this.current = state
    this.elapsed = 0
  }

  onChange(fn: StateListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  tick(dt: number) {
    this.elapsed += dt
  }
}
