import { useState } from 'react'
import { Card } from '@/components/Card'
import { Screen } from '@/components/Screen'
import { getCoins } from '@/features/arcade/progress'
import { PROFILES, type Profile } from '@/games/truco/ai'
import { TrucoGame } from '@/games/truco/TrucoGame'
import { Cascade, CascadeItem } from '@/motion/Cascade'
import { copy } from '@/copy'

type View = { name: 'menu' } | { name: 'playing'; profile: Profile; seed: number }

/** El reparto sale al azar; la dirección con ?trucoSeed=N lo fija (práctica sin premio: sirve para las pruebas). */
const newSeed = () => {
  const fixed = Number(new URLSearchParams(window.location.search).get('trucoSeed'))
  if (Number.isInteger(fixed) && fixed > 0) return fixed >>> 0
  return (crypto.getRandomValues(new Uint32Array(1))[0] ?? 1) >>> 0
}

/** Truco en la sala de juegos: elegís rival y jugás todas las partidas que quieras. */
export function TrucoArcade({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<View>({ name: 'menu' })

  if (view.name === 'playing') {
    const { profile } = view
    return (
      <TrucoGame
        key={view.seed}
        profile={profile}
        seed={view.seed}
        onRematch={() => setView({ name: 'playing', profile, seed: newSeed() })}
        onExit={() => setView({ name: 'menu' })}
      />
    )
  }

  return (
    <Screen className="gap-4">
      <button type="button" onClick={onBack} className="min-h-12 self-start underline">
        {copy.arcade.backToGames}
      </button>
      <h1 className="font-display text-5xl leading-none">{copy.truco.title}</h1>
      <p className="text-muted">{copy.truco.subtitle}</p>
      <p className="font-bold">🪙 {copy.truco.coins(getCoins())}</p>
      <Cascade className="flex flex-col gap-3">
        {PROFILES.map((profile) => {
          const info = copy.truco.opponents[profile.id]
          return (
            <CascadeItem key={profile.id}>
              <button
                type="button"
                onClick={() => setView({ name: 'playing', profile, seed: newSeed() })}
                className="w-full text-left"
              >
                <Card className="flex items-center gap-4">
                  <span className="text-4xl" aria-hidden>
                    {info.icon}
                  </span>
                  <span className="flex-1">
                    <span className="block font-bold">{info.name}</span>
                    <span className="text-muted block text-sm">{info.bio}</span>
                  </span>
                  <span className="text-brand-ink font-semibold">{copy.arcade.play}</span>
                </Card>
              </button>
            </CascadeItem>
          )
        })}
      </Cascade>
      <p className="text-muted text-sm">{copy.truco.noFlor}</p>
    </Screen>
  )
}
