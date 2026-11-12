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

const LEFTY_KEY = 'migaskate.lefty'

function readLeftHanded(): boolean {
  try {
    return window.localStorage.getItem(LEFTY_KEY) === '1'
  } catch {
    return false
  }
}

const formatTime = (seconds: number) => {
  const whole = Math.ceil(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

/**
 * Tabla tactil: la silueta de la tabla marca donde apoyar el dedo (nariz, centro, cola). El hitbox real es
 * un 40 % mas ancho que la silueta (ver touchController.ts). Del lado de los controles hay una zona para
 * el segundo dedo: arrastrar de lado dobla, deslizar hacia arriba empuja.
 */
function Pad({
  portrait,
  reduced,
  leftHanded,
  onPointer,
}: {
  portrait: boolean
  reduced: boolean
  leftHanded: boolean
  onPointer: (
    kind: 'down' | 'move' | 'up' | 'cancel',
    id: number,
    u: number,
    v: number,
    t: number,
  ) => void
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
  // Zona del segundo dedo: del lado de la mano que no usa la tabla.
  const driveX = leftHanded ? -1.15 : 0.45
  return (
    <div
      ref={ref}
      data-testid="skate-pad"
      role="group"
      aria-label={copy.migaskate.padLabel}
      className={`absolute z-10 touch-none select-none ${
        portrait
          ? 'inset-x-0 bottom-0 h-[44%]'
          : `inset-y-0 w-[46%] ${leftHanded ? 'left-0' : 'right-0'}`
      }`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        const { u, v } = coords(e)
        onPointer('down', e.pointerId, u, v, e.timeStamp)
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
        const { u, v } = coords(e)
        onPointer('move', e.pointerId, u, v, e.timeStamp)
      }}
      onPointerUp={(e) => {
        const { u, v } = coords(e)
        onPointer('up', e.pointerId, u, v, e.timeStamp)
      }}
      onPointerCancel={(e) => onPointer('cancel', e.pointerId, 0, 0, e.timeStamp)}
    >
      <div className="bg-ink/25 absolute inset-2 rounded-3xl backdrop-blur-[2px]" />
      <svg
        viewBox="-1.25 -1 2.5 2"
        preserveAspectRatio="xMidYMid meet"
        className="pointer-events-none absolute inset-0 size-full"
        aria-hidden
      >
        {/* Zona del segundo dedo: doblar (de lado) y empujar (hacia arriba) */}
        <rect x={driveX} y="-0.8" width="0.7" height="1.6" rx="0.1" fill="#faf3e3" opacity="0.1" />
        <g
          stroke="#faf3e3"
          strokeWidth="0.035"
          strokeLinecap="round"
          fill="none"
          opacity="0.7"
          transform={`translate(${driveX + 0.35} 0.1)`}
        >
          <path d="M0 0.35 L0 -0.2" />
          <path d="M-0.07 -0.12 L0 -0.21 L0.07 -0.12" />
          <path d="M-0.22 0.45 L0.22 0.45" />
          <path d="M-0.15 0.39 L-0.22 0.45 L-0.15 0.51" />
          <path d="M0.15 0.39 L0.22 0.45 L0.15 0.51" />
        </g>
        <text
          x={driveX + 0.35}
          y="-0.55"
          fill="#faf3e3"
          fontFamily="Poppins, sans-serif"
          fontWeight="700"
          fontSize="0.085"
          textAnchor="middle"
          opacity="0.85"
        >
          {copy.migaskate.driveLabel}
        </text>
        {/* Hitbox: un 40 % mas ancho que la tabla (apenas insinuado) */}
        <rect
          x="-0.31"
          y="-0.98"
          width="0.62"
          height="1.96"
          rx="0.2"
          fill="none"
          stroke="#faf3e3"
          strokeWidth="0.012"
          strokeDasharray="0.04 0.05"
          opacity="0.25"
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
        {/* Limites de las zonas Nariz / Centro / Cola */}
        {[-0.6, 0.6].map((y) => (
          <path
            key={y}
            d={`M-0.31 ${-y} L0.31 ${-y}`}
            stroke="#faf3e3"
            strokeWidth="0.014"
            opacity="0.35"
          />
        ))}
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
          <text x="0" y="-0.7">
            {copy.migaskate.noseLabel}
          </text>
          <text x="0" y="0.77">
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
  const [leftHanded, setLeftHanded] = useState(readLeftHanded)
  const leftRef = useRef(leftHanded)

  useEffect(() => {
    onEndRef.current = onEnd
  })

  useEffect(() => {
    leftRef.current = leftHanded
    controllerRef.current?.setLeftHanded(leftHanded)
    try {
      window.localStorage.setItem(LEFTY_KEY, leftHanded ? '1' : '0')
    } catch {
      // Sin almacenamiento: queda solo para esta sesion.
    }
  }, [leftHanded])

  useEffect(() => {
    const timers: number[] = []
    const controller = new SkateController(
      canvasRef.current!,
      containerRef.current!,
      spot,
      {
        onPhase: setPhase,
        onHud: setHud,
        onPopup: (popup) => {
          setPopups((list) => [...list.slice(-2), popup])
          timers.push(
            window.setTimeout(
              () => setPopups((list) => list.filter((p) => p.id !== popup.id)),
              1600,
            ),
          )
        },
        onEnd: (result) => onEndRef.current(result),
      },
      { leftHanded: leftRef.current },
    )
    controllerRef.current = controller
    return () => {
      timers.forEach(window.clearTimeout)
      controller.dispose()
      controllerRef.current = null
    }
  }, [spot])

  const onPointer = useCallback(
    (kind: 'down' | 'move' | 'up' | 'cancel', id: number, u: number, v: number, t: number) =>
      controllerRef.current?.pointer(kind, id, u, v, t),
    [],
  )

  const name = copy.migaskate.spotName(def.id)

  return (
    <div
      ref={containerRef}
      data-skate-state={hud.state}
      className="bg-ink fixed inset-0 touch-none overflow-hidden select-none"
    >
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

        {hud.tutorial && phase === 'playing' && (
          <div
            className="bg-surface/95 text-ink rounded-card pointer-events-auto absolute top-[9.25rem] left-1/2 flex w-[min(92%,26rem)] -translate-x-1/2 items-center gap-3 px-3 py-2 shadow"
            role="status"
            data-testid="skate-tutorial"
          >
            <div className="min-w-0 flex-1">
              <p className="text-muted text-[0.7rem] font-bold tracking-wide uppercase">
                {copy.migaskate.tutorialTitle} ·{' '}
                {copy.migaskate.tutorialStep(
                  ['ollie', 'flip', 'catch'].indexOf(hud.tutorial) + 1,
                  3,
                )}
              </p>
              <p className="text-sm font-bold">{copy.migaskate.tutorial[hud.tutorial]}</p>
            </div>
            <button
              type="button"
              onClick={() => controllerRef.current?.skipTutorial()}
              className="text-muted min-h-11 shrink-0 px-2 text-sm underline"
            >
              {copy.migaskate.tutorialSkip}
            </button>
          </div>
        )}

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
        <Pad portrait={portrait} reduced={reduced} leftHanded={leftHanded} onPointer={onPointer} />
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
              checked={leftHanded}
              onChange={(e) => setLeftHanded(e.target.checked)}
            />
            {copy.migaskate.leftHanded}
          </label>
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
