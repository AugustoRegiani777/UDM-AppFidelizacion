import { useState } from 'react'
import { Card } from '@/components/Card'
import { Screen } from '@/components/Screen'
import { saveSokobanStars, sokobanStars, unlockedSokoban } from '@/features/arcade/progress'
import { SokobanGame } from '@/games/sokoban/SokobanGame'
import { LEVELS, LEVEL_COUNT } from '@/games/sokoban/levels'
import { VEHICLE_ICON } from '@/games/sokoban/themes'
import { Cascade, CascadeItem } from '@/motion/Cascade'
import { copy } from '@/copy'

type View = { name: 'menu' } | { name: 'playing'; level: number; attempt: number }

function Stars({ count }: { count: number }) {
  return (
    <span aria-label={copy.sokoban.stars(count)} role="img" className="whitespace-nowrap">
      {[1, 2, 3].map((n) => (
        <span key={n} className={n <= count ? '' : 'opacity-25 grayscale'}>
          ⭐
        </span>
      ))}
    </span>
  )
}

/** Entregas de Miga en la sala de juegos: 12 niveles, cada uno con su escenario y su vehículo. */
export function SokobanArcade({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<View>({ name: 'menu' })
  const [stars, setStars] = useState(sokobanStars)
  const unlocked = unlockedSokoban(stars)

  if (view.name === 'playing') {
    const { level } = view
    return (
      <SokobanGame
        key={`${level}-${view.attempt}`}
        levelId={level}
        onWin={(win) => setStars(saveSokobanStars(level, win.stars))}
        onNext={() =>
          setView({ name: 'playing', level: Math.min(LEVEL_COUNT, level + 1), attempt: 0 })
        }
        onRetry={() => setView({ name: 'playing', level, attempt: view.attempt + 1 })}
        onExit={() => setView({ name: 'menu' })}
      />
    )
  }

  return (
    <Screen className="gap-4">
      <button type="button" onClick={onBack} className="min-h-12 self-start underline">
        {copy.arcade.backToGames}
      </button>
      <h1 className="font-display text-5xl leading-none">{copy.sokoban.title}</h1>
      <p className="text-muted">{copy.sokoban.subtitle}</p>
      <Cascade className="flex flex-col gap-3">
        {LEVELS.map((level) => {
          const open = level.id <= unlocked
          const info = copy.sokoban.levels[level.id - 1]
          return (
            <CascadeItem key={level.id}>
              <button
                type="button"
                disabled={!open}
                onClick={() => setView({ name: 'playing', level: level.id, attempt: 0 })}
                className="w-full text-left disabled:opacity-60"
              >
                <Card className="flex items-center gap-3">
                  <span className="text-4xl" aria-hidden>
                    {open ? VEHICLE_ICON[level.theme.vehicle] : '🔒'}
                  </span>
                  <span className="flex-1">
                    <span className="text-muted block text-sm">
                      {copy.sokoban.levelOf(level.id, LEVEL_COUNT)}
                    </span>
                    <span className="block font-bold">{info?.name}</span>
                    <span className="text-muted block text-xs">
                      {open ? info?.tagline : copy.sokoban.locked}
                    </span>
                  </span>
                  {open && <Stars count={stars[level.id - 1] ?? 0} />}
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
