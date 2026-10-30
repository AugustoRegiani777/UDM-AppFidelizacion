import { useState } from 'react'
import { Link } from 'react-router'
import { Card } from '@/components/Card'
import { Screen } from '@/components/Screen'
import { Cascade, CascadeItem } from '@/motion/Cascade'
import { copy } from '@/copy'
import { useHoldUpdates } from '@/pwa/useHoldUpdates'
import { NinjaArcade } from './NinjaArcade'
import { RacingArcade } from './RacingArcade'
import { MigaSkateArcade } from './MigaSkateArcade'
import { SokobanArcade } from './SokobanArcade'
import { SurvivorsArcade } from './SurvivorsArcade'
import { TrucoArcade } from './TrucoArcade'
import { WalletBar } from './WalletBar'

type GameId = 'survivors' | 'migaskate' | 'racing' | 'truco' | 'sokoban' | 'ninja'

const GAMES: { id: GameId; icon: string }[] = [
  { id: 'survivors', icon: '🥪' },
  { id: 'migaskate', icon: '🛹' },
  { id: 'racing', icon: '🏎️' },
  { id: 'truco', icon: '🃏' },
  { id: 'sokoban', icon: '📦' },
  { id: 'ninja', icon: '🥷' },
]

/** Sala de juegos: elegís el juego y jugás todo lo que quieras, sin puntos ni premios. */
export function ArcadeScreen() {
  const [game, setGame] = useState<GameId | null>(null)
  // Con un juego en pantalla, una versión nueva de la app espera a que salgas.
  useHoldUpdates(game !== null)

  if (game === 'survivors') return <SurvivorsArcade onBack={() => setGame(null)} />
  if (game === 'migaskate') return <MigaSkateArcade onBack={() => setGame(null)} />
  if (game === 'racing') return <RacingArcade onBack={() => setGame(null)} />
  if (game === 'truco') return <TrucoArcade onBack={() => setGame(null)} />
  if (game === 'sokoban') return <SokobanArcade onBack={() => setGame(null)} />
  if (game === 'ninja') return <NinjaArcade onBack={() => setGame(null)} />

  return (
    <Screen className="gap-4">
      <Link to="/panel" className="min-h-12 content-center underline">
        {copy.arcade.back}
      </Link>
      <h1 className="font-display text-5xl leading-none">{copy.arcade.title}</h1>
      <p className="text-muted">{copy.arcade.subtitle}</p>
      <WalletBar />
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
