import { useState } from 'react'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Screen } from '@/components/Screen'
import { unlockRacing, unlockedTrack } from '@/features/arcade/progress'
import { RacingGame } from '@/games/racing/RacingGame'
import type { RaceResult } from '@/games/racing/controller'
import { TRACK_COUNT } from '@/games/racing/tracks'
import { Cascade, CascadeItem } from '@/motion/Cascade'
import { copy } from '@/copy'

type View =
  | { name: 'menu' }
  | { name: 'playing'; track: number; seed: number }
  | { name: 'result'; track: number; result: RaceResult }

const newSeed = () => (crypto.getRandomValues(new Uint32Array(1))[0] ?? 1) >>> 0

/** Miga Racers en la sala de juegos: carreras sin límite, sin premio. Un podio (1º o 2º) abre la pista siguiente. */
export function RacingArcade({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<View>({ name: 'menu' })
  const [unlocked, setUnlocked] = useState(unlockedTrack)

  const race = (track: number) => setView({ name: 'playing', track, seed: newSeed() })

  if (view.name === 'playing') {
    const { track } = view
    return (
      <RacingGame
        trackIndex={track}
        seed={view.seed}
        onEnd={(result) => {
          if (result.position <= 2) setUnlocked(unlockRacing(track))
          setView({ name: 'result', track, result })
        }}
        onExit={() => setView({ name: 'menu' })}
      />
    )
  }

  if (view.name === 'result') {
    const { track, result } = view
    const podium = result.position <= 2
    const hasNext = track < TRACK_COUNT
    return (
      <Screen className="items-center justify-center gap-4 text-center">
        <h1 className="font-display text-5xl leading-none">
          {copy.racing.finishBanner(result.position)}
        </h1>
        <p className="text-muted">{copy.racing.resultBody(result.position, result.seconds)}</p>
        {podium && hasNext ? (
          <Button onClick={() => race(track + 1)}>{copy.racing.nextTrack}</Button>
        ) : (
          <Button onClick={() => race(track)}>{copy.arcade.again}</Button>
        )}
        {podium && hasNext && (
          <Button variant="ghost" onClick={() => race(track)}>
            {copy.arcade.again}
          </Button>
        )}
        <Button variant="ghost" onClick={() => setView({ name: 'menu' })}>
          {copy.racing.backToTracks}
        </Button>
      </Screen>
    )
  }

  return (
    <Screen className="gap-4">
      <button type="button" onClick={onBack} className="min-h-12 self-start underline">
        {copy.arcade.backToGames}
      </button>
      <h1 className="font-display text-5xl leading-none">{copy.racing.title}</h1>
      <p className="text-muted">{copy.racing.subtitle}</p>
      <Cascade className="flex flex-col gap-3">
        {Array.from({ length: TRACK_COUNT }, (_, i) => i + 1).map((track) => {
          const open = track <= unlocked
          return (
            <CascadeItem key={track}>
              <button
                type="button"
                disabled={!open}
                onClick={() => race(track)}
                className="w-full text-left disabled:opacity-60"
              >
                <Card className="flex items-center justify-between gap-3">
                  <span>
                    <span className="text-muted block text-sm">
                      {copy.racing.trackLabel(track)}
                    </span>
                    <span className="block font-bold">{copy.racing.trackName(track)}</span>
                    {open && (
                      <span className="text-muted block text-sm">{copy.racing.trackHint(track)}</span>
                    )}
                    {!open && <span className="text-muted text-sm">{copy.racing.locked}</span>}
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
