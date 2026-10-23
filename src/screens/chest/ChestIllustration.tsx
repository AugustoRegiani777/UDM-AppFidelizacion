import { motion, useReducedMotion } from 'motion/react'
import { spring } from '@/motion/presets'

/** Cofre dibujado en SVG: flota despacito cerrado y, al abrirse, la tapa salta y sale luz dorada. */
export function ChestIllustration({ open }: { open: boolean }) {
  const calm = useReducedMotion()
  return (
    <motion.svg
      viewBox="0 0 160 140"
      className="mx-auto w-48"
      role="img"
      aria-label="Cofre"
      animate={open || calm ? undefined : { y: [0, -6, 0] }}
      transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <ellipse cx="80" cy="130" rx="52" ry="7" fill="rgba(42,26,20,0.18)" />
      <motion.g
        initial={false}
        animate={{ opacity: open ? 1 : 0, scale: open ? 1 : 0.5 }}
        transition={spring.gentle}
        style={{ transformOrigin: '80px 70px' }}
      >
        <circle cx="80" cy="70" r="60" fill="#f7c948" opacity="0.28" />
        <circle cx="80" cy="70" r="38" fill="#f7c948" opacity="0.35" />
      </motion.g>
      <rect
        x="28"
        y="64"
        width="104"
        height="58"
        rx="8"
        fill="#a8582c"
        stroke="#5b2f14"
        strokeWidth="3"
      />
      <rect x="28" y="84" width="104" height="8" fill="#5b2f14" opacity="0.45" />
      <rect
        x="72"
        y="76"
        width="16"
        height="22"
        rx="3"
        fill="#f7c948"
        stroke="#b8860b"
        strokeWidth="2"
      />
      <motion.g
        initial={false}
        animate={open ? { rotate: -38, y: -10 } : { rotate: 0, y: 0 }}
        transition={spring.bouncy}
        style={{ transformOrigin: '30px 64px' }}
      >
        <path
          d="M24 64 Q24 34 80 34 Q136 34 136 64 Z"
          fill="#c8102e"
          stroke="#5b2f14"
          strokeWidth="3"
        />
        <rect x="68" y="34" width="24" height="30" fill="#f7c948" opacity="0.9" />
      </motion.g>
    </motion.svg>
  )
}
