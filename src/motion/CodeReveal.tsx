import { motion } from 'motion/react'

const LETTER_DELAY = 0.09

/** El código se "imprime" letra por letra. Con reduced-motion MotionConfig lo deja como fundido simple. */
export function CodeReveal({ code, className = '' }: { code: string; className?: string }) {
  return (
    <p className={className} aria-label={code}>
      {[...code].map((char, index) => (
        <motion.span
          key={index}
          aria-hidden
          className="inline-block"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.15 + index * LETTER_DELAY,
            type: 'spring',
            stiffness: 500,
            damping: 22,
          }}
        >
          {char}
        </motion.span>
      ))}
    </p>
  )
}
