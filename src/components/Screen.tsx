import { motion, type HTMLMotionProps } from 'motion/react'
import { duration } from '@/motion/presets'

/**
 * Contenedor estándar de pantalla: columna angosta, aire y respeto de las zonas seguras del celular.
 * Cada pantalla entra con un fundido y un leve ascenso (transición entre pantallas).
 */
export function Screen({ className = '', ...props }: HTMLMotionProps<'main'>) {
  return (
    <motion.main
      className={`mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))] ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.base, ease: 'easeOut' }}
      {...props}
    />
  )
}
