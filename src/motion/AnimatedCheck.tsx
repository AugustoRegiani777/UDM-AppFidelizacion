import { motion } from 'motion/react'

/** Check que se dibuja solo: el círculo hace un pop y el tilde se traza (pathLength). */
export function AnimatedCheck({ className = '' }: { className?: string }) {
  return (
    <motion.svg
      viewBox="0 0 52 52"
      className={`size-24 ${className}`}
      initial={{ scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 14 }}
      role="img"
      aria-label="Listo"
    >
      <circle cx="26" cy="26" r="25" fill="currentColor" />
      <motion.path
        d="M14 27 l8 8 l16 -17"
        fill="none"
        stroke="#fff"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.25, duration: 0.45, ease: 'easeOut' }}
      />
    </motion.svg>
  )
}
