import { isSoundEnabled } from './preferences'

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Vibración corta (Android; en iOS simplemente no hace nada). */
export function vibrate(pattern: number | number[] = 40): void {
  if (prefersReducedMotion()) return
  navigator.vibrate?.(pattern)
}

/** Dos notas suaves sintetizadas: no hay archivos de audio que descargar. Solo suena si el cliente lo activó. */
export function playChime(): void {
  if (!isSoundEnabled()) return
  try {
    const context = new AudioContext()
    const now = context.currentTime
    ;[660, 880].forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, now + index * 0.12)
      gain.gain.exponentialRampToValueAtTime(0.12, now + index * 0.12 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.12 + 0.4)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(now + index * 0.12)
      oscillator.stop(now + index * 0.12 + 0.45)
    })
    window.setTimeout(() => void context.close(), 1200)
  } catch {
    // Navegador sin Web Audio: no pasa nada.
  }
}

const BRAND_COLORS = ['#c8102e', '#faf3e3', '#2a1a14', '#3f7a26']

/** Confetti en canvas (se descarga recién al celebrar). Con reduced-motion no se dispara. */
export async function fireConfetti(): Promise<void> {
  if (prefersReducedMotion()) return
  const { default: confetti } = await import('canvas-confetti')
  void confetti({
    particleCount: 90,
    spread: 70,
    startVelocity: 38,
    origin: { y: 0.35 },
    colors: BRAND_COLORS,
    disableForReducedMotion: true,
  })
}
