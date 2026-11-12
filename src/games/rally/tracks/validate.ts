// Rally de Cocina: validador de pistas. Función pura: recibe una pista (aunque sea un JSON cualquiera)
// y devuelve errores y avisos claros en español, más los números de sanidad de la geometría.
// Lo usan los tests de cada pista y lo va a usar el editor de pistas. Qué se valida: docs/RALLY-PISTAS.md
import { ROOM } from '../data.ts'
import { buildRuntime, type Pt, type TrackRuntime } from './runtime.ts'
import {
  THEME_IDS,
  TRACK_FORMAT_VERSION,
  ZONE_KINDS,
  type TrackDef,
  type TrackIssue,
  type TrackMetrics,
  type ValidationResult,
} from './types.ts'

/** Límites que comprueba el validador (se exportan para que el editor los muestre y los respete). */
export const TRACK_LIMITS = {
  minControlPoints: 6,
  maxControlPoints: 80,
  halfWidth: [3.6, 8] as const,
  maxHeight: 14,
  /** Pendiente máxima (altura / distancia). */
  maxSlope: 0.22,
  /** Pendiente máxima bajo una rampa. */
  maxRampSlope: 0.12,
  /** Radio mínimo de curva = esto × mitad del ancho. */
  minRadiusFactor: 1.5,
  /** Separación mínima entre tramos lejanos = 2 × mitad del ancho + esto. */
  minSepExtra: 5,
  /** Dos tramos se consideran "lejanos" si están a más de esto de pista de distancia. */
  farArc: 35,
  /** Margen entre el eje (más el ancho) y las paredes del cuarto. */
  wallMargin: 4,
  rampLength: [4, 14] as const,
  rampHeight: [0.4, 3.2] as const,
  zoneLength: [3, 40] as const,
  maxPickups: 30,
  maxRamps: 8,
  maxZones: 8,
  /** Cuántos autos caben en la parrilla. */
  gridCars: 6,
} as const

const err = (code: string, message: string, at?: Pt): TrackIssue => ({
  code,
  severity: 'error',
  message,
  at: at ? { x: at.x, z: at.z } : undefined,
})
const warn = (code: string, message: string, at?: Pt): TrackIssue => ({
  code,
  severity: 'warning',
  message,
  at: at ? { x: at.x, z: at.z } : undefined,
})

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/* ============ estructura ============ */

/** Revisa que el JSON tenga la forma de una `TrackDef`. No mira la geometría. */
export function checkStructure(input: unknown): TrackIssue[] {
  const out: TrackIssue[] = []
  const bad = (field: string, expected: string) =>
    out.push(err('schema', `El campo "${field}" debe ser ${expected}.`))
  if (!isObj(input)) return [err('schema', 'La pista tiene que ser un objeto.')]
  if (input.version !== TRACK_FORMAT_VERSION)
    out.push(err('version', `La versión del formato debe ser ${TRACK_FORMAT_VERSION}.`))
  if (typeof input.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(input.id))
    bad('id', 'texto en minúsculas, números y guiones (por ejemplo "mi-pista")')
  if (typeof input.name !== 'string' || input.name.trim().length < 2 || input.name.length > 40)
    bad('name', 'un nombre de 2 a 40 letras')
  if (typeof input.description !== 'string' || input.description.length > 140)
    bad('description', 'un texto de hasta 140 letras')
  if (!THEME_IDS.includes(input.theme as never)) bad('theme', `uno de: ${THEME_IDS.join(', ')}`)
  if (![1, 2, 3, 4, 5].includes(input.difficulty as number)) bad('difficulty', 'un número de 1 a 5')
  if (!isNum(input.halfWidth)) bad('halfWidth', 'un número (metros)')
  if (!isNum(input.laps) || !Number.isInteger(input.laps) || input.laps < 1 || input.laps > 9)
    bad('laps', 'un entero de 1 a 9')
  if (
    input.samples !== undefined &&
    (!isNum(input.samples) || input.samples < 100 || input.samples > 3000)
  )
    bad('samples', 'un número entre 100 y 3000 (o no ponerlo)')
  const st = input.start
  if (!isObj(st) || !isNum(st.x) || !isNum(st.z)) bad('start', 'un objeto { x, z }')
  const cps = input.controlPoints
  if (!Array.isArray(cps)) bad('controlPoints', 'una lista de puntos { x, z, y }')
  else {
    cps.forEach((p, i) => {
      if (!isObj(p) || !isNum(p.x) || !isNum(p.z) || !isNum(p.y))
        out.push(err('schema', `El punto de control ${i + 1} debe ser { x, z, y } con números.`))
    })
    if (cps.length > TRACK_LIMITS.maxControlPoints)
      out.push(
        err(
          'points-max',
          `Hay demasiados puntos de control (máximo ${TRACK_LIMITS.maxControlPoints}).`,
        ),
      )
  }
  const g = input.grid
  if (!isObj(g) || !isNum(g.firstRow) || !isNum(g.rowGap) || !isNum(g.lateral))
    bad('grid', 'un objeto { firstRow, rowGap, lateral }')
  const a = input.ai
  if (
    !isObj(a) ||
    !isNum(a.speed) ||
    !isNum(a.cornerBrake) ||
    !isNum(a.lookahead) ||
    !isNum(a.slopeCare)
  )
    bad('ai', 'un objeto { speed, cornerBrake, lookahead, slopeCare }')
  else {
    if (a.speed < 0.6 || a.speed > 1.3) bad('ai.speed', 'un número entre 0,6 y 1,3')
    if (a.cornerBrake < 0 || a.cornerBrake > 0.9) bad('ai.cornerBrake', 'un número entre 0 y 0,9')
    if (a.lookahead < 4 || a.lookahead > 30) bad('ai.lookahead', 'un número entre 4 y 30')
    if (a.slopeCare < 0 || a.slopeCare > 2) bad('ai.slopeCare', 'un número entre 0 y 2')
  }
  const listOf = (name: string, shape: (o: Record<string, unknown>) => boolean, label: string) => {
    const v = input[name]
    if (!Array.isArray(v)) {
      bad(name, 'una lista')
      return
    }
    v.forEach((o, i) => {
      if (!isObj(o) || !shape(o))
        out.push(err('schema', `${label} ${i + 1}: faltan datos o no son números.`))
    })
  }
  listOf(
    'ramps',
    (o) =>
      isNum(o.s) &&
      isNum(o.lat) &&
      isNum(o.length) &&
      isNum(o.width) &&
      isNum(o.height) &&
      isNum(o.color),
    'Rampa',
  )
  listOf('pickups', (o) => isNum(o.s) && isNum(o.lat), 'Caja sorpresa')
  listOf(
    'zones',
    (o) =>
      ZONE_KINDS.includes(o.kind as never) &&
      isNum(o.s) &&
      isNum(o.lat) &&
      isNum(o.length) &&
      isNum(o.width),
    'Zona',
  )
  return out
}

/** Lee una pista de un JSON (texto u objeto). Devuelve la pista si la estructura es válida. */
export function parseTrackDef(input: unknown): { def: TrackDef | null; errors: TrackIssue[] } {
  let value = input
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input)
    } catch {
      return { def: null, errors: [err('json', 'El texto no es un JSON válido.')] }
    }
  }
  const errors = checkStructure(value)
  return errors.length ? { def: null, errors } : { def: value as TrackDef, errors }
}

/* ============ geometría ============ */

function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const o = (p: Pt, q: Pt, r: Pt) => (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x)
  const d1 = o(a, b, c)
  const d2 = o(a, b, d)
  const d3 = o(c, d, a)
  const d4 = o(c, d, b)
  return d1 * d2 < 0 && d3 * d4 < 0
}

/** Los números de sanidad de una pista ya armada. */
export function computeMetrics(rt: TrackRuntime): TrackMetrics {
  const { n, TP, TAN, DIST, len, Y, SLOPE } = rt
  let minSep = 1e9
  for (let i = 0; i < n; i += 2)
    for (let j = i + 2; j < n; j += 2) {
      const dd = Math.abs(DIST[j]! - DIST[i]!)
      const arc = Math.min(dd, len - dd)
      if (arc < TRACK_LIMITS.farArc) continue
      const d = Math.hypot(TP[i]!.x - TP[j]!.x, TP[i]!.z - TP[j]!.z)
      if (d < minSep) minSep = d
    }
  let minR = 1e9
  for (let i = 0; i < n; i++) {
    const a = TAN[(i - 4 + n) % n]!
    const b = TAN[(i + 4) % n]!
    const ang = Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.z * b.z)))
    const arc = (8 * len) / n
    if (ang > 1e-4) minR = Math.min(minR, arc / ang)
  }
  let maxSlope = 0
  let minY = Infinity
  let maxY = -Infinity
  let climb = 0
  for (let i = 0; i < n; i++) {
    maxSlope = Math.max(maxSlope, Math.abs(SLOPE[i]!))
    minY = Math.min(minY, Y[i]!)
    maxY = Math.max(maxY, Y[i]!)
    const dy = Y[(i + 1) % n]! - Y[i]!
    if (dy > 0) climb += dy
  }
  return { length: len, samples: n, minSep, minRadius: minR, maxSlope, minY, maxY, climb }
}

const angleBetween = (a: Pt, b: Pt) => Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.z * b.z)))

/** Distancia (con signo) a lo largo de la pista desde la meta hacia atrás; > 0 = antes de la meta. */
const behindStart = (rt: TrackRuntime, idx: number) => {
  const d = rt.DIST[idx]!
  return d <= rt.len / 2 ? -d : rt.len - d
}

function geometryIssues(rt: TrackRuntime, metrics: TrackMetrics): TrackIssue[] {
  const out: TrackIssue[] = []
  const { def, n, hw, TP, TAN, len, Y } = rt
  const L = TRACK_LIMITS
  const spacing = len / n

  // ancho
  if (hw < L.halfWidth[0] || hw > L.halfWidth[1])
    out.push(
      err(
        'width',
        `El ancho debe estar entre ${L.halfWidth[0] * 2} y ${L.halfWidth[1] * 2} m (hoy ${hw * 2} m).`,
      ),
    )

  // circuito cerrado: el último punto está a un paso de la meta y la altura no pega un salto
  const gap = Math.hypot(TP[n - 1]!.x - TP[0]!.x, TP[n - 1]!.z - TP[0]!.z)
  if (gap > 2 * spacing || Math.abs(Y[n - 1]! - Y[0]!) > 2 * spacing * L.maxSlope + 0.05)
    out.push(err('closed', 'El circuito no cierra: el final no empalma con la meta.', TP[0]))

  // puntos repetidos
  const cps = def.controlPoints
  for (let i = 0; i < cps.length; i++) {
    const a = cps[i]!
    const b = cps[(i + 1) % cps.length]!
    if (Math.hypot(a.x - b.x, a.z - b.z) < 1)
      out.push(
        err(
          'duplicate-points',
          `Los puntos de control ${i + 1} y ${((i + 1) % cps.length) + 1} están encimados.`,
          a,
        ),
      )
  }

  // largo
  if (metrics.length < 250)
    out.push(warn('short', `La pista es corta (${Math.round(metrics.length)} m).`))
  if (metrics.length > 900)
    out.push(warn('long', `La pista es muy larga (${Math.round(metrics.length)} m).`))

  // dentro del cuarto
  const mx = ROOM.x1 - hw - L.wallMargin
  const mz = ROOM.z1 - hw - L.wallMargin
  for (let i = 0; i < n; i += 5) {
    const p = TP[i]!
    if (Math.abs(p.x) > mx || Math.abs(p.z) > mz) {
      out.push(err('bounds', 'La pista se sale del cuarto (o pasa muy pegada a una pared).', p))
      break
    }
  }

  // cruces y autointersecciones
  const stride = 3
  const poly: { p: Pt; i: number }[] = []
  for (let i = 0; i < n; i += stride) poly.push({ p: TP[i]!, i })
  let crossed = false
  for (let a = 0; a < poly.length && !crossed; a++)
    for (let b = a + 2; b < poly.length; b++) {
      if (a === 0 && b === poly.length - 1) continue
      const a1 = poly[a]!
      const a2 = poly[(a + 1) % poly.length]!
      const b1 = poly[b]!
      const b2 = poly[(b + 1) % poly.length]!
      if (segmentsCross(a1.p, a2.p, b1.p, b2.p)) {
        out.push(
          err('self-intersection', 'La pista se cruza consigo misma (no hay puentes).', a1.p),
        )
        crossed = true
        break
      }
    }

  // separación y radio
  if (metrics.minSep < 2 * hw + L.minSepExtra)
    out.push(
      err(
        'separation',
        `Dos tramos de la pista pasan demasiado cerca (${metrics.minSep.toFixed(1)} m entre ejes; mínimo ${(2 * hw + L.minSepExtra).toFixed(1)} m).`,
      ),
    )
  if (metrics.minRadius < L.minRadiusFactor * hw) {
    let at: Pt | undefined
    let worst = 1e9
    for (let i = 0; i < n; i++) {
      const ang = angleBetween(TAN[(i - 4 + n) % n]!, TAN[(i + 4) % n]!)
      const r = ang > 1e-4 ? (8 * spacing) / ang : 1e9
      if (r < worst) {
        worst = r
        at = TP[i]
      }
    }
    out.push(
      err(
        'radius',
        `Hay una curva demasiado cerrada (radio ${metrics.minRadius.toFixed(1)} m; mínimo ${(L.minRadiusFactor * hw).toFixed(1)} m).`,
        at,
      ),
    )
  }

  // alturas
  if (metrics.minY < -0.01)
    out.push(err('below-floor', 'Hay puntos de la pista por debajo del piso.'))
  if (metrics.maxY > L.maxHeight)
    out.push(err('too-high', `La pista sube demasiado (máximo ${L.maxHeight} m de altura).`))
  if (metrics.maxSlope > L.maxSlope) {
    let at: Pt | undefined
    for (let i = 0; i < n; i++) if (Math.abs(rt.SLOPE[i]!) >= metrics.maxSlope - 1e-9) at = TP[i]
    out.push(
      err(
        'slope',
        `Hay una pendiente demasiado empinada (${(metrics.maxSlope * 100).toFixed(0)} %; máximo ${L.maxSlope * 100} %).`,
        at,
      ),
    )
  } else if (metrics.maxSlope > 0.18)
    out.push(
      warn('steep', `Hay una pendiente muy empinada (${(metrics.maxSlope * 100).toFixed(0)} %).`),
    )

  // parrilla
  const lastBack = def.grid.firstRow + Math.floor((L.gridCars - 1) / 2) * def.grid.rowGap
  if (
    def.grid.firstRow < 3 ||
    def.grid.rowGap < 5 ||
    def.grid.lateral < 1.2 ||
    def.grid.lateral > hw - 1.2
  )
    out.push(
      err(
        'grid-shape',
        'La parrilla no entra en el ancho de la pista o las filas están muy juntas.',
      ),
    )
  else if (lastBack + 6 > len / 3)
    out.push(err('grid-shape', 'La parrilla es más larga que la pista permite.'))
  else {
    const first = rt.gridSlot(0)
    const lastI = rt.gridSlot(L.gridCars - 1).idx
    const ahead = rt.idxAt(15 / len) % n
    if (
      angleBetween(TAN[lastI]!, TAN[0]!) > 0.4 ||
      angleBetween(TAN[first.idx]!, TAN[ahead]!) > 0.6
    )
      out.push(
        err(
          'grid-curve',
          'La largada tiene que estar en un tramo recto (la parrilla y los primeros metros).',
          TP[0],
        ),
      )
    // Todo lo que esté entre el último auto de la parrilla y 10 m después de la meta estorba.
    const clearBack = lastBack + 5
    const inGrid = (idx: number, halfLen: number) => {
      const b = behindStart(rt, idx)
      return b > -10 - halfLen && b < clearBack + halfLen
    }
    rt.ramps.forEach((r, i) => {
      if (inGrid(r.idx, r.len / 2))
        out.push(err('grid-obstacle', `La rampa ${i + 1} está sobre la largada.`, r))
    })
    rt.pickupSpots.forEach((p, i) => {
      if (inGrid(p.idx, 1.5))
        out.push(err('grid-obstacle', `La caja sorpresa ${i + 1} está sobre la largada.`, p))
    })
    rt.zones.forEach((zn, i) => {
      const mid = (zn.i0 + Math.floor(zn.count / 2)) % n
      if (inGrid(mid, (zn.count * spacing) / 2))
        out.push(err('grid-obstacle', `La zona ${i + 1} está sobre la largada.`, TP[mid]))
    })
  }

  // rampas
  def.ramps.forEach((rd, i) => {
    const r = rt.ramps[i]!
    const name = `La rampa ${i + 1}`
    if (rd.length < L.rampLength[0] || rd.length > L.rampLength[1])
      out.push(
        err(
          'ramp-size',
          `${name} debe medir de ${L.rampLength[0]} a ${L.rampLength[1]} m de largo.`,
          r,
        ),
      )
    if (rd.height < L.rampHeight[0] || rd.height > L.rampHeight[1])
      out.push(
        err(
          'ramp-size',
          `${name} debe tener de ${L.rampHeight[0]} a ${L.rampHeight[1]} m de alto.`,
          r,
        ),
      )
    if (rd.width < 2.5 || rd.width > 2 * hw - 1)
      out.push(
        err('ramp-size', `${name} debe medir de 2,5 m a ${(2 * hw - 1).toFixed(1)} m de ancho.`, r),
      )
    if (Math.abs(rd.lat) + rd.width / 2 > hw - 0.3)
      out.push(err('ramp-off-track', `${name} se sale del asfalto.`, r))
    const half = Math.round(rd.length / 2 / spacing)
    const turn = angleBetween(TAN[(r.idx - half + n) % n]!, TAN[(r.idx + half) % n]!)
    if (turn > 0.3)
      out.push(err('ramp-curve', `${name} está en una curva: ponela en un tramo recto.`, r))
    let sl = 0
    for (let k = -half; k <= half; k++) sl = Math.max(sl, Math.abs(rt.SLOPE[(r.idx + k + n) % n]!))
    if (sl > L.maxRampSlope)
      out.push(err('ramp-slope', `${name} está sobre una pendiente muy empinada.`, r))
    def.ramps.forEach((o, j) => {
      if (j <= i) return
      const d = Math.abs(rd.s - o.s) * len
      const arc = Math.min(d, len - d)
      if (arc < (rd.length + o.length) / 2 + 6)
        out.push(err('ramp-overlap', `Las rampas ${i + 1} y ${j + 1} están muy juntas.`, r))
    })
  })

  // cajas sorpresa
  def.pickups.forEach((pk, i) => {
    const sp = rt.pickupSpots[i]!
    if (Math.abs(pk.lat) > hw - 1.2)
      out.push(err('pickup-off-track', `La caja sorpresa ${i + 1} está muy cerca del borde.`, sp))
    for (const r of rt.ramps) {
      const dx = sp.x - r.x
      const dz = sp.z - r.z
      const u = dx * r.ux + dz * r.uz
      const v = dx * r.vx + dz * r.vz
      if (Math.abs(u) < r.len / 2 + 1.5 && Math.abs(v) < r.w / 2 + 1.5)
        out.push(err('pickup-on-ramp', `La caja sorpresa ${i + 1} está sobre una rampa.`, sp))
    }
    for (let j = i + 1; j < rt.pickupSpots.length; j++) {
      const o = rt.pickupSpots[j]!
      if (Math.hypot(o.x - sp.x, o.z - sp.z) < 2.5)
        out.push(
          err('pickup-overlap', `Las cajas sorpresa ${i + 1} y ${j + 1} están encimadas.`, sp),
        )
    }
  })

  // zonas
  def.zones.forEach((zd, i) => {
    const mid = rt.idxAt(zd.s)
    const name = `La zona ${i + 1}`
    if (zd.length < L.zoneLength[0] || zd.length > L.zoneLength[1])
      out.push(
        err(
          'zone-size',
          `${name} debe medir de ${L.zoneLength[0]} a ${L.zoneLength[1]} m de largo.`,
          TP[mid],
        ),
      )
    if (zd.width < 1.5 || zd.width > 2 * hw * 0.75)
      out.push(
        err(
          'zone-size',
          `${name} debe ocupar entre 1,5 m y el 75 % del ancho de la pista.`,
          TP[mid],
        ),
      )
    if (Math.abs(zd.lat) + zd.width / 2 > hw - 0.2)
      out.push(err('zone-off-track', `${name} se sale del asfalto.`, TP[mid]))
    def.zones.forEach((o, j) => {
      if (j <= i) return
      const d = Math.abs(zd.s - o.s) * len
      const arc = Math.min(d, len - d)
      const latOverlap = Math.abs(zd.lat - o.lat) < (zd.width + o.width) / 2
      if (latOverlap && arc < (zd.length + o.length) / 2)
        out.push(err('zone-overlap', `Las zonas ${i + 1} y ${j + 1} se superponen.`, TP[mid]))
    })
    for (const r of rt.ramps) {
      const d = Math.abs(rt.DIST[mid]! - rt.DIST[r.idx]!)
      const arc = Math.min(d, len - d)
      if (arc < (zd.length + r.len) / 2 + 2)
        out.push(err('zone-on-ramp', `${name} está pegada a una rampa.`, TP[mid]))
    }
  })

  // cantidades
  if (def.ramps.length > L.maxRamps)
    out.push(err('ramps-max', `Hay demasiadas rampas (máximo ${L.maxRamps}).`))
  if (def.pickups.length > L.maxPickups)
    out.push(err('pickups-max', `Hay demasiadas cajas sorpresa (máximo ${L.maxPickups}).`))
  if (def.zones.length > L.maxZones)
    out.push(err('zones-max', `Hay demasiadas zonas (máximo ${L.maxZones}).`))
  if (def.pickups.length < 6)
    out.push(warn('few-pickups', 'Hay muy pocas cajas sorpresa (menos de 6).'))
  return out
}

/**
 * Valida una pista completa. Acepta cualquier valor (por ejemplo, un JSON leído): primero revisa la
 * estructura y, si está bien, calcula la geometría y la revisa.
 */
export function validateTrack(input: unknown): ValidationResult {
  const structure = checkStructure(input)
  if (structure.length) return { ok: false, errors: structure, warnings: [], metrics: null }
  const def = input as TrackDef
  if (def.controlPoints.length < TRACK_LIMITS.minControlPoints)
    return {
      ok: false,
      errors: [
        err(
          'points-min',
          `Hacen falta al menos ${TRACK_LIMITS.minControlPoints} puntos de control (hay ${def.controlPoints.length}).`,
        ),
      ],
      warnings: [],
      metrics: null,
    }
  const rt = buildRuntime(def)
  const metrics = computeMetrics(rt)
  const issues = geometryIssues(rt, metrics)
  const errors = issues.filter((i) => i.severity === 'error')
  const warnings = issues.filter((i) => i.severity === 'warning')
  return { ok: errors.length === 0, errors, warnings, metrics }
}
