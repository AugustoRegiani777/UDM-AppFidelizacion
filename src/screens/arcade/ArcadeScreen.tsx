import { useState } from 'react'
import { Link } from 'react-router'
import { Card } from '@/components/Card'
import { Screen } from '@/components/Screen'
import { Cascade, CascadeItem } from '@/motion/Cascade'
import { copy } from '@/copy'
import { RacingArcade } from './RacingArcade'
import { SkateArcade } from './SkateArcade'
import { SokobanArcade } from './SokobanArcade'
import { SkateParkArcade } from './SkateParkArcade'
import { SurvivorsArcade } from './SurvivorsArcade'
import { TrucoArcade } from './TrucoArcade'

type GameId = 'survivors' | 'skate' | 'skatepark' | 'racing' | 'truco' | 'sokoban'

const GAMES: { id: GameId; icon: string }[] = [
  { id: 'survivors', icon: '🥪' },
  { id: 'skatepark', icon: '🛹' },
  { id: 'skate', icon: '🏁' },
  { id: 'racing', icon: '🏎️' },
  { id: 'truco', icon: '🃏' },
  { id: 'sokoban', icon: '📦' },
]

/** Sala de juegos: elegís el juego y jugás todo lo que quieras, sin puntos ni premios. */
export function ArcadeScreen() {
  const [game, setGame] = useState<GameId | null>(null)

  if (game === 'survivors') return <SurvivorsArcade onBack={() => setGame(null)} />
  if (game === 'skate') return <SkateArcade onBack={() => setGame(null)} />
  if (game === 'skatepark') return <SkateParkArcade onBack={() => setGame(null)} />
  if (game === 'racing') return <RacingArcade onBack={() => setGame(null)} />
  if (game === 'truco') return <TrucoArcade onBack={() => setGame(null)} />
  if (game === 'sokoban') return <SokobanArcade onBack={() => setGame(null)} />

  return (
    <Screen className="gap-4">
      <Link to="/panel" className="min-h-12 content-center underline">
        {copy.arcade.back}
      </Link>
      <h1 className="font-display text-5xl leading-none">{copy.arcade.title}</h1>
      <p className="text-muted">{copy.arcade.subtitle}</p>
      <Cascade className="flex flex-col gap-3">
        {GAMES.map(({ id, icon }) => (
          <CascadeItem key={id}>
            <button type="button" onClick={() => setGame(id)} className="w-full text-left">
              <Card className="flex items-center gap-4">
                <span className="text-4xl" aria-hidden>
                  {icon}
                </span>
                <span className="flex-1">
                  <span className="block font-bold">{copy.arcade.games[id].name}</span>
                  <span className="text-muted block text-sm">{copy.arcade.games[id].body}</span>
                </span>
                <span className="text-brand-ink font-semibold">{copy.arcade.play}</span>
              </Card>
            </button>
          </CascadeItem>
        ))}
      </Cascade>
    </Screen>
  )
}
