import { useState } from 'react'
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
import type { GameOutcome, GameSession } from '@/games/outcome'
import { SurvivorsGame } from '@/games/survivors/SurvivorsGame'
import { Cascade, CascadeItem } from '@/motion/Cascade'
import { copy } from '@/copy'

type View =
  | { name: 'menu' }
  | { name: 'playing'; stage: number; session: GameSession<GameConfig> }
  | { name: 'result'; stage: number; outcome: GameOutcome; record: boolean }

function practiceSession(stage: number): GameSession<GameConfig> {
  // La semilla no decide ningún premio (es práctica): alcanza con una al azar del navegador.
  const seed = (crypto.getRandomValues(new Uint32Array(1))[0] ?? 1) >>> 0
  return { seed, config: resolveConfig({ stage }), relaxed: false }
}

/** Sobreviví a las migas en la sala de juegos: niveles que se abren al ganar. */
export function SurvivorsArcade({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<View>({ name: 'menu' })
  const [unlocked, setUnlocked] = useState(unlockedStage)
  const best = survivorsBest()

  const play = (stage: number) =>
    setView({ name: 'playing', stage, session: practiceSession(stage) })

  if (view.name === 'playing') {
    const { stage } = view
    return (
      <SurvivorsGame
        session={view.session}
        stageLabel={`${copy.arcade.stageLabel(stage)} · ${copy.arcade.stageName(stage)}`}
        onEnd={(outcome: GameOutcome) => {
          let record = false
          if (outcome.won) {
            setUnlocked(unlockAfterWin(stage))
            record = saveSurvivorsBest(stage, outcome.score ?? 0)
          }
          setView({ name: 'result', stage, outcome, record })
        }}
        onExit={() => setView({ name: 'menu' })}
      />
    )
  }

  if (view.name === 'result') {
    const { stage, outcome, record } = view
    const won = outcome.won
    const last = stage >= STAGE_COUNT
    return (
      <Screen className="items-center justify-center gap-4 text-center">
        <h1 className="font-display text-5xl leading-none">
          {won ? copy.arcade.wonTitle(copy.arcade.stageName(stage)) : copy.arcade.lostTitle}
        </h1>
        <p className="text-muted">{won ? outcome.statsText : outcome.lostText}</p>
        {won && record && <p className="text-brand-ink font-bold">{copy.arcade.newBest}</p>}
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
      <p className="text-muted text-sm">{copy.arcade.practiceNotice}</p>
    </Screen>
  )
}
