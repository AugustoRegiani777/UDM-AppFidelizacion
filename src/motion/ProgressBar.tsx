import { motion, useReducedMotion } from 'motion/react'
import { spring } from './presets'

interface ProgressBarProps {
  /** 0 a 1 */
  value: number
  label: string
  className?: string
}

/**
 * Barra que se llena con spring (scaleX, nunca width). Al completarse un brillo la recorre
 * (translateX); cerca de completarse (≥80%) late suave con opacity.
 */
export function ProgressBar({ value, label, className = '' }: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), 1)
  const calm = useReducedMotion()
  const complete = clamped >= 1
  const almost = clamped >= 0.8 && !complete

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={`bg-track relative h-3 overflow-hidden rounded-full ${className}`}
    >
      <motion.div
        className="bg-brand h-full origin-left rounded-full"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: clamped, opacity: almost && !calm ? [1, 0.65, 1] : 1 }}
        transition={{ scaleX: spring.gentle, opacity: { duration: 1.6, repeat: Infinity } }}
      />
      {complete && !calm && (
        <motion.div
          aria-hidden
          className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent"
          initial={{ x: '-100%' }}
          animate={{ x: '400%' }}
          transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' }}
        />
      )}
    </div>
  )
}
