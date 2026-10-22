import type { Transition } from 'motion/react'

/** Springs y duraciones compartidas. Todo se anima con transform/opacity. */
export const spring = {
  snappy: { type: 'spring', stiffness: 520, damping: 34 },
  bouncy: { type: 'spring', stiffness: 380, damping: 14 },
  gentle: { type: 'spring', stiffness: 120, damping: 20 },
} as const satisfies Record<string, Transition>

export const duration = { fast: 0.15, base: 0.25, slow: 0.5 } as const
