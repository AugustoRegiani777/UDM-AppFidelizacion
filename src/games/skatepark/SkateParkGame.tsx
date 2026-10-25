import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { copy } from '@/copy'
import { spring } from '@/motion/presets'
import { setSoundEnabled, useSoundEnabled } from '@/motion/preferences'
import { enterLandscape, usePortrait } from '../shared/landscape.ts'
import { RotateOverlay } from '../skate/SkateOverlays.tsx'
import {
  ParkController,
  parkHudOf,
  type ParkHud,
  type ParkPhase,
  type ParkResult,
} from './controller.ts'
import { createPark, LEVELS, STAR_MULTIPLIERS } from './sim.ts'

interface SkateParkGameProps {
  level: number
  seed: number
  onEnd: (result: ParkResult) => void
  onExit: () => void
}

const label = (name: string) => (copy.skatepark.tricks as Record<string, string>)[name] ?? name

function Backdrop({ children, label: aria }: { children: React.ReactNode; label: string }) {
  return (
    <motion.div
      className="bg-ink/75 absolute inset-0 z-20 grid place-items-center overflow-y-auto p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="dialog"
      aria-modal="true"
      aria-label={aria}
    >
      <motion.div
        className="bg-surface text-ink rounded-card flex w-full max-w-lg flex-col gap-3 p-5 text-center"
        initial={{ scale: 0.9, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={spring.bouncy}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

/** Pantalla del Skate Spot: el canvas lo maneja el controlador; acá solo hay HUD y menús. */
export function SkateParkGame({ level, seed, onEnd, onExit }: SkateParkGameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controllerRef = useRef<ParkController | null>(null)
  const onEndRef = useRef(onEnd)
  const portrait = usePortrait()
  const sound = useSoundEnabled()
  const [phase, setPhase] = useState<ParkPhase>('ready')
  const [hud, setHud] = useState<ParkHud>(() => parkHudOf(createPark(level, seed)))

  useEffect(() => {
    onEndRef.current = onEnd
  })

  useEffect(() => {
    const controller = new ParkController(canvasRef.current!, containerRef.current!, level, seed, {
      onPhase: setPhase,
      onHud: setHud,
      onEnd: (result) => onEndRef.current(result),
    })
    controllerRef.current = controller
    return () => {
      controller.dispose()
      controllerRef.current = null
    }
  }, [level, seed])

  // Si el celular se pone en vertical a mitad de la sesión, se pausa sola.
  useEffect(() => {
    if (portrait) controllerRef.current?.pause()
  }, [portrait])

  // Al salir se suelta la pantalla completa.
  useEffect(
    () => () => {
      if (document.fullscreenElement) void document.exitFullscreen?.()
    },
    [],
  )

  const def = LEVELS[level - 1]!
  const max = def.target * STAR_MULTIPLIERS[2]
  const comboText = hud.comboNames.map(label).join(' + ')

  return (
    <div
      ref={containerRef}
      className="bg-ink fixed inset-0 grid touch-none place-items-center overflow-hidden select-none"
    >
      <canvas ref={canvasRef} className="block" role="img" aria-label={copy.skatepark.title} />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <div className="bg-bg/85 min-w-32 rounded-2xl px-3 py-1 backdrop-blur-sm">
            <p className="text-muted text-[10px] leading-none font-bold uppercase">
              {copy.skatepark.score}
            </p>
            <p className="font-display text-ink text-4xl leading-none" aria-live="off">
              {hud.score}
            </p>
            <div className="bg-ink/15 relative mt-1 h-1.5 overflow-hidden rounded-full">
              <div
                className="h-full origin-left rounded-full bg-[#e0a21f]"
                style={{ transform: `scaleX(${Math.min(1, hud.score / max)})` }}
              />
            </div>
            <div
              className="mt-0.5 flex justify-between text-sm leading-none"
              aria-label={copy.skatepark.stars(hud.stars)}
            >
              {[1, 2, 3].map((n) => (
                <span key={n} className={n <= hud.stars ? '' : 'opacity-25 grayscale'}>
                  ⭐
                </span>
              ))}
            </div>
          </div>

          <div className="bg-bg/85 rounded-2xl px-3 py-1 text-center backdrop-blur-sm">
            <p
              className="font-display text-ink text-4xl leading-none"
              role="timer"
              aria-label={copy.skatepark.timeLeft}
            >
              {hud.seconds}
            </p>
          </div>

          <button
            type="button"
            aria-label={copy.skatepark.pause}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => controllerRef.current?.pause()}
            className="bg-surface/90 pointer-events-auto grid size-11 place-items-center rounded-full text-lg shadow"
          >
            ❚❚
          </button>
        </div>

        {/* Turbo: la barra está abajo a la izquierda, cerca del pulgar que lo maneja. */}
        <div className="absolute bottom-3 left-3 w-44 pb-[env(safe-area-inset-bottom)]">
          <motion.p
            className={`font-display text-2xl leading-none ${hud.turboOn ? 'text-[#ffb02e]' : 'text-bg'} drop-shadow-[0_1px_0_rgba(42,26,20,0.8)]`}
            animate={hud.turboOn ? { opacity: [1, 0.65, 1] } : { opacity: 1 }}
            transition={hud.turboOn ? { duration: 0.35, repeat: Infinity } : { duration: 0.1 }}
          >
            {copy.skatepark.turbo}
          </motion.p>
          <div className="bg-ink/60 mt-1 h-3.5 overflow-hidden rounded-full border border-white/40">
            <div
              className={`h-full origin-left rounded-full ${hud.turbo < 0.25 ? 'bg-[#ff6b6b]' : 'bg-gradient-to-r from-[#ffd45c] to-[#ff6b2e]'}`}
              style={{ transform: `scaleX(${Math.max(0.02, hud.turbo)})` }}
              role="meter"
              aria-label={copy.skatepark.turbo}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(hud.turbo * 100)}
            />
          </div>
        </div>

        <AnimatePresence>
          {hud.comboNames.length > 0 && (
            <motion.div
              className="absolute inset-x-0 top-[3.6rem] flex justify-center px-4"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <p className="bg-ink/70 text-bg max-w-[80%] truncate rounded-full px-4 py-1 text-sm font-bold">
                <span className="text-[#f7c948]">{copy.skatepark.comboHint}</span> {comboText}{' '}
                <span className="font-display text-xl text-[#f7c948]">
                  {hud.comboPoints} × {hud.comboMult}
                </span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {phase === 'ready' && (
        <Backdrop label={copy.skatepark.title}>
          <h2 className="font-display text-4xl leading-none">{copy.skatepark.title}</h2>
          <p className="text-brand-ink font-bold">
            {copy.skatepark.levelLabel(level)} · {copy.skatepark.levelName(level)}
          </p>
          <p className="text-sm font-semibold">{copy.skatepark.goal(def.seconds)}</p>
          <p className="text-muted text-xs">{copy.skatepark.target(def.target)}</p>
          <ul className="text-muted grid gap-x-4 gap-y-1.5 text-left text-sm sm:grid-cols-2">
            {copy.skatepark.guide.map((line) => (
              <li key={line.text} className="flex items-center gap-2">
                <span className="text-xl" aria-hidden>
                  {line.icon}
                </span>
                <span>{line.text}</span>
              </li>
            ))}
          </ul>
          <Button
            onClick={() => {
              void enterLandscape()
              controllerRef.current?.start()
            }}
          >
            {copy.skatepark.play}
          </Button>
          <label className="text-muted flex min-h-10 items-center justify-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-brand size-5"
              checked={sound}
              onChange={(e) => setSoundEnabled(e.target.checked)}
            />
            {copy.profile.sound}
          </label>
          <button type="button" onClick={onExit} className="text-muted min-h-10 text-sm underline">
            {copy.skatepark.exit}
          </button>
        </Backdrop>
      )}
      {phase === 'paused' && (
        <Backdrop label={copy.skatepark.pause}>
          <h2 className="font-display text-4xl leading-none">{copy.skatepark.pause}</h2>
          <Button onClick={() => controllerRef.current?.resume()}>{copy.skatepark.resume}</Button>
          <Button variant="ghost" onClick={onExit}>
            {copy.skatepark.exit}
          </Button>
        </Backdrop>
      )}
      {phase === 'ended' && (
        <motion.div
          className="bg-ink/55 absolute inset-0 z-20 grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.p
            className="font-display text-bg text-center text-6xl leading-none"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={spring.bouncy}
          >
            {copy.skatepark.ended}
          </motion.p>
        </motion.div>
      )}
      {portrait && <RotateOverlay />}
    </div>
  )
}
