import { AnimatePresence, motion } from 'motion/react'
import type { PowerId } from '@engine/config.ts'
import { copy } from '@/copy'
import { spring } from '@/motion/presets'

export interface PowerHud {
  /** Nivel del poder (0 = todavía no se eligió). */
  level: number
  /** Burbujas listas para soltar. */
  charges: number
}

export interface HudData {
  hp: number
  maxHp: number
  /** 'survive' = el minuto de hormigas; 'boss' = pelea con la Reina. */
  phase: 'survive' | 'boss'
  /** Segundos que faltan para la Reina (minuto) o para que se escape (pelea). */
  secondsLeft: number
  totalSeconds: number
  /** Vida de la Reina de 0 a 1 mientras está en escena. */
  queenRatio: number | null
  level: number
  xpRatio: number
  /** Soldados, chipás y cebo, en ese orden. */
  powers: PowerHud[]
}

/** Poderes en el mismo orden que el motor (índice = el que se manda al soltarlos). */
const POWER_IDS: readonly PowerId[] = ['soldiers', 'chipas', 'bait']

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
  /** Suelta el poder `index` (0 = soldados, 1 = chipás, 2 = cebo). */
  onCast: (index: number) => void
}

/** Una burbuja de poder: se llena con el tiempo y se toca para soltarla. */
function PowerBubble({
  id,
  index,
  power,
  onCast,
}: {
  id: PowerId
  index: number
  power: PowerHud
  onCast: (index: number) => void
}) {
  const info = copy.survivors.upgrades[id]
  const ready = power.charges > 0
  return (
    <button
      type="button"
      aria-label={copy.survivors.powerBubble(info.name, power.charges)}
      aria-disabled={!ready}
      onPointerDown={(e) => {
        // No arranca el joystick y se suelta al instante, sin esperar a que levantes el dedo.
        e.stopPropagation()
        if (ready) onCast(index)
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && ready) onCast(index)
      }}
      className="pointer-events-auto relative grid size-16 place-items-center rounded-full border-2 border-white/80 shadow-lg"
      style={{
        background:
          'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.95), rgba(196,228,255,0.6) 55%, rgba(120,170,230,0.4))',
        opacity: ready ? 1 : 0.5,
      }}
    >
      <motion.span
        key={power.charges}
        className="text-3xl leading-none"
        initial={{ scale: ready ? 0.6 : 1 }}
        animate={{ scale: 1 }}
        transition={spring.bouncy}
        aria-hidden
      >
        {info.icon}
      </motion.span>
      <span
        className="bg-ink text-bg absolute -top-1 -right-1 grid size-6 place-items-center rounded-full text-xs font-bold"
        aria-hidden
      >
        {power.charges}
      </span>
      <span className="text-ink/70 absolute -bottom-4 text-[10px] font-bold" aria-hidden>
        {index + 1}
      </span>
    </button>
  )
}

/** Datos en pantalla: vidas, reloj, Reina, burbujas de poder, nivel y experiencia. Solo los botones reciben toques. */
export function HudOverlay({ hud, banner, onPause, onCast }: HudOverlayProps) {
  const boss = hud.phase === 'boss'
  const owned = POWER_IDS.map((id, index) => ({ id, index, power: hud.powers[index]! })).filter(
    (p) => p.power.level > 0,
  )
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
          <p className="text-ink/70 text-[11px] leading-none font-bold">
            {boss ? copy.survivors.queenFight : copy.survivors.queenIn}
          </p>
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
              style={{
                transform: `scaleX(${Math.min(1, Math.max(0, 1 - hud.secondsLeft / hud.totalSeconds))})`,
              }}
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

      {boss && hud.queenRatio !== null && (
        <div
          className="bg-bg/80 absolute inset-x-3 top-[calc(max(0.75rem,env(safe-area-inset-top))+5.75rem)] flex items-center gap-2 rounded-2xl px-3 py-1.5 backdrop-blur-sm"
          role="img"
          aria-label={`${copy.survivors.queenLife}: ${Math.round(hud.queenRatio * 100)} %`}
        >
          <span aria-hidden>👑</span>
          <div className="bg-ink/20 h-3 flex-1 overflow-hidden rounded-full">
            <div
              className="bg-brand h-full origin-left rounded-full"
              style={{ transform: `scaleX(${hud.queenRatio})` }}
            />
          </div>
        </div>
      )}

      {owned.length > 0 && (
        <div className="absolute inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] flex items-end justify-center gap-5">
          {owned.map(({ id, index, power }) => (
            <PowerBubble key={id} id={id} index={index} power={power} onCast={onCast} />
          ))}
        </div>
      )}

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
