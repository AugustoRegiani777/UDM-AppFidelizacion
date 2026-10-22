import { motion } from 'motion/react'
import { spring } from './presets'

interface ProgressBarProps {
  /** 0 a 1 */
  value: number
  label: string
  className?: string
}

/** Barra que se llena con spring. Anima scaleX (transform), nunca width. */
export function ProgressBar({ value, label, className = '' }: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), 1)
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={`bg-track h-3 overflow-hidden rounded-full ${className}`}
    >
      <motion.div
        className="bg-brand h-full origin-left rounded-full"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: clamped }}
        transition={spring.gentle}
      />
    </div>
  )
}
