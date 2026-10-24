import { useEffect, useRef, useState } from 'react'
import { createSkate } from '@skate/sim.ts'
import type { SkateConfig } from '@skate/config.ts'
import { copy } from '@/copy'
import type { GameOutcome, GameSession } from '../outcome.ts'
import { SkateController, skateHudOf, type SkateHudData, type SkatePhase } from './controller.ts'
import { SkateHud } from './SkateHud.tsx'
import {
  RotateOverlay,
  SkateEndedOverlay,
  SkatePauseOverlay,
  SkateReadyOverlay,
} from './SkateOverlays.tsx'

interface SkateGameProps {
  session: GameSession<SkateConfig>
  onEnd: (outcome: GameOutcome) => void
  onExit: () => void
}

/** En el celular intenta pasar a pantalla completa y bloquear la orientación horizontal (si el navegador lo permite). */
async function enterLandscape() {
  try {
    await document.documentElement.requestFullscreen?.()
    await (
      screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }
    ).lock?.('landscape')
  } catch {
    // No todos los navegadores lo permiten: el aviso de "girá el celular" cubre ese caso.
  }
}

function usePortrait() {
  const [portrait, setPortrait] = useState(
    () => window.matchMedia('(orientation: portrait)').matches,
  )
  useEffect(() => {
    const query = window.matchMedia('(orientation: portrait)')
    const onChange = () => setPortrait(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return portrait
}

/** Pantalla del skate: el canvas lo maneja el controlador; acá solo hay HUD y menús. */
export function SkateGame({ session, onEnd, onExit }: SkateGameProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const controllerRef = useRef<SkateController | null>(null)
  const onEndRef = useRef(onEnd)
  const portrait = usePortrait()
  const [phase, setPhase] = useState<SkatePhase>('ready')
  const [hud, setHud] = useState<SkateHudData>(() =>
    skateHudOf(createSkate(session.config, session.seed)),
  )
  const [won, setWon] = useState(false)

  useEffect(() => {
    onEndRef.current = onEnd
  })

  useEffect(() => {
    const controller = new SkateController(canvasRef.current!, containerRef.current!, session, {
      onPhase: setPhase,
      onHud: setHud,
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

  // Si el celular se pone en vertical a mitad de partida, se pausa sola.
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

  return (
    <div
      ref={containerRef}
      className="bg-ink fixed inset-0 grid touch-none place-items-center overflow-hidden select-none"
    >
      <canvas ref={canvasRef} className="block" role="img" aria-label={copy.skate.title} />
      <SkateHud hud={hud} onPause={() => controllerRef.current?.pause()} />
      {phase === 'ready' && (
        <SkateReadyOverlay
          relaxed={session.relaxed}
          onPlay={() => {
            void enterLandscape()
            controllerRef.current?.start()
          }}
          onExit={onExit}
        />
      )}
      {phase === 'paused' && (
        <SkatePauseOverlay onResume={() => controllerRef.current?.resume()} onExit={onExit} />
      )}
      {phase === 'ended' && <SkateEndedOverlay won={won} />}
      {portrait && <RotateOverlay />}
    </div>
  )
}
