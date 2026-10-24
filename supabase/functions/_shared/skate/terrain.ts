// Terreno del circuito: una poligonal de alturas con huecos (fosos). Se arma solo con +, −, × (curvas
// polinómicas), así que da exactamente lo mismo en cualquier dispositivo.

import { COURSE, type Section } from './config.ts'

export const STEP = 10
const START_Y = 300

export interface Terrain {
  /** Alturas (y hacia abajo) en x = i * STEP. */
  ys: Float32Array
  /** false = foso (no hay suelo). */
  solid: Uint8Array
  length: number
  /** Posiciones (x) donde se guarda el progreso; la primera es la salida. */
  checkpoints: number[]
}

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Convierte las secciones en alturas por punto; `limit` recorta el circuito (pruebas). */
export function buildTerrain(
  sections: readonly Section[] = COURSE,
  limit: number | null = null,
): Terrain {
  const ys: number[] = [START_Y]
  const solid: number[] = [1]
  let y = START_Y
  const checkpoints: number[] = [0]

  const push = (value: number, isSolid: boolean) => {
    ys.push(value)
    solid.push(isSolid ? 1 : 0)
  }

  for (const section of sections) {
    if (section.t === 'flat' && section.checkpoint) checkpoints.push((ys.length - 1) * STEP)
    const steps = Math.max(1, Math.round(section.len / STEP))
    if (section.t === 'gap') {
      y += section.dy
      for (let i = 1; i <= steps; i++) push(y, i === steps)
      continue
    }
    const base = y
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      let value = base
      switch (section.t) {
        case 'slope':
          value = base + section.dy * smooth(t)
          break
        case 'quarterUp':
          value = base - section.h * t * t * t
          break
        case 'quarterDown': {
          const u = 1 - t
          value = base + section.h * (1 - u * u * u)
          break
        }
        case 'bump':
          value = base - section.h * 4 * t * (1 - t)
          break
        default:
          break
      }
      push(value, true)
    }
    y = ys[ys.length - 1]!
  }

  const maxPoints = limit === null ? ys.length : Math.min(ys.length, Math.floor(limit / STEP) + 1)
  return {
    ys: Float32Array.from(ys.slice(0, maxPoints)),
    solid: Uint8Array.from(solid.slice(0, maxPoints)),
    length: (maxPoints - 1) * STEP,
    checkpoints: checkpoints.filter((x) => x < (maxPoints - 1) * STEP),
  }
}

/** Altura del suelo en x, o Infinity si ahí hay un foso (o x está fuera del circuito). */
export function heightAt(terrain: Terrain, x: number): number {
  if (x < 0) return terrain.ys[0]!
  const i = Math.floor(x / STEP)
  if (i >= terrain.ys.length - 1) return terrain.ys[terrain.ys.length - 1]!
  if (!terrain.solid[i] || !terrain.solid[i + 1]) return Infinity
  const f = (x - i * STEP) / STEP
  return terrain.ys[i]! + (terrain.ys[i + 1]! - terrain.ys[i]!) * f
}

/** Pendiente dy/dx en x (0 en los fosos). */
export function slopeAt(terrain: Terrain, x: number): number {
  const i = Math.min(Math.max(Math.floor(x / STEP), 0), terrain.ys.length - 2)
  return (terrain.ys[i + 1]! - terrain.ys[i]!) / STEP
}
