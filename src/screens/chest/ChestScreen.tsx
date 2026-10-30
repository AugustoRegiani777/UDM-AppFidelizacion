import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'
import {
  finishChest,
  RewardNotReachedError,
  startChest,
  type FinishChestResult,
} from '@/features/chest/chestApi'
import { useDashboard } from '@/features/dashboard/useDashboard'
import type { GameConfig } from '@engine/config.ts'
import type { GameOutcome, GameSession } from '@/games/outcome'
import { SurvivorsGame } from '@/games/survivors/SurvivorsGame'
import { Celebration } from '@/motion/Celebration'
import { copy } from '@/copy'
import { ChestIllustration } from './ChestIllustration'

type Playing = { game: 'survivors'; session: GameSession<GameConfig> }

type Phase =
  | { name: 'intro' }
  | { name: 'starting' }
  | { name: 'playing'; sessionId: string; play: Playing }
  | { name: 'verifying'; sessionId: string; outcome: GameOutcome }
  | { name: 'opened'; result: FinishChestResult; statsText: string }
  | { name: 'lost'; outcome: GameOutcome; relaxedNext: boolean }
  | { name: 'error'; message: string; retry?: { sessionId: string; outcome: GameOutcome } }

/** Cofre de un premio: se abre al pasar el juego. El servidor reproduce la partida antes de dar el código. */
export function ChestScreen() {
  const { rewardId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const dashboard = useDashboard()
  const [phase, setPhase] = useState<Phase>({ name: 'intro' })

  const rewardName = dashboard.data?.rewards.find((r) => r.id === rewardId)?.name ?? ''

  async function start() {
    setPhase({ name: 'starting' })
    try {
      const started = await startChest(rewardId)
      if (started.already_unlocked) {
        navigate(`/canje/${started.redemption_id}`, { replace: true })
        return
      }
      const base = { seed: started.seed, relaxed: started.relaxed }
      setPhase({
        name: 'playing',
        sessionId: started.session_id,
        play: { game: 'survivors', session: { ...base, config: started.config } },
      })
    } catch (error) {
      setPhase({
        name: 'error',
        message:
          error instanceof RewardNotReachedError ? copy.chest.notReached : copy.chest.errorBody,
      })
    }
  }

  async function verify(sessionId: string, outcome: GameOutcome) {
    setPhase({ name: 'verifying', sessionId, outcome })
    try {
      const result = await finishChest(sessionId, outcome.log)
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      if (result.won && result.redemption) {
        setPhase({ name: 'opened', result, statsText: outcome.statsText })
      } else {
        setPhase({ name: 'lost', outcome, relaxedNext: false })
      }
    } catch {
      setPhase({ name: 'error', message: copy.chest.errorBody, retry: { sessionId, outcome } })
    }
  }

  if (phase.name === 'playing') {
    const onEnd = (outcome: GameOutcome) => void verify(phase.sessionId, outcome)
    const onExit = () => setPhase({ name: 'intro' })
    return <SurvivorsGame session={phase.play.session} onEnd={onEnd} onExit={onExit} />
  }

  return (
    <Screen className="items-center justify-center gap-5 text-center">
      {phase.name === 'intro' && (
        <>
          <ChestIllustration open={false} />
          <h1 className="font-display text-5xl leading-none">
            {copy.chest.introTitle(rewardName)}
          </h1>
          <p className="text-muted text-lg">{copy.chest.introBody}</p>
          <Button onClick={() => void start()}>{copy.chest.open}</Button>
          <BackLink />
        </>
      )}

      {phase.name === 'starting' && <p className="text-muted text-lg">{copy.chest.loading}</p>}
      {phase.name === 'verifying' && <p className="text-muted text-lg">{copy.chest.verifying}</p>}

      {phase.name === 'opened' && phase.result.redemption && (
        <Opened
          result={phase.result}
          statsText={phase.statsText}
          onContinue={(id) => navigate(`/canje/${id}`, { replace: true })}
        />
      )}

      {phase.name === 'lost' && (
        <>
          <ChestIllustration open={false} />
          <h1 className="font-display text-5xl leading-none">{copy.chest.lostTitle}</h1>
          <p className="text-muted text-lg">{phase.outcome.lostText}</p>
          <p className="text-muted text-sm">{phase.outcome.statsText}</p>
          <Button onClick={() => void start()}>{copy.chest.retry}</Button>
          <BackLink />
        </>
      )}

      {phase.name === 'error' && (
        <>
          <h1 className="font-display text-5xl leading-none">{copy.chest.errorTitle}</h1>
          <p className="text-muted text-lg">{phase.message}</p>
          <Button
            onClick={() =>
              phase.retry ? void verify(phase.retry.sessionId, phase.retry.outcome) : void start()
            }
          >
            {copy.chest.retry}
          </Button>
          <BackLink />
        </>
      )}
    </Screen>
  )
}

function Opened({
  result,
  statsText,
  onContinue,
}: {
  result: FinishChestResult
  statsText: string
  onContinue: (redemptionId: string) => void
}) {
  const redemption = result.redemption!
  return (
    <>
      <ChestIllustration open />
      <Celebration className="text-green size-14" />
      <h1 className="font-display text-5xl leading-none">{copy.chest.opened}</h1>
      <p className="text-muted text-lg">{copy.chest.openedBody}</p>
      <p className="text-muted text-sm">{statsText}</p>
      <Button onClick={() => onContinue(redemption.id)}>{copy.chest.seeCode}</Button>
    </>
  )
}

function BackLink() {
  return (
    <Link to="/panel" className="mt-2 min-h-12 content-center font-bold underline">
      {copy.chest.back}
    </Link>
  )
}
