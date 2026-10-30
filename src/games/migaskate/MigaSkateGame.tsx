import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { copy } from '@/copy'
import { spring } from '@/motion/presets'
import { setSoundEnabled, useSoundEnabled } from '@/motion/preferences'
import { usePortrait } from '../shared/landscape.ts'
import {
  hudOf,
  SkateController,
  type SkateHud,
  type SkatePhase,
  type SkatePopup,
  type SkateResult,
} from './controller.ts'
import { SkateSession } from './session.ts'
import { spotAt } from './spots.ts'

interface MigaSkateGameProps {
  spot: number
  onEnd: (result: SkateResult) => void
  onExit: () => void
}

function Backdrop({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <motion.div
      className="bg-ink/75 absolute inset-0 z-30 grid place-items-center overflow-y-auto p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <motion.div
        className="bg-surface text-ink rounded-card flex max-h-full w-full max-w-lg flex-col gap-3 overflow-y-auto p-5 text-center"
        initial={{ scale: 0.9, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={spring.bouncy}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

const formatTime = (seconds: number) => {
  const whole = Math.ceil(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/** Tabla tactil: la silueta de la tabla marca donde apoyar el dedo (cola, nariz, costados, centro). */
function Pad({
  portrait,
  reduced,
  onPointer,
}: {
  portrait: boolean
  reduced: boolean
  onPointer: (kind: 'down' | 'move' | 'up' | 'cancel', id: number, u: number, v: number) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const coords = (e: React.PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect()
    const scale = Math.min(rect.width, rect.height) / 2
    return {
      u: (e.clientX - (rect.left + rect.width / 2)) / scale,
      v: -(e.clientY - (rect.top + rect.height / 2)) / scale,
    }
  }
  return (
    <div
      ref={ref}
      data-testid="skate-pad"
      role="group"
      aria-label={copy.migaskate.padLabel}
      className={`absolute z-10 touch-none select-none ${
        portrait ? 'inset-x-0 bottom-0 h-[44%]' : 'inset-y-0 right-0 w-[46%]'
      }`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        const { u, v } = coords(e)
        onPointer('down', e.pointerId, u, v)
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
        const { u, v } = coords(e)
        onPointer('move', e.pointerId, u, v)
      }}
      onPointerUp={(e) => {
        const { u, v } = coords(e)
        onPointer('up', e.pointerId, u, v)
      }}
      onPointerCancel={(e) => onPointer('cancel', e.pointerId, 0, 0)}
    >
      <div className="bg-ink/25 absolute inset-2 rounded-3xl backdrop-blur-[2px]" />
      <svg
        viewBox="-1.25 -1 2.5 2"
        preserveAspectRatio="xMidYMid meet"
        className="pointer-events-none absolute inset-0 size-full"
        aria-hidden
      >
        {/* Zonas de los costados */}
        <rect
          x="-0.9"
          y="-0.28"
          width="0.58"
          height="0.56"
          rx="0.08"
          fill="#faf3e3"
          opacity="0.1"
        />
        <rect
          x="0.32"
          y="-0.28"
          width="0.58"
          height="0.56"
          rx="0.08"
          fill="#faf3e3"
          opacity="0.1"
        />
        {/* Tabla */}
        <rect x="-0.2" y="-0.82" width="0.4" height="1.64" rx="0.2" fill="#c8102e" opacity="0.92" />
        <rect
          x="-0.17"
          y="-0.76"
          width="0.34"
          height="1.52"
          rx="0.17"
          fill="#2a2320"
          opacity="0.75"
        />
        {[-0.5, 0.5].map((y) => (
          <g key={y}>
            <rect x="-0.27" y={y - 0.05} width="0.07" height="0.1" rx="0.03" fill="#faf3e3" />
            <rect x="0.2" y={y - 0.05} width="0.07" height="0.1" rx="0.03" fill="#faf3e3" />
          </g>
        ))}
        <g
          fill="#faf3e3"
          fontFamily="Poppins, sans-serif"
          fontWeight="700"
          fontSize="0.1"
          textAnchor="middle"
        >
          <text x="0" y="-0.6">
            {copy.migaskate.noseLabel}
          </text>
          <text x="0" y="0.67">
            {copy.migaskate.tailLabel}
          </text>
        </g>
        {/* Flecha del ollie */}
        <g
          stroke="#faf3e3"
          strokeWidth="0.045"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
          className={reduced ? undefined : 'animate-pulse'}
        >
          <path d="M0 0.5 L0 0.05" />
          <path d="M-0.08 0.13 L0 0.04 L0.08 0.13" />
        </g>
      </svg>
    </div>
  )
}

/** Pantalla de Miga Skate: el canvas 3D lo maneja el controlador; aca solo hay HUD, menus y la tabla tactil. */
export function MigaSkateGame({ spot, onEnd, onExit }: MigaSkateGameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controllerRef = useRef<SkateController | null>(null)
  const onEndRef = useRef(onEnd)
  const portrait = usePortrait()
  const sound = useSoundEnabled()
  const reduced = useReducedMotion() ?? false
  const def = spotAt(spot)
  const [phase, setPhase] = useState<SkatePhase>('loading')
  const [hud, setHud] = useState<SkateHud>(() => hudOf(new SkateSession(def)))
  const [popups, setPopups] = useState<SkatePopup[]>([])

  useEffect(() => {
    onEndRef.current = onEnd
  })

  useEffect(() => {
    const timers: number[] = []
    const controller = new SkateController(canvasRef.current!, containerRef.current!, spot, {
      onPhase: setPhase,
      onHud: setHud,
      onPopup: (popup) => {
        setPopups((list) => [...list.slice(-2), popup])
        timers.push(
          window.setTimeout(() => setPopups((list) => list.filter((p) => p.id !== popup.id)), 1600),
        )
      },
      onEnd: (result) => onEndRef.current(result),
    })
    controllerRef.current = controller
    return () => {
      timers.forEach(window.clearTimeout)
      controller.dispose()
      controllerRef.current = null
    }
  }, [spot])

  const onPointer = useCallback(
    (kind: 'down' | 'move' | 'up' | 'cancel', id: number, u: number, v: number) =>
      controllerRef.current?.pointer(kind, id, u, v),
    [],
  )

  const name = copy.migaskate.spotName(def.id)

  return (
    <div ref={containerRef} className="bg-ink fixed inset-0 touch-none overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="block"
        role="img"
        aria-label={copy.migaskate.title}
        data-testid="skate-canvas"
      />

      <div className="pointer-events-none absolute inset-0 z-20">
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="bg-bg/85 rounded-2xl px-3 py-1 backdrop-blur-sm">
            <p className="text-muted text-xs">{copy.migaskate.score}</p>
            <p
              className="font-display text-ink text-4xl leading-none"
              aria-live="off"
              data-testid="skate-score"
            >
              {hud.score}
            </p>
            {hud.comboCount > 0 && (
              <p className="text-brand-ink text-sm font-bold">
                {copy.migaskate.comboLabel} {hud.combo} · x{hud.mult.toFixed(1)}
              </p>
            )}
          </div>
          <div className="flex items-start gap-2">
            <div className="bg-bg/85 rounded-2xl px-3 py-1 text-center backdrop-blur-sm">
              <p className="text-muted text-xs">{copy.migaskate.timeLeft}</p>
              <p
                className="font-display text-ink text-3xl leading-none"
                role="timer"
                aria-label={copy.migaskate.timeLeft}
              >
                {formatTime(hud.timeLeft)}
              </p>
            </div>
            <button
              type="button"
              aria-label={copy.migaskate.pause}
              onClick={() => controllerRef.current?.pause()}
              className="bg-surface/90 pointer-events-auto grid size-11 place-items-center rounded-full text-lg shadow"
            >
              ❚❚
            </button>
          </div>
        </div>

        <ul
          className="absolute left-3 top-[5.6rem] flex max-w-[60%] flex-col gap-1"
          aria-label={copy.migaskate.objectivesTitle}
        >
          {def.objectives.map((o, i) => {
            const p = hud.progress[i]
            return (
              <li
                key={i}
                className={`bg-bg/80 rounded-chip flex items-center gap-2 px-2 py-0.5 text-xs backdrop-blur-sm ${
                  hud.done[i] ? 'text-green font-bold' : 'text-ink'
                }`}
              >
                <span aria-hidden>{hud.done[i] ? '⭐' : '☆'}</span>
                <span>{copy.migaskate.objective(o)}</span>
                {!hud.done[i] && p && p.target > 1 && (
                  <span className="text-muted">
                    {Math.min(p.target, Math.floor(p.value * 10) / 10)}/{p.target}
                  </span>
                )}
              </li>
            )
          })}
        </ul>

        {hud.balance !== null && (
          <div
            className="bg-bg/85 absolute left-1/2 top-[7.5rem] h-3 w-40 -translate-x-1/2 overflow-hidden rounded-full"
            role="meter"
            aria-label={copy.migaskate.balance}
            aria-valuemin={-1}
            aria-valuemax={1}
            aria-valuenow={Math.round(hud.balance * 100) / 100}
          >
            <div className="bg-ink/20 absolute inset-y-0 left-1/2 w-px" />
            <div
              className={`absolute top-0 h-3 w-4 rounded-full ${
                Math.abs(hud.balance) > 0.7 ? 'bg-brand' : 'bg-green'
              }`}
              style={{ left: `calc(${50 + hud.balance * 46}% - 0.5rem)` }}
            />
          </div>
        )}

        <div
          className={`absolute inset-x-0 flex flex-col items-center gap-1 ${
            portrait ? 'bottom-[48%]' : 'bottom-4 right-[46%] left-0'
          }`}
          aria-live="polite"
        >
          <AnimatePresence initial={false}>
            {popups.map((p) => (
              <motion.p
                key={p.id}
                layout={!reduced}
                className={`font-display rounded-chip px-3 py-0.5 text-center text-2xl leading-tight shadow ${
                  p.kind === 'trick'
                    ? 'bg-brand text-white'
                    : p.kind === 'bank'
                      ? 'bg-green text-white'
                      : p.kind === 'objective'
                        ? 'bg-bg text-ink'
                        : 'bg-bg/90 text-ink'
                }`}
                initial={{ opacity: 0, y: reduced ? 0 : 14, scale: reduced ? 1 : 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={spring.bouncy}
              >
                {p.text}
              </motion.p>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {(phase === 'playing' || phase === 'paused') && (
        <Pad portrait={portrait} reduced={reduced} onPointer={onPointer} />
      )}

      {phase === 'loading' && (
        <div className="bg-ink/70 absolute inset-0 z-30 grid place-items-center">
          <p className="font-display text-bg text-3xl" role="status">
            {copy.migaskate.loading}
          </p>
        </div>
      )}

      {phase === 'error' && (
        <Backdrop label={copy.migaskate.title}>
          <h2 className="font-display text-4xl leading-none">{copy.migaskate.noWebglTitle}</h2>
          <p className="text-muted">{copy.migaskate.noWebglBody}</p>
          <Button onClick={onExit}>{copy.migaskate.exit}</Button>
        </Backdrop>
      )}

      {phase === 'ready' && (
        <Backdrop label={copy.migaskate.title}>
          <h2 className="font-display text-5xl leading-none">{copy.migaskate.title}</h2>
          <p className="text-brand-ink text-xl font-bold">{name}</p>
          <p className="text-muted text-sm">{copy.migaskate.goal(def.seconds)}</p>
          <ul className="flex flex-col gap-1 text-left text-sm font-bold">
            {def.objectives.map((o, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden>☆</span>
                {copy.migaskate.objective(o)}
              </li>
            ))}
          </ul>
          <ul className="text-muted flex flex-col gap-2 text-left text-sm">
            {copy.migaskate.guide.map((line) => (
              <li key={line.text} className="flex items-start gap-3">
                <span className="text-xl" aria-hidden>
                  {line.icon}
                </span>
                <span>{line.text}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted text-xs">{copy.migaskate.keyboardHint}</p>
          <Button onClick={() => controllerRef.current?.start()}>{copy.migaskate.play}</Button>
          <label className="text-muted flex min-h-11 items-center justify-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-brand size-5"
              checked={sound}
              onChange={(e) => setSoundEnabled(e.target.checked)}
            />
            {copy.profile.sound}
          </label>
          <button type="button" onClick={onExit} className="text-muted min-h-11 text-sm underline">
            {copy.migaskate.exit}
          </button>
        </Backdrop>
      )}

      {phase === 'paused' && (
        <Backdrop label={copy.migaskate.pause}>
          <h2 className="font-display text-5xl leading-none">{copy.migaskate.pause}</h2>
          <Button onClick={() => controllerRef.current?.resume()}>{copy.migaskate.resume}</Button>
          <Button variant="ghost" onClick={() => controllerRef.current?.finishNow()}>
            {copy.migaskate.finishSession}
          </Button>
          <Button variant="ghost" onClick={onExit}>
            {copy.migaskate.exit}
          </Button>
        </Backdrop>
      )}

      {phase === 'ended' && (
        <motion.div
          className="bg-ink/55 absolute inset-0 z-30 grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.p
            className="font-display text-bg text-center text-6xl leading-none"
            initial={{ scale: reduced ? 1 : 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={spring.bouncy}
          >
            {hud.stars >= 3 ? copy.migaskate.allDone : copy.migaskate.ended}
          </motion.p>
        </motion.div>
      )}
    </div>
  )
}
