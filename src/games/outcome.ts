/** Resultado de una partida de cualquiera de los juegos del cofre. */
export interface GameOutcome {
  won: boolean
  /** Registro de entradas que se manda al servidor para que reproduzca la partida. */
  log: unknown
  /** Texto para la pantalla de derrota (cuánto se llegó). */
  lostText: string
  /** Resumen corto de la partida. */
  statsText: string
  /** Puntaje de la partida (más puntos = mejor). */
  score?: number
  /** Por qué se perdió: sin vidas o por tiempo. */
  reason?: 'hp' | 'time'
}

export interface GameSession<Config> {
  seed: number
  config: Config
  relaxed: boolean
}
