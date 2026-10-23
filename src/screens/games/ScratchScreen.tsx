import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/Button'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { Screen } from '@/components/Screen'
import { playGame, useGamesConfig } from '@/features/games/gameApi'
import { GameRulesSheet } from '@/games/GameRulesSheet'
import { ScratchCard } from '@/games/ScratchCard'
import { copy } from '@/copy'
import { PrizeOutcome } from './PrizeOutcome'

/** Raspadita post-compra: el resultado ya está decidido por el servidor; raspar solo lo muestra. */
export function ScratchScreen() {
  const { claimId = '' } = useParams()
  const queryClient = useQueryClient()
  const config = useGamesConfig()
  const [revealed, setRevealed] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const play = useQuery({
    queryKey: ['scratch', claimId],
    queryFn: () => playGame('scratch', claimId),
    retry: false,
    staleTime: Infinity,
  })

  if (play.isPending || config.isPending) return <FullScreenLoader />
  if (play.isError || config.isError) {
    return (
      <Screen className="justify-center gap-4 text-center">
        <h1 className="font-display text-5xl leading-none">{copy.games.scratchUnavailable}</h1>
        <Link to="/panel" className="font-bold underline">
          {copy.sale.toPanel}
        </Link>
      </Screen>
    )
  }

  const prize = config.data.scratch.prizes.find((p) => p.id === play.data.prize_id)

  return (
    <Screen className="justify-center gap-5">
      <h1 className="font-display text-center text-5xl leading-none">{copy.games.scratchTitle}</h1>
      <ScratchCard
        onRevealed={() => {
          setRevealed(true)
          queryClient.invalidateQueries({ queryKey: ['dashboard'] })
          queryClient.invalidateQueries({ queryKey: ['games-status'] })
        }}
      >
        <p className="font-display text-brand text-6xl leading-none">{prize?.label}</p>
      </ScratchCard>
      {revealed && (
        <PrizeOutcome points={play.data.points} nextHint={copy.games.nextPurchaseHint} />
      )}
      <Button variant="ghost" onClick={() => setRulesOpen(true)}>
        {copy.games.how}
      </Button>
      <Link to="/panel" className="min-h-12 content-center text-center font-bold underline">
        {copy.sale.toPanel}
      </Link>
      <GameRulesSheet game="scratch" open={rulesOpen} onClose={() => setRulesOpen(false)} />
    </Screen>
  )
}
