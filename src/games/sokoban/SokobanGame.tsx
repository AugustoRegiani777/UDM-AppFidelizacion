import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { copy } from '@/copy'
import { spring } from '@/motion/presets'
import { setSoundEnabled, useSoundEnabled } from '@/motion/preferences'
import type { Dir } from './engine.ts'
import { SokobanController, type SokobanHud, type SokobanWin } from './controller.ts'
import { levelAt, LEVEL_COUNT } from './levels.ts'
import { VEHICLE_ICON } from './themes.ts'

interface SokobanGameProps {
  levelId: number
  /** Se llama una vez al ganar (para guardar las estrellas). */
  onWin: (win: SokobanWin) => void
  onNext: () => void
  onRetry: () => void
  onExit: () => void
}

const PAD: { dir: Dir; label: string; arrow: string; className: string }[] = [
  { dir: 'U', label: 'Arriba', arrow: '▲', className: 'col-start-2 row-start-1' },
  { dir: 'L', label: 'Izquierda', arrow: '◀', className: 'col-start-1 row-start-2' },
  { dir: 'R', label: 'Derecha', arrow: '▶', className: 'col-start-3 row-start-2' },
  { dir: 'D', label: 'Abajo', arrow: '▼', className: 'col-start-2 row-start-3' },
]

function Backdrop({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <motion.div
      className="bg-ink/65 absolute inset-0 z-20 grid place-items-center overflow-y-auto p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
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

/** Pantalla del juego: el canvas lo maneja el controlador; acá solo hay HUD, cruceta y menús. */
export function SokobanGame({ levelId, onWin, onNext, onRetry, onExit }: SokobanGameProps) {
  const level = levelAt(levelId)
  const info = copy.sokoban.levels[levelId - 1]
  const sound = useSoundEnabled()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controllerRef = useRef<SokobanController | null>(null)
  const onWinRef = useRef(onWin)
  const [started, setStarted] = useState(false)
  const [hud, setHud] = useState<SokobanHud>({
    moves: 0,
    pushes: 0,
    onGoal: 0,
    total: level.layout.startBoxes.length,
    canUndo: false,
  })
  const [win, setWin] = useState<SokobanWin | null>(null)

  useEffect(() => {
    onWinRef.current = onWin
  })

  useEffect(() => {
    const controller = new SokobanController(canvasRef.current!, containerRef.current!, level, {
      onHud: setHud,
      onWin: (result) => {
        setWin(result)
        onWinRef.current(result)
      },
    })
    controllerRef.current = controller
    return () => {
      controller.dispose()
      controllerRef.current = null
    }
  }, [level])

  const vehicle = copy.sokoban.vehicles[level.theme.vehicle]

  return (
    <div ref={containerRef} className="bg-ink fixed inset-0 touch-none overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        className="block"
        role="img"
        aria-label={`${copy.sokoban.title}: ${info?.name ?? ''}`}
      />

      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
          <button
            type="button"
            aria-label={copy.sokoban.exit}
            onClick={onExit}
            className="bg-surface/90 text-ink pointer-events-auto grid size-11 place-items-center rounded-full text-lg shadow"
          >
            ✕
          </button>
          <div className="bg-bg/85 rounded-2xl px-3 py-1 text-center backdrop-blur-sm">
            <p className="text-muted text-[11px] leading-none font-bold uppercase">
              {copy.sokoban.levelOf(levelId, LEVEL_COUNT)} · {VEHICLE_ICON[level.theme.vehicle]}
            </p>
            <p className="font-display text-ink text-2xl leading-none">{info?.name}</p>
            <p className="text-ink mt-0.5 text-xs font-semibold" role="status">
              {copy.sokoban.stats(hud.moves, hud.pushes)} · 📦 {hud.onGoal}/{hud.total}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              aria-label={copy.sokoban.undo}
              disabled={!hud.canUndo}
              onClick={() => controllerRef.current?.undo()}
              className="bg-surface/90 text-ink pointer-events-auto grid size-11 place-items-center rounded-full text-xl shadow disabled:opacity-40"
            >
              ↶
            </button>
            <button
              type="button"
              aria-label={copy.sokoban.restart}
              onClick={() => controllerRef.current?.restart()}
              className="bg-surface/90 text-ink pointer-events-auto grid size-11 place-items-center rounded-full text-xl shadow"
            >
              ⟲
            </button>
          </div>
        </div>

        {/* Cruceta: se puede mantener apretada para avanzar; también se puede deslizar el dedo por el mapa. */}
        <div
          className="pointer-events-auto absolute right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] grid grid-cols-3 grid-rows-3 gap-1"
          role="group"
          aria-label={copy.sokoban.pad}
        >
          {PAD.map(({ dir, label, arrow, className }) => (
            <button
              key={dir}
              type="button"
              aria-label={label}
              className={`bg-surface/90 text-ink grid size-14 place-items-center rounded-2xl text-xl shadow-md active:scale-95 active:bg-white ${className}`}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                controllerRef.current?.hold(dir)
              }}
              onPointerUp={() => controllerRef.current?.release()}
              onPointerCancel={() => controllerRef.current?.release()}
              onContextMenu={(e) => e.preventDefault()}
            >
              {arrow}
            </button>
          ))}
        </div>
        <p className="bg-ink/60 text-bg absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 max-w-[40%] rounded-xl px-2.5 py-1.5 text-xs font-semibold">
          {copy.sokoban.swipeHint}
        </p>
      </div>

      <AnimatePresence>
        {!started && (
          <Backdrop label={info?.name ?? copy.sokoban.title}>
            <p className="text-6xl" aria-hidden>
              {VEHICLE_ICON[level.theme.vehicle]}
            </p>
            <p className="text-muted text-sm font-bold uppercase">
              {copy.sokoban.levelOf(levelId, LEVEL_COUNT)}
            </p>
            <h2 className="font-display text-5xl leading-none">{info?.name}</h2>
            <p className="text-muted">{info?.tagline}</p>
            <p className="text-sm font-semibold">{copy.sokoban.yourVehicle(vehicle)}</p>
            {levelId === 1 && (
              <ul className="text-muted flex flex-col gap-2 text-left text-sm">
                {copy.sokoban.howTo.map((line) => (
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
              {copy.sokoban.go}
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
              {copy.sokoban.exit}
            </button>
          </Backdrop>
        )}
        {win && (
          <Backdrop label={copy.sokoban.won}>
            <p className="font-display text-5xl leading-none">{copy.sokoban.won}</p>
            <p className="text-5xl" role="img" aria-label={copy.sokoban.stars(win.stars)}>
              {[1, 2, 3].map((n) => (
                <span key={n} className={n <= win.stars ? '' : 'opacity-25 grayscale'}>
                  ⭐
                </span>
              ))}
            </p>
            <p className="text-muted text-sm">
              {copy.sokoban.result(win.moves, win.pushes, level.par)}
            </p>
            {levelId < LEVEL_COUNT ? (
              <Button onClick={onNext}>{copy.sokoban.next}</Button>
            ) : (
              <p className="font-bold">{copy.sokoban.allDone}</p>
            )}
            <Button variant="ghost" onClick={onRetry}>
              {copy.sokoban.retry}
            </Button>
            <button
              type="button"
              onClick={onExit}
              className="text-muted min-h-10 text-sm underline"
            >
              {copy.sokoban.backToLevels}
            </button>
          </Backdrop>
        )}
      </AnimatePresence>
    </div>
  )
}
