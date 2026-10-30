import { useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Screen } from '@/components/Screen'
import { migaSkateStars, saveMigaSkateStars, unlockedMigaSkate } from '@/features/arcade/progress'
import type { SkateResult } from '@/games/migaskate/controller'
import { MigaSkateGame } from '@/games/migaskate/MigaSkateGame'
import { SPOT_COUNT, SPOTS } from '@/games/migaskate/spots'
import { Cascade, CascadeItem } from '@/motion/Cascade'
import { copy } from '@/copy'

type View =
  | { name: 'menu' }
  | { name: 'playing'; spot: number; run: number }
  | { name: 'result'; spot: number; result: SkateResult }

function Stars({ count }: { count: number }) {
  return (
    <span aria-label={copy.migaskate.stars(count)} role="img" className="whitespace-nowrap">
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= count ? '' : 'opacity-25 grayscale'}>
          ⭐
        </span>
      ))}
    </span>
  )
}

/** Miga Skate en la sala de juegos: practica sin premio, cinco spots con tres estrellas cada uno. */
export function MigaSkateArcade({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<View>({ name: 'menu' })
  const [stars, setStars] = useState(migaSkateStars)
  const unlocked = unlockedMigaSkate(stars)

  const play = (spot: number) =>
    setView((current) => ({
      name: 'playing',
      spot,
      run: current.name === 'playing' ? current.run + 1 : 0,
    }))

  if (view.name === 'playing') {
    const { spot } = view
    return (
      <MigaSkateGame
        key={`${spot}-${view.run}`}
        spot={spot - 1}
        onEnd={(result) => {
          setStars(saveMigaSkateStars(spot, result.stars))
          setView({ name: 'result', spot, result })
        }}
        onExit={() => setView({ name: 'menu' })}
      />
    )
  }

  if (view.name === 'result') {
    const { spot, result } = view
    const canAdvance = result.stars >= 1 && spot < SPOT_COUNT
    return (
      <Screen className="items-center justify-center gap-4 text-center">
        <h1 className="font-display text-5xl leading-none">
          {copy.migaskate.resultTitle(result.stars)}
        </h1>
        <p className="text-brand-ink font-bold">{copy.migaskate.spotName(SPOTS[spot - 1]!.id)}</p>
        <p className="text-5xl">
          <Stars count={result.stars} />
        </p>
        <p className="font-display text-6xl leading-none">{result.score}</p>
        <p className="text-muted text-sm">
          {copy.migaskate.resultStats(result.landed, result.bails, result.bestCombo)}
        </p>
        {canAdvance ? (
          <Button onClick={() => play(spot + 1)}>{copy.migaskate.next}</Button>
        ) : (
          <Button onClick={() => play(spot)}>{copy.migaskate.again}</Button>
        )}
        {canAdvance && (
          <Button variant="ghost" onClick={() => play(spot)}>
            {copy.migaskate.again}
          </Button>
        )}
        <Button variant="ghost" onClick={() => setView({ name: 'menu' })}>
          {copy.migaskate.backToSpots}
        </Button>
      </Screen>
    )
  }

  return (
    <Screen className="gap-4">
      <button type="button" onClick={onBack} className="min-h-12 self-start underline">
        {copy.arcade.backToGames}
      </button>
      <h1 className="font-display text-5xl leading-none">{copy.migaskate.title}</h1>
      <p className="text-muted">{copy.migaskate.subtitle}</p>
      <Cascade className="flex flex-col gap-3">
        {SPOTS.map((spot, i) => {
          const number = i + 1
          const open = number <= unlocked
          return (
            <CascadeItem key={spot.id}>
              <button
                type="button"
                disabled={!open}
                onClick={() => play(number)}
                className="w-full text-left disabled:opacity-60"
              >
                <Card className="flex items-center justify-between gap-3">
                  <span>
                    <span className="text-muted block text-sm">
                      {copy.migaskate.spotLabel(number)}
                    </span>
                    <span className="block font-bold">{copy.migaskate.spotName(spot.id)}</span>
                    <span className="text-muted block text-xs">
                      {open ? copy.migaskate.spotBlurb(spot.id) : copy.migaskate.locked}
                    </span>
                  </span>
                  {open ? <Stars count={stars[i] ?? 0} /> : <span className="text-2xl">🔒</span>}
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
