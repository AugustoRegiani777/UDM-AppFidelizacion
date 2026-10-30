import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { copy } from '@/copy'
import { spring } from '@/motion/presets'
import { setSoundEnabled, useSoundEnabled } from '@/motion/preferences'
import { NinjaController, hudOf, type NinjaHud, type NinjaPhase } from './controller.ts'
import { createGame, type NinjaResult } from './engine.ts'
import { LEVEL_COUNT, levelAt } from './levels.ts'

interface NinjaGameProps {
  levelId: number
  /** Se llama una vez al pasar el nivel (para guardar las estrellas). */
  onWin: (result: NinjaResult) => void
  onNext: () => void
  onRetry: () => void
  onExit: () => void
}

function Backdrop({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <motion.div
      className="bg-ink/65 absolute inset-0 z-20 grid place-items-center overflow-y-auto p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <motion.div
        className="bg-surface text-ink rounded-card flex w-full max-w-sm flex-col gap-3 p-6 text-center"
        initial={{ scale: 0.9, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={spring.bouncy}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

function StarsRow({ count }: { count: number }) {
  return (
    <p className="text-5xl" role="img" aria-label={copy.ninja.stars(count)}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= count ? '' : 'opacity-25 grayscale'}>
          ⭐
        </span>
      ))}
    </p>
  )
}

/** Pantalla del juego: el canvas lo maneja el controlador; acá solo hay HUD y menús. */
export function NinjaGame({ levelId, onWin, onNext, onRetry, onExit }: NinjaGameProps) {
  const level = levelAt(levelId)
  const info = copy.ninja.levels[levelId - 1]
  const sound = useSoundEnabled()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controllerRef = useRef<NinjaController | null>(null)
  const onWinRef = useRef(onWin)
  const [seed] = useState(() => Math.floor(Math.random() * 2 ** 31))
  const [started, setStarted] = useState(false)
  const [phase, setPhase] = useState<NinjaPhase>('ready')
  const [hud, setHud] = useState<NinjaHud>(() => hudOf(createGame(level, 1)))
  const [end, setEnd] = useState<NinjaResult | null>(null)

  useEffect(() => {
    onWinRef.current = onWin
  })

  useEffect(() => {
    const controller = new NinjaController(
      canvasRef.current!,
      containerRef.current!,
      level,
      seed,
      {
        onPhase: setPhase,
        onHud: setHud,
        onEnd: (result) => {
          setEnd(result)
          if (result.win) onWinRef.current(result)
        },
      },
      copy.ninja.popups,
    )
    controllerRef.current = controller
    return () => {
      controller.dispose()
      controllerRef.current = null
    }
  }, [level, seed])

  const goalText =
    level.goal.type === 'score'
      ? copy.ninja.goalScore(level.goal.target)
      : copy.ninja.goalCuts(level.goal.target)
  const hasSpecials = level.golden > 0 || level.ice > 0

  return (
    <div ref={containerRef} className="bg-ink fixed inset-0 touch-none overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="block"
        role="img"
        aria-label={`${copy.ninja.title}: ${info?.name ?? ''}`}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-1.5 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="flex items-start justify-between gap-2">
          <div className="flex gap-1.5">
            <button
              type="button"
              aria-label={copy.ninja.exit}
              onClick={onExit}
              className="bg-surface/90 text-ink pointer-events-auto grid size-11 place-items-center rounded-full text-lg shadow"
            >
              ✕
            </button>
            <button
              type="button"
              aria-label={copy.ninja.pause}
              disabled={phase !== 'playing'}
              onClick={() => controllerRef.current?.pause()}
              className="bg-surface/90 text-ink pointer-events-auto grid size-11 place-items-center rounded-full text-lg shadow disabled:opacity-40"
            >
              ⏸
            </button>
          </div>
          <div className="bg-bg/85 min-w-0 flex-1 rounded-2xl px-3 py-1 text-center backdrop-blur-sm">
            <p className="text-muted truncate text-[11px] leading-none font-bold uppercase">
              {copy.ninja.levelOf(levelId, LEVEL_COUNT)} · {info?.name}
            </p>
            <p className="text-ink mt-0.5 text-xs font-semibold">
              {hud.goalReached ? copy.ninja.goalDone : goalText}
            </p>
            <div className="bg-track mt-1 h-1.5 overflow-hidden rounded-full" aria-hidden>
              <div
                className="bg-brand h-full origin-left rounded-full"
                style={{ transform: `scaleX(${hud.progress})` }}
              />
            </div>
          </div>
          <p
            role="status"
            className="font-display bg-ink/70 text-bg rounded-2xl px-3 py-1 text-3xl leading-none"
          >
            {copy.ninja.score(hud.score)}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 px-1">
          <p
            className="bg-ink/55 rounded-full px-2.5 py-1 text-base leading-none"
            aria-label={copy.ninja.lives(hud.lives, hud.maxLives)}
            role="img"
          >
            {Array.from({ length: hud.maxLives }, (_, i) => (i < hud.lives ? '❤️' : '🤍')).join('')}
          </p>
          {hud.combo >= 2 && (
            <p className="bg-brand text-bg rounded-full px-3 py-1 text-sm leading-none font-bold">
              {copy.ninja.combo(hud.combo)}
              {hud.mult > 1 && ` · x${hud.mult}`}
            </p>
          )}
          <p className="bg-ink/55 text-bg rounded-full px-2.5 py-1 text-sm leading-none font-bold">
            ⏱ {copy.ninja.seconds(hud.secondsLeft)}
          </p>
        </div>
        <div className="bg-bg/20 mx-1 h-1 overflow-hidden rounded-full" aria-hidden>
          <div
            className="bg-bg h-full origin-left"
            style={{ transform: `scaleX(${hud.secondsLeft / level.seconds})` }}
          />
        </div>
      </div>

      <AnimatePresence>
        {!started && (
          <Backdrop label={info?.name ?? copy.ninja.title}>
            <p className="text-6xl" aria-hidden>
              {copy.ninja.icons[levelId - 1]}
            </p>
            <p className="text-muted text-sm font-bold uppercase">
              {copy.ninja.levelOf(levelId, LEVEL_COUNT)}
            </p>
            <h2 className="font-display text-5xl leading-none">{info?.name}</h2>
            <p className="text-muted">{info?.tagline}</p>
            <p className="text-sm font-semibold">{goalText}</p>
            <p className="text-muted text-xs">
              {copy.ninja.starsHint(level.stars[0], level.stars[1])}
            </p>
            {(levelId === 1 || hasSpecials) && (
              <ul className="text-muted flex flex-col gap-2 text-left text-sm">
                {levelId === 1 &&
                  copy.ninja.howTo.map((line) => (
                    <li key={line.text} className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden>
                        {line.icon}
                      </span>
                      <span>{line.text}</span>
                    </li>
                  ))}
                {copy.ninja.specials
                  .filter((_, i) => (i === 0 ? level.golden > 0 : level.ice > 0))
                  .filter(() => levelId <= 4)
                  .map((line) => (
                    <li key={line.text} className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden>
                        {line.icon}
                      </span>
                      <span>{line.text}</span>
                    </li>
                  ))}
              </ul>
            )}
            <Button
              onClick={() => {
                controllerRef.current?.start()
                setStarted(true)
              }}
            >
              {copy.ninja.go}
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
            <button
              type="button"
              onClick={onExit}
              className="text-muted min-h-10 text-sm underline"
            >
              {copy.ninja.exit}
            </button>
          </Backdrop>
        )}
        {phase === 'paused' && !end && (
          <Backdrop label={copy.ninja.pause}>
            <h2 className="font-display text-5xl leading-none">{copy.ninja.pause}</h2>
            <Button onClick={() => controllerRef.current?.resume()}>{copy.ninja.resume}</Button>
            <button
              type="button"
              onClick={onExit}
              className="text-muted min-h-10 text-sm underline"
            >
              {copy.ninja.backToLevels}
            </button>
          </Backdrop>
        )}
        {end && (
          <Backdrop label={end.win ? copy.ninja.won : copy.ninja.notYet}>
            <p className="font-display text-5xl leading-none">
              {end.win ? copy.ninja.won : copy.ninja.notYet}
            </p>
            {end.win ? (
              <StarsRow count={end.stars} />
            ) : (
              <p className="text-muted text-sm">{copy.ninja.notYetBody(goalText)}</p>
            )}
            <p className="text-muted text-sm">
              {copy.ninja.result(end.score, end.cuts, end.bestCombo)}
            </p>
            {end.win && end.stars < 3 && (
              <p className="text-muted text-xs">
                {copy.ninja.starsHint(level.stars[0], level.stars[1])}
              </p>
            )}
            {end.win &&
              (levelId < LEVEL_COUNT ? (
                <Button onClick={onNext}>{copy.ninja.next}</Button>
              ) : (
                <p className="font-bold">{copy.ninja.allDone}</p>
              ))}
            <Button variant={end.win ? 'ghost' : 'primary'} onClick={onRetry}>
              {copy.ninja.retry}
            </Button>
            <button
              type="button"
              onClick={onExit}
              className="text-muted min-h-10 text-sm underline"
            >
              {copy.ninja.backToLevels}
            </button>
          </Backdrop>
        )}
      </AnimatePresence>
    </div>
  )
}
