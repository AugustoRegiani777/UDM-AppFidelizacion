import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { copy } from '@/copy'
import { spring } from '@/motion/presets'
import { setSoundEnabled, useSoundEnabled } from '@/motion/preferences'
import {
  RacingController,
  raceHudOf,
  type RaceHud,
  type RacePhase,
  type RaceResult,
} from './controller.ts'
import { createRace } from './sim.ts'

interface RacingGameProps {
  trackIndex: number
  seed: number
  onEnd: (result: RaceResult) => void
  onExit: () => void
}

const formatTime = (seconds: number) => {
  const whole = Math.floor(seconds)
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

function Backdrop({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <motion.div
      className="bg-ink/75 absolute inset-0 z-20 grid place-items-center overflow-y-auto p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <motion.div
        className="bg-surface rounded-card flex w-full max-w-sm flex-col gap-4 p-6 text-center"
        initial={{ scale: 0.9, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={spring.bouncy}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

/** Pantalla de la carrera: el canvas lo maneja el controlador; acá solo hay HUD y menús. */
export function RacingGame({ trackIndex, seed, onEnd, onExit }: RacingGameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controllerRef = useRef<RacingController | null>(null)
  const onEndRef = useRef(onEnd)
  const sound = useSoundEnabled()
  const [phase, setPhase] = useState<RacePhase>('ready')
  const [hud, setHud] = useState<RaceHud>(() => raceHudOf(createRace(trackIndex, seed)))
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    onEndRef.current = onEnd
  })

  useEffect(() => {
    const controller = new RacingController(
      canvasRef.current!,
      containerRef.current!,
      trackIndex,
      seed,
      {
        onPhase: setPhase,
        onHud: setHud,
        onCount: setCount,
        onEnd: (result) => onEndRef.current(result),
      },
    )
    controllerRef.current = controller
    return () => {
      controller.dispose()
      controllerRef.current = null
    }
  }, [trackIndex, seed])

  const name = copy.racing.trackName(trackIndex)

  return (
    <div ref={containerRef} className="bg-ink fixed inset-0 touch-none overflow-hidden select-none">
      <canvas ref={canvasRef} className="block" role="img" aria-label={copy.racing.title} />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="bg-bg/80 rounded-2xl px-3 py-1 backdrop-blur-sm">
            <p className="font-display text-ink text-4xl leading-none" aria-live="polite">
              {copy.racing.place(hud.position)}
              <span className="text-muted text-xl">/{hud.cars}</span>
            </p>
          </div>
          <div className="bg-bg/80 rounded-2xl px-3 py-1 text-center backdrop-blur-sm">
            <p className="font-display text-ink text-2xl leading-none">
              {copy.racing.lap(hud.lap, hud.laps)}
            </p>
            <p className="text-muted text-sm" role="timer">
              {formatTime(hud.seconds)}
            </p>
          </div>
          <button
            type="button"
            aria-label={copy.survivors.pause}
            onClick={() => controllerRef.current?.pause()}
            className="bg-surface/90 pointer-events-auto grid size-11 place-items-center rounded-full text-lg shadow"
          >
            ❚❚
          </button>
        </div>

        <button
          type="button"
          aria-label={copy.racing.drift}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            controllerRef.current?.setBrake(true)
          }}
          onPointerUp={() => controllerRef.current?.setBrake(false)}
          onPointerCancel={() => controllerRef.current?.setBrake(false)}
          className="bg-surface/85 font-display pointer-events-auto absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 min-h-14 -translate-x-1/2 rounded-full px-8 text-2xl shadow-lg active:scale-95"
        >
          {copy.racing.drift}
        </button>

        <AnimatePresence mode="popLayout">
          {count !== null && (
            <motion.p
              key={count}
              className="font-display text-brand absolute inset-x-0 top-1/3 text-center text-8xl drop-shadow-[0_3px_0_rgba(255,246,224,0.95)]"
              initial={{ opacity: 0, scale: 1.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={spring.bouncy}
            >
              {count === 0 ? copy.racing.go : count}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {phase === 'ready' && (
        <Backdrop label={copy.racing.title}>
          <h2 className="font-display text-5xl leading-none">{copy.racing.title}</h2>
          <p className="text-brand-ink text-xl font-bold">{name}</p>
          <ul className="text-muted flex flex-col gap-2 text-left">
            {copy.racing.howTo.map((line) => (
              <li key={line.text} className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden>
                  {line.icon}
                </span>
                <span>{line.text}</span>
              </li>
            ))}
          </ul>
          <Button onClick={() => controllerRef.current?.start()}>{copy.racing.play}</Button>
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
            {copy.survivors.exit}
          </button>
        </Backdrop>
      )}
      {phase === 'paused' && (
        <Backdrop label={copy.survivors.paused}>
          <h2 className="font-display text-5xl leading-none">{copy.survivors.paused}</h2>
          <Button onClick={() => controllerRef.current?.resume()}>{copy.survivors.resume}</Button>
          <Button variant="ghost" onClick={onExit}>
            {copy.survivors.exit}
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
            {copy.racing.finishBanner(hud.position)}
          </motion.p>
        </motion.div>
      )}
    </div>
  )
}
