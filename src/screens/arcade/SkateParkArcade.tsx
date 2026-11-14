import { useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Screen } from '@/components/Screen'
import { parkStars, saveParkStars, unlockedPark } from '@/features/arcade/progress'
import type { ParkResult } from '@/games/skatepark/controller'
import { SkateParkGame } from '@/games/skatepark/SkateParkGame'
import { LEVEL_COUNT, LEVELS } from '@/games/skatepark/sim'
import { Cascade, CascadeItem } from '@/motion/Cascade'
import { copy } from '@/copy'

type View =
  | { name: 'menu' }
  | { name: 'playing'; level: number; seed: number }
  | { name: 'result'; level: number; result: ParkResult }

const newSeed = () => (crypto.getRandomValues(new Uint32Array(1))[0] ?? 1) >>> 0

function Stars({ count }: { count: number }) {
  return (
    <span aria-label={copy.skatepark.stars(count)} role="img" className="whitespace-nowrap">
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= count ? '' : 'opacity-25 grayscale'}>
          ⭐
        </span>
      ))}
    </span>
  )
}

/** Skate Spot en la sala de juegos: cinco niveles de parque, sin premio. Una estrella abre el siguiente. */
export function SkateParkArcade({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<View>({ name: 'menu' })
  const [stars, setStars] = useState(parkStars)
  const unlocked = unlockedPark(stars)

  const play = (level: number) => setView({ name: 'playing', level, seed: newSeed() })

  if (view.name === 'playing') {
    const { level } = view
    return (
      <SkateParkGame
        level={level}
        seed={view.seed}
        onEnd={(result) => {
          setStars(saveParkStars(level, result.stars))
          setView({ name: 'result', level, result })
        }}
        onExit={() => setView({ name: 'menu' })}
      />
    )
  }

  if (view.name === 'result') {
    const { level, result } = view
    const canAdvance = result.stars >= 1 && level < LEVEL_COUNT
    return (
      <Screen className="items-center justify-center gap-4 text-center">
        <h1 className="font-display text-5xl leading-none">
          {copy.skatepark.resultTitle(result.stars)}
        </h1>
        <p className="text-5xl">
          <Stars count={result.stars} />
        </p>
        <p className="font-display text-6xl leading-none">{result.score}</p>
        <p className="text-muted text-sm">
          {copy.skatepark.resultStats(result.landed, result.bails, result.bestCombo)}
        </p>
        {canAdvance ? (
          <Button onClick={() => play(level + 1)}>{copy.skatepark.next}</Button>
        ) : (
          <Button onClick={() => play(level)}>{copy.skatepark.again}</Button>
        )}
        {canAdvance && (
          <Button variant="ghost" onClick={() => play(level)}>
            {copy.skatepark.again}
          </Button>
        )}
        <Button variant="ghost" onClick={() => setView({ name: 'menu' })}>
          {copy.skatepark.backToLevels}
        </Button>
      </Screen>
    )
  }

  return (
    <Screen className="gap-4">
      <button type="button" onClick={onBack} className="min-h-12 self-start underline">
        {copy.arcade.backToGames}
      </button>
      <h1 className="font-display text-5xl leading-none">{copy.skatepark.title}</h1>
      <p className="text-muted">{copy.skatepark.subtitle}</p>
      <Cascade className="flex flex-col gap-3">
        {Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1).map((level) => {
          const open = level <= unlocked
          return (
            <CascadeItem key={level}>
              <button
                type="button"
                disabled={!open}
                onClick={() => play(level)}
                className="w-full text-left disabled:opacity-60"
              >
                <Card className="flex items-center justify-between gap-3">
                  <span>
                    <span className="text-muted block text-sm">
                      {copy.skatepark.levelLabel(level)}
                    </span>
                    <span className="block font-bold">{copy.skatepark.levelName(level)}</span>
                    <span className="text-muted block text-xs">
                      {open
                        ? copy.skatepark.target(LEVELS[level - 1]!.target)
                        : copy.skatepark.locked}
                    </span>
                  </span>
                  {open ? (
                    <Stars count={stars[level - 1] ?? 0} />
                  ) : (
                    <span className="text-2xl">🔒</span>
                  )}
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
