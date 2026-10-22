import { motion } from 'motion/react'

/** Pantalla de espera mínima: un punto que respira (solo opacity/transform). */
export function FullScreenLoader() {
  return (
    <div className="grid min-h-dvh place-items-center" role="status" aria-label="Cargando">
      <motion.div
        className="bg-brand size-4 rounded-full"
        animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      />
    </div>
  )
}
