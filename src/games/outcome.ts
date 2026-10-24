/** Resultado de una partida de cualquiera de los juegos del cofre. */
export interface GameOutcome {
  won: boolean
  /** Registro de entradas que se manda al servidor para que reproduzca la partida. */
  log: unknown
  /** Texto para la pantalla de derrota (cuánto se llegó). */
  lostText: string
  /** Resumen corto de la partida. */
  statsText: string
}

export interface GameSession<Config> {
  seed: number
  config: Config
  relaxed: boolean
}
