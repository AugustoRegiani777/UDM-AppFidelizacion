import type { ReactNode } from 'react'
import { copy } from '@/copy'
import { envidoFormula, sameCard, type Card, type EnvidoBreakdown } from './cards.ts'
import { CardView } from './CardView.tsx'
import type { EnvidoSummary, HandSummary } from './summary.ts'

const t = copy.truco.summary

function CardRow({
  hand,
  marked = [],
  faceDown = [],
  size = 'w-[44px]',
}: {
  hand: readonly Card[]
  /** Cartas que forman el tanto (las demás se apagan). */
  marked?: readonly Card[]
  /** Cartas que no se muestran. */
  faceDown?: readonly Card[]
  size?: string
}) {
  return (
    <div className="flex justify-center gap-1.5">
      {hand.map((card) => {
        const hidden = faceDown.some((c) => sameCard(c, card))
        const dim = marked.length > 0 && !marked.some((c) => sameCard(c, card))
        return (
          <div key={`${card.n}-${card.suit}`} className={dim ? 'opacity-50' : undefined}>
            {hidden ? (
              <CardView back className={size} />
            ) : (
              <CardView
                card={card}
                className={size}
                highlight={marked.some((c) => sameCard(c, card))}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function TantoRow({
  label,
  hand,
  breakdown,
  show,
}: {
  label: string
  hand: readonly Card[]
  breakdown: EnvidoBreakdown
  show: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-sm font-bold">{label}</p>
      <CardRow hand={hand} marked={show ? breakdown.cards : []} faceDown={show ? [] : hand} />
      {show && (
        <p className="text-sm font-semibold" data-testid="envido-formula">
          {envidoFormula(breakdown)}
        </p>
      )}
    </div>
  )
}

/** Los dos tantos del envido, con las cartas que los forman y la cuenta. */
export function EnvidoPanel({
  envido,
  mineDealt,
  rivalDealt,
}: {
  envido: EnvidoSummary
  mineDealt: readonly Card[]
  rivalDealt: readonly Card[]
}) {
  const names = envido.chain.map((c) => t.envidoNames[c]).join(' + ')
  return (
    <div className="flex flex-col gap-3" data-testid="envido-panel">
      <p className="text-muted text-sm">{t.envidoOf(names)}</p>
      <TantoRow label={t.yourTanto} hand={mineDealt} breakdown={envido.mine} show />
      <TantoRow
        label={t.rivalTanto}
        hand={rivalDealt}
        breakdown={envido.rival}
        show={envido.revealed}
      />
      <p className="font-bold">{t.envidoWin(envido.winner === 0, envido.won, envido.tiedByMano)}</p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t border-black/10 pt-3 text-left first:border-0 first:pt-0">
      <h3 className="text-muted text-xs font-bold tracking-wide uppercase">{title}</h3>
      {children}
    </section>
  )
}

/** Desglose de la mano: tantos, bazas, truco y el total que sumó cada uno. */
export function HandSummaryView({ summary }: { summary: HandSummary }) {
  const { result, envido } = summary
  const iWon = result.winner === 0
  const reason = (() => {
    if (result.reason === 'fold') return iWon ? t.reasonFoldRival : t.reasonFoldMine
    if (result.reason === 'noquiero') return iWon ? t.reasonNoRival : t.reasonNoMine
    return t.reasonTricks
  })()
  const rivalPlayed = summary.tricks.map((trick) => trick.rival)
  const rivalFaceDown = summary.revealRival
    ? []
    : summary.rivalDealt.filter((c) => !rivalPlayed.some((p) => sameCard(p, c)))

  return (
    <div className="flex flex-col gap-3" data-testid="hand-summary">
      <p className="bg-brand-soft text-brand-ink rounded-xl px-3 py-2 text-center text-sm font-bold">
        {t.total(summary.total[0], summary.total[1])}
      </p>
      {/* Con el envido aceptado, sus cartas ya se ven abajo con la cuenta. */}
      {!envido?.accepted && (
        <>
          <Section title={t.yourCards}>
            <CardRow hand={summary.mineDealt} />
          </Section>
          <Section title={t.rivalCards}>
            <CardRow hand={summary.rivalDealt} faceDown={rivalFaceDown} />
            {!summary.revealRival && rivalFaceDown.length > 0 && (
              <p className="text-muted text-xs">{t.rivalHidden}</p>
            )}
          </Section>
        </>
      )}

      {envido && (
        <Section title={t.envido}>
          {envido.accepted ? (
            <EnvidoPanel
              envido={envido}
              mineDealt={summary.mineDealt}
              rivalDealt={summary.rivalDealt}
            />
          ) : (
            <p className="text-sm font-semibold">
              {envido.winner === 0
                ? t.envidoDeclinedYes(envido.won)
                : t.envidoDeclinedNo(envido.won)}
            </p>
          )}
        </Section>
      )}

      {summary.tricks.length > 0 && (
        <Section title={t.tricks}>
          <ul className="flex flex-col gap-1.5">
            {summary.tricks.map((trick) => (
              <li key={trick.number} className="flex items-center gap-2 text-sm">
                <span className="w-14 font-semibold">{t.trick(trick.number)}</span>
                <CardView card={trick.mine} className="w-[30px]" highlight={trick.winner === 0} />
                <span aria-hidden>vs</span>
                <CardView card={trick.rival} className="w-[30px]" highlight={trick.winner === 1} />
                <span className="text-muted flex-1 text-right">
                  {trick.winner === 0 ? t.trickWon : trick.winner === 1 ? t.trickLost : t.trickTie}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.points > 0 && (
        <Section title={t.stakeNames[summary.stakeLevel] ?? t.stakeNames[0]!}>
          <p className="text-sm font-semibold">
            {t.handLine(t.stakeNames[summary.stakeLevel] ?? 'Mano', result.points, iWon, reason)}
          </p>
        </Section>
      )}
    </div>
  )
}
