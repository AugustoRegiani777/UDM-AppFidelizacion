import { motion } from 'motion/react'
import { copy } from '@/copy'

export const MATE_SIPS = 4

interface MateViewProps {
  sips: number
  luck: number
  sipping: boolean
  filling: boolean
  onTap: () => void
  onSipDone: () => void
}

const STEAM = [
  { x: 52, delay: 0 },
  { x: 62, delay: 0.7 },
  { x: 72, delay: 1.4 },
]

/** El mate sobre la mesa: se toca para tomar (se levanta hacia vos y baja el agua) o para cebar de nuevo. */
export function MateView({ sips, luck, sipping, filling, onTap, onSipDone }: MateViewProps) {
  const empty = sips === 0
  return (
    <div className="flex flex-col items-center gap-1">
      <motion.button
        type="button"
        onClick={onTap}
        disabled={sipping || filling}
        aria-label={empty ? copy.truco.mateRefill : copy.truco.mateSip}
        className="relative block h-[112px] w-[96px] origin-bottom"
        animate={
          sipping
            ? {
                x: [0, 8, 8, 0],
                y: [0, 74, 74, 0],
                rotate: [0, -32, -32, 0],
                scale: [1, 1.12, 1.12, 1],
              }
            : { x: 0, y: 0, rotate: 0, scale: 1 }
        }
        transition={
          sipping
            ? { duration: 1.9, times: [0, 0.3, 0.75, 1], ease: 'easeInOut' }
            : { duration: 0.2 }
        }
        onAnimationComplete={() => sipping && onSipDone()}
        whileTap={sipping ? undefined : { scale: 0.94 }}
      >
        <svg viewBox="0 0 120 140" className="h-full w-full drop-shadow-lg" aria-hidden>
          {/* sombra sobre la mesa */}
          <ellipse cx="58" cy="132" rx="36" ry="7" fill="rgba(0,0,0,0.28)" />
          {/* calabaza */}
          <path
            d="M24,70 C22,108 40,128 60,128 C80,128 98,108 96,70 C94,56 78,50 60,50 C42,50 26,56 24,70 Z"
            fill="#8b5a2b"
            stroke="#2a1a14"
            strokeWidth="2.5"
          />
          <path
            d="M34,76 C34,100 44,116 58,120"
            fill="none"
            stroke="#b5803f"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.7"
          />
          {/* boca con la yerba */}
          <ellipse cx="60" cy="52" rx="29" ry="9" fill="#2a1a14" />
          <ellipse cx="60" cy="52" rx="25" ry="6.5" fill={empty ? '#9a8a6a' : '#5f8a2e'} />
          {!empty && <ellipse cx="56" cy="50" rx="13" ry="3.4" fill="#86c35f" />}
          {/* aro de metal */}
          <path
            d="M26,66 C40,74 80,74 94,66"
            fill="none"
            stroke="#c9d0da"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* bombilla */}
          <path d="M70,52 L100,14" stroke="#e8edf3" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M70,52 L100,14" stroke="#9aa6b4" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="102" cy="11" r="4" fill="#e8edf3" stroke="#9aa6b4" strokeWidth="1.2" />
        </svg>

        {!empty &&
          !sipping &&
          STEAM.map((s) => (
            <motion.span
              key={s.x}
              className="absolute top-3 block h-5 w-1.5 rounded-full bg-white/70"
              style={{ left: s.x }}
              animate={{ y: [0, -14], opacity: [0, 0.7, 0] }}
              transition={{ duration: 2.1, repeat: Infinity, delay: s.delay, ease: 'easeOut' }}
            />
          ))}

        {sipping &&
          [0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute top-4 left-[78px] block size-2 rounded-full bg-white/80"
              animate={{ y: [0, -16], opacity: [0, 1, 0] }}
              transition={{ duration: 0.6, repeat: 2, delay: 0.55 + i * 0.12 }}
            />
          ))}
      </motion.button>

      <div className="flex gap-1" aria-label={copy.truco.sipsLeft(sips)} role="img">
        {Array.from({ length: MATE_SIPS }, (_, i) => (
          <span
            key={i}
            className={`size-2 rounded-full ${i < sips ? 'bg-[#86c35f]' : 'bg-bg/25'}`}
          />
        ))}
      </div>
      <p className="text-bg/90 text-center text-xs leading-tight font-semibold">
        {filling ? copy.truco.mateFilling : empty ? copy.truco.mateRefill : copy.truco.mateSip}
      </p>
      <div className="flex items-center gap-0.5" role="img" aria-label={copy.truco.luckLabel(luck)}>
        {Array.from({ length: 3 }, (_, i) => (
          <motion.span
            key={i}
            className={`text-lg ${i < luck ? '' : 'opacity-25 grayscale'}`}
            animate={i < luck ? { scale: [1, 1.25, 1] } : { scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            🍀
          </motion.span>
        ))}
      </div>
    </div>
  )
}
