// Rally de Cocina: perfiles de calidad. El de escritorio es el de la demo; el táctil es más liviano.

export interface Quality {
  touch: boolean
  /** Tope de la densidad de píxeles (escritorio 1.5, celular 1). */
  pixelRatio: number
  antialias: boolean
  /** Lado del mapa de sombras; 0 = sin sombras. */
  shadowSize: number
  /** Partículas simultáneas. */
  particles: number
  /** Fracción de partículas que se emiten (1 = todas). */
  particleScale: number
  /** Baja la resolución si los cuadros tardan de más. */
  adaptive: boolean
  /** Menos movimiento de cámara y del campo de visión. */
  reducedMotion: boolean
}

export function qualityFor(
  touch: boolean,
  devicePixelRatio: number,
  reducedMotion: boolean,
): Quality {
  if (!touch) {
    return {
      touch,
      pixelRatio: Math.min(devicePixelRatio || 1, 1.5),
      antialias: true,
      shadowSize: 2048,
      particles: 500,
      particleScale: 1,
      adaptive: false,
      reducedMotion,
    }
  }
  return {
    touch,
    pixelRatio: 1,
    antialias: false,
    shadowSize: 1024,
    particles: 260,
    particleScale: 0.5,
    adaptive: true,
    reducedMotion,
  }
}

/** Una prueba de rendimiento simple: si los primeros cuadros tardan de más, se apagan las sombras. */
export const SHADOW_PROBE_FRAMES = 40
export const SHADOW_OFF_MS = 26
export const ADAPT_WINDOW = 45
export const ADAPT_SLOW_MS = 22
export const MIN_PIXEL_RATIO = 0.5

export type Adaptation = { pixelRatio: number } | null

/** Si el promedio de cuadros pasa de ~22 ms, baja la resolución de a un paso (nunca vuelve a subir). */
export function adaptResolution(avgFrameMs: number, current: number): Adaptation {
  if (avgFrameMs <= ADAPT_SLOW_MS || current <= MIN_PIXEL_RATIO) return null
  return { pixelRatio: Math.max(MIN_PIXEL_RATIO, Math.round((current - 0.15) * 100) / 100) }
}

/** Decide si se apagan las sombras después de la prueba. */
export const shouldDisableShadows = (avgFrameMs: number) => avgFrameMs > SHADOW_OFF_MS

/** ¿El aparato es táctil? `?touch=1` lo fuerza (para pruebas); `?touch=0` lo apaga. */
export function detectTouch(search: string, win: Window = window): boolean {
  const q = new URLSearchParams(search).get('touch')
  if (q === '1') return true
  if (q === '0') return false
  const coarse = win.matchMedia?.('(pointer: coarse)').matches ?? false
  return coarse || (win.navigator.maxTouchPoints ?? 0) > 0
}
