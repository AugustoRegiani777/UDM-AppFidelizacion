// Rally de Cocina: formato de datos de una pista. Todo es JSON plano (números, strings, arrays):
// se puede guardar, enviar y volver a leer sin perder nada. El editor de pistas usa estos mismos tipos.
// Documentación completa: docs/RALLY-PISTAS.md

export const TRACK_FORMAT_VERSION = 1

/** Qué decorado y qué iluminación se construyen para la pista. */
export const THEME_IDS = [
  'cocina',
  'obrador',
  'barra',
  'vitrina',
  'harina',
  'terraza',
  'fallas',
] as const
export type ThemeId = (typeof THEME_IDS)[number]

export const ZONE_KINDS = ['slick', 'sand'] as const
/** `slick`: mancha resbaladiza (poco agarre). `sand`: arena o harina que frena. */
export type ZoneKind = (typeof ZONE_KINDS)[number]

/** Punto de control del eje de la pista. La curva es una Catmull-Rom cerrada que pasa por todos. */
export interface ControlPoint {
  /** Metros, eje este-oeste del mundo. */
  x: number
  /** Metros, eje norte-sur del mundo. */
  z: number
  /** Altura del asfalto sobre el piso, en metros (0 = a ras del piso). */
  y: number
}

/** Rampa tipo libro apoyada sobre la pista. Sube de cero a `height` a lo largo de `length`. */
export interface RampDef {
  /** Posición a lo largo de la pista, 0..1 (fracción de la vuelta desde la meta). */
  s: number
  /** Desplazamiento lateral del centro: positivo = izquierda del sentido de marcha. */
  lat: number
  length: number
  width: number
  height: number
  /** Color 0xRRGGBB de la tapa. */
  color: number
}

/** Posición de una caja sorpresa. */
export interface PickupDef {
  s: number
  lat: number
}

/** Zona rectangular pegada al asfalto (orientada con la pista) con un efecto especial. */
export interface ZoneDef {
  kind: ZoneKind
  /** Centro a lo largo de la pista, 0..1. */
  s: number
  /** Centro lateral en metros (positivo = izquierda). */
  lat: number
  /** Largo a lo largo de la pista, en metros. */
  length: number
  /** Ancho a lo ancho de la pista, en metros. */
  width: number
}

/** La parrilla de largada: filas de dos autos hacia atrás desde la meta. */
export interface GridDef {
  /** Metros detrás de la meta donde está la primera fila. */
  firstRow: number
  /** Metros entre filas. */
  rowGap: number
  /** Distancia lateral de cada columna al eje (±). */
  lateral: number
}

/** Ajustes de los rivales controlados por la IA. */
export interface AiDef {
  /** Multiplicador de la velocidad objetivo (1 = igual que la Cocina). */
  speed: number
  /** Cuánto frenan en las curvas (0.45 en la Cocina; más = frenan más). */
  cornerBrake: number
  /** Vuelta del ojo adelante, en puntos del eje (8 en la Cocina; más = anticipa más). */
  lookahead: number
  /** Cuánto reaccionan a las bajadas y crestas (0 = nada, 1 = normal). */
  slopeCare: number
}

export interface TrackDef {
  version: typeof TRACK_FORMAT_VERSION
  /** Identificador estable: minúsculas, números y guiones. Es parte de las claves guardadas. */
  id: string
  name: string
  /** Una frase para la tarjeta del menú. */
  description: string
  theme: ThemeId
  /** 1 (muy fácil) a 5 (muy difícil). */
  difficulty: 1 | 2 | 3 | 4 | 5
  /** Mitad del ancho del asfalto, en metros. */
  halfWidth: number
  /** Vueltas que se proponen si la persona no eligió otra cantidad. */
  laps: number
  /** Cantidad de puntos del eje (opcional; por defecto ~1 punto cada 0,7 m). */
  samples?: number
  /** Dónde está la meta: se ajusta al punto del eje más cercano. */
  start: { x: number; z: number }
  /** Mínimo 6 puntos, en el sentido de la carrera. */
  controlPoints: ControlPoint[]
  grid: GridDef
  ramps: RampDef[]
  pickups: PickupDef[]
  zones: ZoneDef[]
  ai: AiDef
}

/** Un problema encontrado al validar. `code` es estable (para el editor); `message` está en español. */
export interface TrackIssue {
  code: string
  severity: 'error' | 'warning'
  message: string
  /** Dónde pasa, en el mundo (para marcarlo en el editor). */
  at?: { x: number; z: number }
}

export interface TrackMetrics {
  /** Largo del eje, en metros. */
  length: number
  /** Cantidad de puntos muestreados del eje. */
  samples: number
  /** Distancia mínima entre tramos lejanos (separados más de 35 m de pista). */
  minSep: number
  /** Radio mínimo de curva, en metros. */
  minRadius: number
  /** Pendiente máxima (subida o bajada), metro de altura por metro recorrido. */
  maxSlope: number
  minY: number
  maxY: number
  /** Suma de todas las subidas, en metros. */
  climb: number
}

export interface ValidationResult {
  ok: boolean
  errors: TrackIssue[]
  warnings: TrackIssue[]
  /** `null` si la estructura es tan mala que no se pudo ni calcular. */
  metrics: TrackMetrics | null
}
