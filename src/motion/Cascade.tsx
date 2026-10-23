import { motion, type HTMLMotionProps } from 'motion/react'
import { spring } from './presets'

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: spring.gentle },
}

/** Entrada en cascada: los hijos `CascadeItem` aparecen uno tras otro. */
export function Cascade(props: HTMLMotionProps<'div'>) {
  return <motion.div variants={container} initial="hidden" animate="show" {...props} />
}

export function CascadeItem(props: HTMLMotionProps<'div'>) {
  return <motion.div variants={item} {...props} />
}
