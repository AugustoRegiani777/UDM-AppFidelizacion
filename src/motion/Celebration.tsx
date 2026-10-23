import { useEffect } from 'react'
import { AnimatedCheck } from './AnimatedCheck'
import { fireConfetti, playChime, vibrate } from './feedback'

/**
 * Celebración de un logro: check que se dibuja + confetti + vibración corta + sonido (si está activado).
 * Con prefers-reduced-motion queda el check con fundido, sin confetti ni vibración.
 */
export function Celebration({ className = '' }: { className?: string }) {
  useEffect(() => {
    void fireConfetti()
    vibrate([30, 40, 30])
    playChime()
  }, [])

  return <AnimatedCheck className={className} />
}
