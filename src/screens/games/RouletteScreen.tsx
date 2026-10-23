import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { Screen } from '@/components/Screen'
import { playGame, useGamesConfig, useGamesStatus, type PlayResult } from '@/features/games/gameApi'
import { GameRulesSheet } from '@/games/GameRulesSheet'
import { RouletteWheel, type RouletteHandle } from '@/games/RouletteWheel'
import { copy } from '@/copy'
import { PrizeOutcome } from './PrizeOutcome'

type Phase = 'idle' | 'spinning' | 'done' | 'error'

/** Ruleta diaria: pide el resultado al servidor y recién después hace girar la rueda hasta ese gajo. */
export function RouletteScreen() {
  const queryClient = useQueryClient()
  const config = useGamesConfig()
  const status = useGamesStatus()
  const wheel = useRef<RouletteHandle>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [result, setResult] = useState<PlayResult | null>(null)
  const [rulesOpen, setRulesOpen] = useState(false)

  if (config.isPending || status.isPending) return <FullScreenLoader />
  if (config.isError) throw config.error
  if (status.isError) throw status.error

  const prizes = config.data.roulette.prizes
  const available = status.data.roulette.available
  const showSpinButton = phase === 'idle' || phase === 'spinning' || phase === 'error'

  async function spin() {
    setPhase('spinning')
    try {
      const play = await playGame('roulette')
      await wheel.current?.spinTo(
        Math.max(
          prizes.findIndex((p) => p.id === play.prize_id),
          0,
        ),
      )
      setResult(play)
      setPhase('done')
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      queryClient.invalidateQueries({ queryKey: ['games-status'] })
    } catch {
      setPhase('error')
    }
  }

  return (
    <Screen className="justify-center gap-5">
      <h1 className="font-display text-center text-5xl leading-none">{copy.games.rouletteTitle}</h1>
      <RouletteWheel ref={wheel} prizes={prizes} />

      {phase === 'done' && result && (
        <PrizeOutcome points={result.points} nextHint={copy.games.rouletteTomorrow} />
      )}
      {phase === 'error' && (
        <p role="alert" className="text-brand-ink text-center">
          {copy.games.error}
        </p>
      )}
      {phase === 'idle' && !available && (
        <p className="text-muted text-center">{copy.games.rouletteTomorrow}</p>
      )}
      {showSpinButton && (
        <Button disabled={phase === 'spinning' || (phase === 'idle' && !available)} onClick={spin}>
          {phase === 'spinning' ? copy.games.spinning : copy.games.spin}
        </Button>
      )}
      <Button variant="ghost" onClick={() => setRulesOpen(true)}>
        {copy.games.how}
      </Button>
      <Link to="/panel" className="min-h-12 content-center text-center font-bold underline">
        {copy.sale.toPanel}
      </Link>
      <GameRulesSheet game="roulette" open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </Screen>
  )
}
