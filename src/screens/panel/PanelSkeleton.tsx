import { motion } from 'motion/react'
import { Screen } from '@/components/Screen'

/** Bloque gris que respira (opacity) mientras carga. */
function Block({ className }: { className: string }) {
  return (
    <motion.div
      className={`bg-track ${className}`}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.4, repeat: Infinity }}
    />
  )
}

export function PanelSkeleton() {
  return (
    <Screen className="gap-6" aria-busy="true">
      <Block className="h-7 w-40 rounded-chip" />
      <Block className="mx-auto h-24 w-48 rounded-card" />
      <Block className="h-14 rounded-chip" />
      <Block className="h-24 rounded-card" />
      <Block className="h-24 rounded-card" />
    </Screen>
  )
}
