import { copy } from '@/copy'
import type { SkateHudData } from './controller.ts'

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

/** Vidas, avance del circuito, turbo y pausa. No tapa la pista ni intercepta los pulgares. */
export function SkateHud({ hud, onPause }: { hud: SkateHudData; onPause: () => void }) {
  const turboReady = hud.boost >= 60
  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div
          className="bg-bg/80 flex gap-0.5 rounded-2xl px-2 py-1.5 backdrop-blur-sm"
          role="img"
          aria-label={copy.skate.lives(hud.lives)}
        >
          {Array.from({ length: hud.maxLives }, (_, i) => (
            <Heart key={i} full={i < hud.lives} />
          ))}
        </div>

        <div
          className="bg-bg/80 relative mt-1.5 h-3 w-[38%] max-w-md rounded-full backdrop-blur-sm"
          role="progressbar"
          aria-label={copy.skate.progress}
          aria-valuenow={Math.round(hud.progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="bg-brand absolute inset-y-0 left-0 w-full origin-left rounded-full"
            style={{ transform: `scaleX(${hud.progress})` }}
          />
          {hud.checkpoints.map((ratio) => (
            <span
              key={ratio}
              className={`absolute top-1/2 size-2 -translate-1/2 rounded-full ring-2 ring-white ${hud.progress >= ratio ? 'bg-green' : 'bg-ink/50'}`}
              style={{ left: `${ratio * 100}%` }}
            />
          ))}
        </div>

        <button
          type="button"
          aria-label={copy.skate.pause}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onPause}
          className="bg-surface/90 pointer-events-auto grid size-11 place-items-center rounded-full text-lg shadow"
        >
          ❚❚
        </button>
      </div>

      <div className="absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-1/2 w-[34%] max-w-sm -translate-x-1/2">
        <div className="bg-bg/80 flex items-center gap-2 rounded-2xl px-3 py-1.5 backdrop-blur-sm">
          <span
            className={`font-display text-lg leading-none ${turboReady ? 'text-brand' : 'text-ink'}`}
          >
            {copy.skate.turboMeter}
          </span>
          <div className="bg-ink/20 h-2.5 flex-1 overflow-hidden rounded-full">
            <div
              className={`h-full origin-left rounded-full ${turboReady ? 'bg-brand' : 'bg-[#e0a21f]'}`}
              style={{ transform: `scaleX(${Math.min(1, hud.boost / 100)})` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
