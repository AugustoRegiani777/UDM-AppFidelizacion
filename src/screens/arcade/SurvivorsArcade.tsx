import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { resolveConfig, STAGE_COUNT, type GameConfig } from '@engine/config.ts'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Screen } from '@/components/Screen'
import {
  saveSurvivorsBest,
  survivorsBest,
  unlockAfterWin,
  unlockedStage,
} from '@/features/arcade/progress'
import { finishRun, startRun, type FinishRunResult } from '@/features/economy/economyApi'
import type { GameOutcome, GameSession } from '@/games/outcome'
import { SurvivorsGame } from '@/games/survivors/SurvivorsGame'
import { Cascade, CascadeItem } from '@/motion/Cascade'
import { copy } from '@/copy'
import { ModeSwitch, OfficialSummary, type PlayMode } from './official'
import { runErrorText } from './officialText'

type View =
  | { name: 'menu' }
  | { name: 'starting'; stage: number }
  | { name: 'playing'; stage: number; session: GameSession<GameConfig>; runId: string | null }
  | { name: 'verifying'; stage: number }
  | { name: 'error'; stage: number; message: string }
  | {
      name: 'result'
      stage: number
      outcome: GameOutcome
      record: boolean
      official: FinishRunResult | null
    }

function practiceSession(stage: number): GameSession<GameConfig> {
  // La semilla no decide ningún premio (es práctica): alcanza con una al azar del navegador.
  const seed = (crypto.getRandomValues(new Uint32Array(1))[0] ?? 1) >>> 0
  return { seed, config: resolveConfig({ stage }), relaxed: false }
}

/** Sobreviví a las migas en la sala de juegos: práctica libre y partida oficial (ranking, monedas y pases). */
export function SurvivorsArcade({ onBack }: { onBack: () => void }) {
  const queryClient = useQueryClient()
  const [view, setView] = useState<View>({ name: 'menu' })
  const [mode, setMode] = useState<PlayMode>('practice')
  const [unlocked, setUnlocked] = useState(unlockedStage)
  const best = survivorsBest()

  const play = (stage: number) => {
    if (mode === 'practice') {
      setView({ name: 'playing', stage, session: practiceSession(stage), runId: null })
      return
    }
    setView({ name: 'starting', stage })
    startRun('survivors', stage)
      .then((run) => {
        setView({
          name: 'playing',
          stage,
          runId: run.run_id,
          session: { seed: run.seed, config: run.config as GameConfig, relaxed: false },
        })
      })
      .catch((error: unknown) => setView({ name: 'error', stage, message: runErrorText(error) }))
  }

  const ended = (stage: number, runId: string | null, outcome: GameOutcome) => {
    const finish = (official: FinishRunResult | null) => {
      const won = official ? official.won : outcome.won
      let record = false
      if (won) {
        setUnlocked(unlockAfterWin(stage))
        record = saveSurvivorsBest(stage, official?.score ?? outcome.score ?? 0)
      }
      setView({ name: 'result', stage, outcome: { ...outcome, won }, record, official })
    }
    if (!runId) {
      finish(null)
      return
    }
    setView({ name: 'verifying', stage })
    finishRun(runId, outcome.log)
      .then((official) => {
        void queryClient.invalidateQueries({ queryKey: ['wallet'] })
        void queryClient.invalidateQueries({ queryKey: ['board'] })
        finish(official)
      })
      .catch((error: unknown) => setView({ name: 'error', stage, message: runErrorText(error) }))
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

  if (view.name === 'error') {
    return (
      <Screen className="items-center justify-center gap-4 text-center">
        <h1 className="font-display text-5xl leading-none">{copy.economy.errorTitle}</h1>
        <p className="text-muted text-lg">{view.message}</p>
        <Button onClick={() => play(view.stage)}>{copy.arcade.again}</Button>
        <Button variant="ghost" onClick={() => setView({ name: 'menu' })}>
          {copy.arcade.backToLevels}
        </Button>
      </Screen>
    )
  }

  if (view.name === 'playing') {
    const { stage, runId } = view
    return (
      <SurvivorsGame
        session={view.session}
        stageLabel={`${copy.arcade.stageLabel(stage)} · ${copy.arcade.stageName(stage)}`}
        onEnd={(outcome: GameOutcome) => ended(stage, runId, outcome)}
        onExit={() => setView({ name: 'menu' })}
      />
    )
  }

  if (view.name === 'result') {
    const { stage, outcome, record, official } = view
    const won = outcome.won
    const last = stage >= STAGE_COUNT
    return (
      <Screen className="items-center justify-center gap-4 text-center">
        <h1 className="font-display text-5xl leading-none">
          {won ? copy.arcade.wonTitle(copy.arcade.stageName(stage)) : copy.arcade.lostTitle}
        </h1>
        <p className="text-muted">{won ? outcome.statsText : outcome.lostText}</p>
        {official ? (
          <OfficialSummary result={official} />
        ) : (
          won && record && <p className="text-brand-ink font-bold">{copy.arcade.newBest}</p>
        )}
        {won && last && <p className="text-muted">{copy.arcade.allDone}</p>}
        {won && !last ? (
          <Button onClick={() => play(stage + 1)}>{copy.arcade.nextStage}</Button>
        ) : (
          <Button onClick={() => play(stage)}>{copy.arcade.again}</Button>
        )}
        <Button variant="ghost" onClick={() => setView({ name: 'menu' })}>
          {copy.arcade.backToLevels}
        </Button>
      </Screen>
    )
  }

  return (
    <Screen className="gap-4">
      <button type="button" onClick={onBack} className="min-h-12 self-start underline">
        {copy.arcade.backToGames}
      </button>
      <h2 className="font-display text-3xl">{copy.arcade.survivorsTitle}</h2>
      <p className="text-muted">{copy.arcade.survivorsBody}</p>
      <ModeSwitch mode={mode} onChange={setMode} />
      <Cascade className="flex flex-col gap-3">
        {Array.from({ length: STAGE_COUNT }, (_, i) => i + 1).map((stage) => {
          const open = stage <= unlocked
          return (
            <CascadeItem key={stage}>
              <button
                type="button"
                disabled={!open}
                onClick={() => play(stage)}
                className="w-full text-left disabled:opacity-60"
              >
                <Card className="flex items-center justify-between gap-3">
                  <span>
                    <span className="text-muted block text-sm">
                      {copy.arcade.stageLabel(stage)}
                    </span>
                    <span className="block font-bold">{copy.arcade.stageName(stage)}</span>
                    {open && (best[stage - 1] ?? 0) > 0 && (
                      <span className="text-muted text-sm">
                        {copy.arcade.bestScore(best[stage - 1]!)}
                      </span>
                    )}
                    {!open && <span className="text-muted text-sm">{copy.arcade.locked}</span>}
                  </span>
                  <span className={open ? 'text-brand-ink font-semibold' : 'text-2xl'}>
                    {open ? copy.arcade.play : '🔒'}
                  </span>
                </Card>
              </button>
            </CascadeItem>
          )
        })}
      </Cascade>
    </Screen>
  )
}
