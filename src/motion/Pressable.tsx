import { motion, type HTMLMotionProps } from 'motion/react'
import { spring } from './presets'

/** Feedback táctil para todo lo tocable: escala 0.97 al apretar. */
export function Pressable(props: HTMLMotionProps<'button'>) {
  return (
    <motion.button type="button" whileTap={{ scale: 0.97 }} transition={spring.snappy} {...props} />
  )
}
