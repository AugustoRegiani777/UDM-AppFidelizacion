import type { ControlPoint, PickupDef } from '../types.ts'

/** Filas de cajas sorpresa: una fila en cada `s`, con una caja por cada desplazamiento lateral. */
export function pickupRows(ss: number[], lats: number[]): PickupDef[] {
  const out: PickupDef[] = []
  for (const s of ss) for (const lat of lats) out.push({ s, lat })
  return out
}

/** Puntos de control en forma corta: [x, z] o [x, z, altura]. */
export function pts(list: [number, number, number?][]): ControlPoint[] {
  return list.map(([x, z, y]) => ({ x, z, y: y ?? 0 }))
}
