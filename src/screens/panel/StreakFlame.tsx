import { motion, useReducedMotion } from 'motion/react'
import { copy } from '@/copy'

const MAX_GROWTH_WEEKS = 8

/** Llamita de racha: crece con cada semana seguida (hasta 8) y titila apenas. */
export function StreakFlame({ weeks }: { weeks: number }) {
  const calm = useReducedMotion()
  const size = 1 + Math.min(weeks, MAX_GROWTH_WEEKS) * 0.07
  return (
    <span className="bg-brand-soft text-brand-ink inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold">
      <motion.span
        aria-hidden
        className="inline-block origin-bottom"
        initial={{ scale: 0 }}
        animate={{ scale: calm ? size : [size, size * 1.12, size] }}
        transition={calm ? undefined : { duration: 1.2, repeat: Infinity }}
      >
        🔥
      </motion.span>
      {copy.panel.streak(weeks)}
    </span>
  )
}
