import { useEffect, useRef, useState } from 'react'
import type { UpgradeId } from '@engine/config.ts'
import { createGame } from '@engine/sim.ts'
import { copy } from '@/copy'
import {
  GameController,
  hudOf,
  type GameOutcome,
  type GameSession,
  type Phase,
} from './controller.ts'
import { EndedOverlay, PauseOverlay, ReadyOverlay } from './GameOverlays.tsx'
import { HudOverlay, type HudData } from './HudOverlay.tsx'
import { LevelUpOverlay } from './LevelUpOverlay.tsx'

export type { GameOutcome, GameSession } from './controller.ts'

interface SurvivorsGameProps {
  session: GameSession
  onEnd: (outcome: GameOutcome) => void
  onExit: () => void
}

interface LevelUpState {
  choices: UpgradeId[]
  levels: Record<UpgradeId, number>
}

/** Pantalla del juego: el canvas lo maneja el controlador; acá solo hay HUD y menús. */
export function SurvivorsGame({ session, onEnd, onExit }: SurvivorsGameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controllerRef = useRef<GameController | null>(null)
  const onEndRef = useRef(onEnd)
  const [phase, setPhase] = useState<Phase>('ready')
  const [hud, setHud] = useState<HudData>(() => hudOf(createGame(session.config, session.seed)))
  const [levelUp, setLevelUp] = useState<LevelUpState | null>(null)
  const [banner, setBanner] = useState<'boss' | 'wave' | null>(null)
  const [won, setWon] = useState(false)

  useEffect(() => {
    onEndRef.current = onEnd
  })

  useEffect(() => {
    const controller = new GameController(canvasRef.current!, containerRef.current!, session, {
      onPhase: setPhase,
      onHud: setHud,
      onLevelUp: (choices, levels) => setLevelUp({ choices, levels }),
      onBanner: setBanner,
      onEnd: (outcome) => {
        setWon(outcome.won)
        onEndRef.current(outcome)
      },
    })
    controllerRef.current = controller
    return () => {
      controller.dispose()
      controllerRef.current = null
    }
  }, [session])

  return (
    <div
      ref={containerRef}
      className="bg-ink fixed inset-0 grid touch-none place-items-center overflow-hidden select-none"
    >
      <canvas ref={canvasRef} className="block" role="img" aria-label={copy.survivors.title} />
      <HudOverlay hud={hud} banner={banner} onPause={() => controllerRef.current?.pause()} />
      {phase === 'ready' && (
        <ReadyOverlay
          durationSeconds={session.config.durationSeconds}
          relaxed={session.relaxed}
          onPlay={() => controllerRef.current?.start()}
          onExit={onExit}
        />
      )}
      {phase === 'paused' && (
        <PauseOverlay onResume={() => controllerRef.current?.resume()} onExit={onExit} />
      )}
      {phase === 'levelup' && levelUp && (
        <LevelUpOverlay
          level={hud.level}
          choices={levelUp.choices}
          upgradeLevels={levelUp.levels}
          onPick={(index) => controllerRef.current?.choose(index)}
        />
      )}
      {phase === 'ended' && <EndedOverlay won={won} />}
    </div>
  )
}
