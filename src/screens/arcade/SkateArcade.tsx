import { useState } from 'react'
import { resolveSkateConfig, type SkateConfig } from '@skate/config.ts'
import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'
import type { GameOutcome, GameSession } from '@/games/outcome'
import { SkateGame } from '@/games/skate/SkateGame'
import { copy } from '@/copy'

type View =
  { name: 'playing'; session: GameSession<SkateConfig> } | { name: 'result'; won: boolean }

function practiceSession(): GameSession<SkateConfig> {
  // Es práctica: la semilla no decide ningún premio.
  const seed = (crypto.getRandomValues(new Uint32Array(1))[0] ?? 1) >>> 0
  return { seed, config: resolveSkateConfig(), relaxed: false }
}

/** Skate de Miga en la sala de juegos: partidas sin límite y sin premio. */
export function SkateArcade({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<View>(() => ({ name: 'playing', session: practiceSession() }))

  if (view.name === 'playing') {
    return (
      <SkateGame
        session={view.session}
        onEnd={(outcome: GameOutcome) => setView({ name: 'result', won: outcome.won })}
        onExit={onBack}
      />
    )
  }
  return (
    <Screen className="items-center justify-center gap-4 text-center">
      <h1 className="font-display text-5xl leading-none">
        {view.won ? copy.arcade.skateWon : copy.arcade.lostTitle}
      </h1>
      <Button onClick={() => setView({ name: 'playing', session: practiceSession() })}>
        {copy.arcade.again}
      </Button>
      <Button variant="ghost" onClick={onBack}>
        {copy.arcade.backToGames}
      </Button>
    </Screen>
  )
}
