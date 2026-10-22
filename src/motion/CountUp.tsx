import { animate, useMotionValue, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { spring } from './presets'

interface CountUpProps {
  value: number
  from?: number
  className?: string
}

/** Número que sube con spring (saldo, "+62"). Con reduced-motion muestra el valor final. */
export function CountUp({ value, from = 0, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const reduce = useReducedMotion()
  const current = useMotionValue(reduce ? value : from)

  useEffect(() => {
    if (reduce) {
      current.set(value)
      return
    }
    const controls = animate(current, value, spring.gentle)
    return () => controls.stop()
  }, [value, reduce, current])

  useEffect(() => {
    const render = (v: number) => {
      if (ref.current) ref.current.textContent = Math.round(v).toLocaleString('es-AR')
    }
    render(current.get())
    return current.on('change', render)
  }, [current])

  return <span ref={ref} className={className} aria-label={String(value)} />
}
