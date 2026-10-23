import { animate, motion, useMotionValue, useReducedMotion } from 'motion/react'
import { forwardRef, useImperativeHandle } from 'react'
import type { Prize } from '@/features/games/gameApi'
import { spring } from '@/motion/presets'

const SIZE = 300
const CENTER = SIZE / 2
const RADIUS = 140
const FULL_TURNS = 6
const COLORS = ['#c8102e', '#faf3e3', '#2a1a14', '#efe2c8']

export interface RouletteHandle {
  /** Gira hasta dejar el premio decidido por el servidor bajo la flecha. Resuelve al terminar. */
  spinTo: (prizeIndex: number) => Promise<void>
}

function polar(angleDeg: number, radius: number) {
  const radians = ((angleDeg - 90) * Math.PI) / 180
  return { x: CENTER + radius * Math.cos(radians), y: CENTER + radius * Math.sin(radians) }
}

function segmentPath(start: number, end: number) {
  const a = polar(start, RADIUS)
  const b = polar(end, RADIUS)
  return `M ${CENTER} ${CENTER} L ${a.x} ${a.y} A ${RADIUS} ${RADIUS} 0 0 1 ${b.x} ${b.y} Z`
}

/**
 * Ruleta en SVG. La rotación es un transform: gira rápido, desacelera y rebota un poquito al frenar.
 * El resultado ya está decidido; acá solo se calcula el ángulo para que caiga en ese gajo.
 */
export const RouletteWheel = forwardRef<RouletteHandle, { prizes: Prize[] }>(function RouletteWheel(
  { prizes },
  ref,
) {
  const rotate = useMotionValue(0)
  const calm = useReducedMotion()
  const segment = 360 / prizes.length

  useImperativeHandle(ref, () => ({
    async spinTo(prizeIndex) {
      // Un poco de azar visual dentro del gajo para que no caiga siempre al centro.
      const jitter = (Math.random() - 0.5) * segment * 0.6
      const target = FULL_TURNS * 360 - (prizeIndex * segment + segment / 2) + jitter
      if (calm) {
        rotate.set(target)
        return
      }
      await animate(rotate, target + 9, { duration: 4.2, ease: [0.12, 0.8, 0.2, 1] })
      await animate(rotate, target, spring.bouncy)
    },
  }))

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[300px]">
      <div
        aria-hidden
        className="border-t-ink absolute top-[-6px] left-1/2 z-10 -translate-x-1/2 border-x-[12px] border-t-[22px] border-x-transparent"
      />
      <motion.div className="size-full" style={{ rotate }}>
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="size-full" role="img" aria-label="Ruleta">
          {prizes.map((prize, index) => {
            const start = index * segment
            const mid = start + segment / 2
            const color = COLORS[index % COLORS.length]
            const dark = color === '#c8102e' || color === '#2a1a14'
            const label = polar(mid, RADIUS * 0.62)
            return (
              <g key={prize.id}>
                <path
                  d={segmentPath(start, start + segment)}
                  fill={color}
                  stroke="#faf3e3"
                  strokeWidth="2"
                />
                <text
                  x={label.x}
                  y={label.y}
                  transform={`rotate(${mid} ${label.x} ${label.y})`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize="22"
                  fontFamily="'Bebas Neue', sans-serif"
                  fill={dark ? '#faf3e3' : '#2a1a14'}
                >
                  {prize.points > 0 ? prize.label : '·'}
                </text>
              </g>
            )
          })}
          <circle cx={CENTER} cy={CENTER} r="18" fill="#faf3e3" stroke="#2a1a14" strokeWidth="3" />
        </svg>
      </motion.div>
    </div>
  )
})
