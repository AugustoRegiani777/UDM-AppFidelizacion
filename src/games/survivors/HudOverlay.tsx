import { AnimatePresence, motion } from 'motion/react'
import { copy } from '@/copy'
import { spring } from '@/motion/presets'

export interface HudData {
  hp: number
  maxHp: number
  secondsLeft: number
  totalSeconds: number
  level: number
  xpRatio: number
}

function Heart({ full }: { full: boolean }) {
  return (
    <svg viewBox="0 0 24 22" className="size-5" aria-hidden>
      <path
        d="M12 21 C4 14.5 1 10.5 1 6.8 C1 3.6 3.4 1.5 6.2 1.5 C8.6 1.5 10.7 2.9 12 5 C13.3 2.9 15.4 1.5 17.8 1.5 C20.6 1.5 23 3.6 23 6.8 C23 10.5 20 14.5 12 21 Z"
        fill={full ? '#c8102e' : 'rgba(42,26,20,0.25)'}
        stroke="#fff6e0"
        strokeWidth="1.6"
      />
    </svg>
  )
}

const format = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

interface HudOverlayProps {
  hud: HudData
  banner: 'boss' | 'wave' | null
  onPause: () => void
}

/** Datos en pantalla: vidas, tiempo que falta, nivel y experiencia. No tapa el juego ni intercepta toques. */
export function HudOverlay({ hud, banner, onPause }: HudOverlayProps) {
  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div
          className="bg-bg/80 flex max-w-[34%] flex-wrap gap-0.5 rounded-2xl px-2 py-1.5 backdrop-blur-sm"
          role="img"
          aria-label={copy.survivors.lives(hud.hp)}
        >
          {Array.from({ length: hud.maxHp }, (_, i) => (
            <Heart key={i} full={i < hud.hp} />
          ))}
        </div>

        <div className="bg-bg/80 rounded-2xl px-3 py-1 text-center backdrop-blur-sm">
          <p
            className="font-display text-ink text-4xl leading-none"
            role="timer"
            aria-label={copy.survivors.timeLeft}
          >
            {format(hud.secondsLeft)}
          </p>
          <div className="bg-ink/20 mx-auto mt-1 h-1.5 w-20 overflow-hidden rounded-full">
            <div
              className="bg-brand h-full origin-left rounded-full"
              style={{ transform: `scaleX(${1 - hud.secondsLeft / hud.totalSeconds})` }}
            />
          </div>
        </div>

        <button
          type="button"
          aria-label={copy.survivors.pause}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onPause}
          className="bg-surface/90 pointer-events-auto grid size-11 place-items-center rounded-full text-lg shadow"
        >
          ❚❚
        </button>
      </div>

      <div className="bg-bg/80 absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-3 rounded-2xl px-3 py-2 backdrop-blur-sm">
        <span className="font-display text-ink text-2xl leading-none">
          {copy.survivors.level(hud.level)}
        </span>
        <div className="bg-ink/20 h-2.5 flex-1 overflow-hidden rounded-full">
          <div
            className="h-full origin-left rounded-full bg-[#e0a21f]"
            style={{ transform: `scaleX(${Math.min(1, hud.xpRatio)})` }}
          />
        </div>
      </div>

      <AnimatePresence>
        {banner && (
          <motion.p
            key={banner}
            className="font-display text-brand absolute inset-x-0 top-1/4 text-center text-5xl drop-shadow-[0_2px_0_rgba(255,246,224,0.9)]"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.bouncy}
          >
            {banner === 'boss' ? copy.survivors.bossBanner : copy.survivors.waveBanner}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
