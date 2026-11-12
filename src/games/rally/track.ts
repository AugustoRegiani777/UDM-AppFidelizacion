// Rally de Cocina: geometría de la pista "La Cocina" (la de siempre) como valores sueltos.
// El juego usa `TrackRuntime` (tracks/runtime.ts) con cualquier pista; esto queda como vista de la
// pista original para los tests y para quien necesite sus números sin elegir una pista.
import { getTrack } from './tracks/index.ts'
import { computeMetrics } from './tracks/validate.ts'

export type { Pt, Ramp } from './tracks/runtime.ts'

const K = getTrack('cocina')

/** Puntos del eje de la pista, empezando en la meta. */
export const TP = K.TP
export const TAN = K.TAN
/** Normal hacia la izquierda del sentido de marcha. */
export const NRM = K.NRM
export const DIST = K.DIST
export const LEN = K.len
export const ramps = K.ramps
export const pickupSpots = K.pickupSpots

/** Números de sanidad de la pista: largo, separación mínima entre tramos lejanos y radio mínimo de curva. */
export const trackCheck = (() => {
  const m = computeMetrics(K)
  return { length: m.length, minSep: m.minSep, minRadius: m.minRadius }
})()

export const nearestGlobal = K.nearestGlobal
export const nearestIdx = K.nearestIdx
export const distToTrack = K.distToTrack
/** Revisa que un objeto de decoración no pise la pista: devuelve un aviso o null. */
export const chk = K.chk
export const idxBack = K.idxBack
export const groundAt = K.groundAt
