import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { resolveSkateConfig, type SkateConfig } from '@skate/config.ts'
import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'
import { finishRun, startRun, type FinishRunResult } from '@/features/economy/economyApi'
import type { GameOutcome, GameSession } from '@/games/outcome'
import { SkateGame } from '@/games/skate/SkateGame'
import { copy } from '@/copy'
import { ModeSwitch, OfficialSummary, type PlayMode } from './official'
import { runErrorText } from './officialText'

type View =
  | { name: 'menu' }
  | { name: 'starting' }
  | { name: 'playing'; session: GameSession<SkateConfig>; runId: string | null }
  | { name: 'verifying' }
  | { name: 'error'; message: string }
  | { name: 'result'; outcome: GameOutcome; official: FinishRunResult | null }

function practiceSession(): GameSession<SkateConfig> {
  // Es práctica: la semilla no decide ningún premio.
  const seed = (crypto.getRandomValues(new Uint32Array(1))[0] ?? 1) >>> 0
  return { seed, config: resolveSkateConfig(), relaxed: false }
}

/** Skate de Miga en la sala de juegos: práctica libre y partida oficial (ranking, monedas y pases). */
export function SkateArcade({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient()
  const [view, setView] = useState<View>({ name: 'menu' })
  const [mode, setMode] = useState<PlayMode>('practice')

  const play = () => {
    if (mode === 'practice') {
      setView({ name: 'playing', session: practiceSession(), runId: null })
      return
    }
    setView({ name: 'starting' })
    startRun('skate', 1)
      .then((run) =>
        setView({
          name: 'playing',
          runId: run.run_id,
          session: { seed: run.seed, config: run.config as SkateConfig, relaxed: false },
        }),
      )
      .catch((error: unknown) => setView({ name: 'error', message: runErrorText(error) }))
  }

  const ended = (runId: string | null, outcome: GameOutcome) => {
    if (!runId) {
      setView({ name: 'result', outcome, official: null })
      return
    }
    setView({ name: 'verifying' })
    finishRun(runId, outcome.log)
      .then((official) => {
        void queryClient.invalidateQueries({ queryKey: ['wallet'] })
        void queryClient.invalidateQueries({ queryKey: ['board'] })
        setView({ name: 'result', outcome: { ...outcome, won: official.won }, official })
      })
      .catch((error: unknown) => setView({ name: 'error', message: runErrorText(error) }))
  }

  if (view.name === 'starting' || view.name === 'verifying') {
    return (
      <Screen className="items-center justify-center gap-4 text-center">
        <p className="text-muted text-lg" role="status">
          {view.name === 'starting' ? copy.economy.starting : copy.economy.verifying}
        </p>
      </Screen>
    )
  }

  if (view.name === 'playing') {
    return (
      <SkateGame
        session={view.session}
        onEnd={(outcome: GameOutcome) => ended(view.runId, outcome)}
        onExit={() => setView({ name: 'menu' })}
      />
    )
  }

  if (view.name === 'error') {
    return (
      <Screen className="items-center justify-center gap-4 text-center">
        <h1 className="font-display text-5xl leading-none">{copy.economy.errorTitle}</h1>
        <p className="text-muted text-lg">{view.message}</p>
        <Button onClick={play}>{copy.arcade.again}</Button>
        <Button variant="ghost" onClick={onBack}>
          {copy.arcade.backToGames}
        </Button>
      </Screen>
    )
  }

  if (view.name === 'result') {
    return (
      <Screen className="items-center justify-center gap-4 text-center">
        <h1 className="font-display text-5xl leading-none">
          {view.outcome.won ? copy.arcade.skateWon : copy.arcade.lostTitle}
        </h1>
        {!view.outcome.won && <p className="text-muted">{view.outcome.lostText}</p>}
        {view.official && <OfficialSummary result={view.official} />}
        <Button onClick={play}>{copy.arcade.again}</Button>
        <Button variant="ghost" onClick={() => setView({ name: 'menu' })}>
          {copy.arcade.backToGames}
        </Button>
      </Screen>
    )
  }

  return (
    <Screen className="gap-4">
      <button type="button" onClick={onBack} className="min-h-12 self-start underline">
        {copy.arcade.backToGames}
      </button>
      <h2 className="font-display text-3xl">{copy.arcade.games.skate.name}</h2>
      <p className="text-muted">{copy.arcade.games.skate.body}</p>
      <ModeSwitch mode={mode} onChange={setMode} />
      <Button onClick={play}>{copy.arcade.play}</Button>
    </Screen>
  )
}
