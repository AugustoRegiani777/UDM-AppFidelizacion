import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/Button'
import { addCoins, getCoins, spendCoins } from '@/features/arcade/progress'
import { copy } from '@/copy'
import { spring } from '@/motion/presets'
import { setSoundEnabled, useSoundEnabled } from '@/motion/preferences'
import { chooseAction, type Profile } from './ai.ts'
import { sfx, unlockAudio } from './audio.ts'
import { trucoRank } from './cards.ts'
import { CardView, Fosforos } from './CardView.tsx'
import {
  act,
  createMatch,
  legalActions,
  type Action,
  type EnvidoCall,
  type Say,
  type Seat,
  type TrucoState,
} from './engine.ts'
import { MATE_SIPS, MateView } from './MateView.tsx'

const TURN_SECONDS = 25
const CHIPA_COST = 3
const CHIPA_SECONDS = 15
const MATCH_COINS = 5

interface TrucoGameProps {
  profile: Profile
  seed: number
  onRematch: () => void
  onExit: () => void
}

interface Bubble {
  text: string
  id: number
}

function makeRandom(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function Backdrop({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <motion.div
      className="bg-ink/75 absolute inset-0 z-30 grid place-items-center overflow-y-auto p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <motion.div
        className="bg-surface text-ink rounded-card flex w-full max-w-sm flex-col gap-4 p-6 text-center"
        initial={{ scale: 0.9, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={spring.bouncy}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

const chip =
  'min-h-11 rounded-full px-4 py-2 text-sm font-bold shadow active:scale-95 transition-transform'
const chipPrimary = `${chip} bg-brand text-white`
const chipSecondary = `${chip} bg-surface text-ink`

export function TrucoGame({ profile, seed, onRematch, onExit }: TrucoGameProps) {
  const sound = useSoundEnabled()
  const opponent = copy.truco.opponents[profile.id]

  const [game, setGame] = useState<TrucoState>(() => createMatch(seed))
  const gameRef = useRef(game)
  const aiRandom = useRef(makeRandom(seed + 99))
  const timers = useRef<number[]>([])
  const luckRef = useRef(0)
  const earnedRef = useRef(0)

  const [started, setStarted] = useState(false)
  const [luck, setLuck] = useState(0)
  const [sips, setSips] = useState(MATE_SIPS)
  const [sipping, setSipping] = useState(false)
  const [filling, setFilling] = useState(false)
  const [coins, setCoins] = useState(getCoins)
  const [earned, setEarned] = useState(0)
  const [bubbles, setBubbles] = useState<[Bubble | null, Bubble | null]>([null, null])
  const [toast, setToast] = useState<string | null>(null)
  const [deadline, setDeadline] = useState(0)
  const [now, setNow] = useState(0)

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms))
  }, [])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach((id) => window.clearTimeout(id))
  }, [])

  const showBubble = useCallback(
    (seat: Seat, text: string) => {
      const id = Math.random()
      setBubbles((prev) => (seat === 0 ? [{ text, id }, prev[1]] : [prev[0], { text, id }]))
      later(
        () =>
          setBubbles((prev) => {
            const current = prev[seat]
            if (!current || current.id !== id) return prev
            return seat === 0 ? [null, prev[1]] : [prev[0], null]
          }),
        2000,
      )
    },
    [later],
  )

  const handleEvents = useCallback(
    (state: TrucoState) => {
      for (const event of state.events) {
        switch (event.t) {
          case 'play':
            sfx.card()
            break
          case 'say':
            if (event.what === 'quiero' || event.what === 'no') sfx.say()
            else sfx.shout()
            showBubble(event.seat, copy.truco.says[event.what as Say])
            break
          case 'envido': {
            const r = event.result
            setToast(
              copy.truco.envidoResult(r.points[0], r.points[1], r.winner === 0, r.won, r.accepted),
            )
            later(() => setToast(null), 3800)
            break
          }
          case 'hand':
            if (event.result.winner === 0) {
              sfx.winHand()
              earnedRef.current += 1
              setCoins(addCoins(1))
            } else {
              sfx.loseHand()
            }
            break
          case 'match':
            if (event.winner === 0) {
              sfx.win()
              earnedRef.current += MATCH_COINS
              setCoins(addCoins(MATCH_COINS))
            } else {
              sfx.lose()
            }
            setEarned(earnedRef.current)
            break
          default:
        }
      }
    },
    [later, showBubble],
  )

  const apply = useCallback(
    (seat: Seat, action: Action) => {
      const prev = gameRef.current
      let next: TrucoState
      try {
        next = act(prev, seat, action, action.t === 'next' ? luckRef.current : 0)
      } catch {
        return
      }
      gameRef.current = next
      setGame(next)
      if (action.t === 'next') {
        // La suerte rinde en este reparto y se va gastando de a poco.
        luckRef.current = Math.max(0, luckRef.current - 1)
        setLuck(luckRef.current)
        setToast(null)
      }
      handleEvents(next)
      const humanTurn = next.turn === 0 && (next.phase === 'play' || next.phase === 'respond')
      setNow(Date.now())
      setDeadline(humanTurn ? Date.now() + TURN_SECONDS * 1000 : 0)
    },
    [handleEvents],
  )

  // Turno del rival: piensa un ratito y juega.
  useEffect(() => {
    if (!started || game.turn !== 1) return
    if (game.phase !== 'play' && game.phase !== 'respond') return
    const id = window.setTimeout(
      () => apply(1, chooseAction(gameRef.current, 1, profile, aiRandom.current)),
      750 + aiRandom.current() * 900,
    )
    return () => window.clearTimeout(id)
  }, [game, started, profile, apply])

  // Reloj del jugador: si se acaba, juega solo lo más seguro.
  useEffect(() => {
    if (!deadline) return
    const tick = window.setInterval(() => setNow(Date.now()), 250)
    const timeout = window.setTimeout(
      () => {
        const g = gameRef.current
        if (g.turn !== 0) return
        setToast(copy.truco.timeUp)
        later(() => setToast(null), 2200)
        if (g.phase === 'respond') {
          apply(0, { t: 'no' })
          return
        }
        let lowest = 0
        g.hands[0].forEach((card, i) => {
          if (trucoRank(card) < trucoRank(g.hands[0][lowest]!)) lowest = i
        })
        apply(0, { t: 'play', index: lowest })
      },
      Math.max(0, deadline - Date.now()),
    )
    return () => {
      window.clearInterval(tick)
      window.clearTimeout(timeout)
    }
  }, [deadline, apply, later])

  function start() {
    unlockAudio()
    setStarted(true)
    if (game.turn === 0) {
      setNow(Date.now())
      setDeadline(Date.now() + TURN_SECONDS * 1000)
    }
  }

  function tapMate() {
    if (sipping || filling) return
    if (sips === 0) {
      setFilling(true)
      sfx.pour()
      later(() => {
        setSips(MATE_SIPS)
        setFilling(false)
      }, 1000)
      return
    }
    setSipping(true)
    sfx.sip()
  }

  function sipDone() {
    setSipping(false)
    setSips((n) => Math.max(0, n - 1))
    luckRef.current = Math.min(3, luckRef.current + 1)
    setLuck(luckRef.current)
  }

  function eatChipa() {
    if (!deadline) return
    if (!spendCoins(CHIPA_COST)) {
      setToast(copy.truco.noCoins)
      later(() => setToast(null), 1800)
      return
    }
    setCoins(getCoins())
    setDeadline((d) => d + CHIPA_SECONDS * 1000)
    sfx.pour()
  }

  const myTurn = game.turn === 0 && (game.phase === 'play' || game.phase === 'respond')
  const legal = myTurn ? legalActions(game, 0) : []
  const can = (t: Action['t']) => legal.some((a) => a.t === t)
  const canEnvido = (call: EnvidoCall) => legal.some((a) => a.t === 'envido' && a.call === call)
  const pending = game.pending
  const responding = myTurn && game.phase === 'respond' && pending !== null
  const secondsLeft = deadline ? Math.max(0, Math.ceil((deadline - now) / 1000)) : 0

  const trucoLabel = (() => {
    if (responding && pending?.kind === 'truco')
      return pending.level === 1
        ? copy.truco.buttons.quieroRetruco
        : copy.truco.buttons.quieroValecuatro
    return [copy.truco.buttons.truco, copy.truco.buttons.retruco, copy.truco.buttons.valecuatro][
      game.trucoLevel
    ]
  })()

  const pendingText = (() => {
    if (!pending) return null
    const what: Say =
      pending.kind === 'truco'
        ? (['truco', 'retruco', 'valecuatro'] as const)[pending.level - 1]!
        : pending.chain[pending.chain.length - 1]!
    return copy.truco.rivalCalled(copy.truco.says[what])
  })()

  const envidoLabel = (call: EnvidoCall) =>
    responding && pending?.kind === 'truco' && call === 'envido'
      ? copy.truco.buttons.envidoFirst
      : copy.truco.buttons[call]

  const result = game.handResult

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-[#1f5a3c] text-[#fff6e0] select-none">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, rgba(255,255,255,0.12), rgba(0,0,0,0.38))',
        }}
      />

      {/* Cabecera: salir, rival y monedas */}
      <header className="relative z-10 flex items-center justify-between gap-2 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onExit}
          aria-label={copy.truco.exit}
          className="bg-surface/90 text-ink grid size-11 place-items-center rounded-full text-lg shadow"
        >
          ✕
        </button>
        <div className="relative flex items-center gap-2">
          <span className="text-4xl" aria-hidden>
            {opponent.icon}
          </span>
          <div>
            <p className="font-display text-2xl leading-none">{opponent.name}</p>
            <p className="text-xs opacity-80">
              {myTurn ? copy.truco.yourTurn : copy.truco.waiting}
            </p>
          </div>
          <AnimatePresence>
            {bubbles[1] && (
              <motion.p
                key={bubbles[1].id}
                className="text-ink absolute top-full left-10 z-20 mt-1 rounded-2xl bg-white px-3 py-1.5 text-sm font-bold whitespace-nowrap shadow-lg"
                initial={{ opacity: 0, scale: 0.6, y: -6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring.bouncy}
              >
                {bubbles[1].text}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <p className="bg-ink/40 rounded-full px-3 py-1.5 text-sm font-bold">🪙 {coins}</p>
      </header>

      {/* Marcador */}
      <section className="relative z-10 mx-3 mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-x-2 gap-y-0.5 rounded-2xl bg-black/25 px-3 py-1.5 text-sm">
        <span className="font-semibold">{copy.truco.rival}</span>
        <Fosforos points={game.scores[1]} target={game.target} />
        <span className="font-display text-xl leading-none">{game.scores[1]}</span>
        <span className="font-semibold">{copy.truco.you}</span>
        <Fosforos points={game.scores[0]} target={game.target} />
        <span className="font-display text-xl leading-none">{game.scores[0]}</span>
      </section>

      {/* Cartas del rival */}
      <div className="relative z-10 mt-2 flex justify-center gap-1.5" aria-hidden>
        {game.hands[1].map((_, i) => (
          <CardView key={i} back className="w-[min(11vw,46px)]" />
        ))}
      </div>

      {/* Mesa */}
      <main className="relative z-10 grid min-h-0 flex-1 grid-cols-[88px_1fr_76px] items-center gap-1 px-2">
        <MateView
          sips={sips}
          luck={luck}
          sipping={sipping}
          filling={filling}
          onTap={tapMate}
          onSipDone={sipDone}
        />

        <div className="grid grid-cols-3 justify-items-center gap-x-1.5 gap-y-3">
          {[1, 0].map((seat) =>
            [0, 1, 2].map((i) => {
              const card = game.table[seat as Seat][i]
              const won = game.tricks[i] === seat
              return (
                <div key={`${seat}-${i}`} className="aspect-[2/3] w-[min(15vw,64px)]">
                  <AnimatePresence>
                    {card && (
                      <motion.div
                        key={`${card.n}-${card.suit}`}
                        initial={{
                          y: seat === 1 ? -70 : 90,
                          opacity: 0,
                          scale: 1.25,
                          rotate: seat === 1 ? -8 : 8,
                        }}
                        animate={{ y: 0, opacity: 1, scale: 1, rotate: (i - 1) * 3 }}
                        transition={spring.bouncy}
                      >
                        <CardView card={card} className="w-full" highlight={won} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            }),
          )}
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          {deadline > 0 && (
            <>
              <p
                className={`font-display text-4xl leading-none ${secondsLeft <= 5 ? 'text-[#ff8a8a]' : ''}`}
                role="timer"
                aria-label={copy.truco.turnClock}
              >
                {secondsLeft}
              </p>
              <div className="bg-bg/25 h-1.5 w-14 overflow-hidden rounded-full">
                <div
                  className="h-full origin-left rounded-full bg-[#f7c948]"
                  style={{ transform: `scaleX(${Math.min(1, secondsLeft / TURN_SECONDS)})` }}
                />
              </div>
              <button
                type="button"
                onClick={eatChipa}
                className="bg-surface text-ink rounded-2xl px-2 py-1.5 text-xs leading-tight font-bold shadow active:scale-95"
              >
                🧀 {copy.truco.chipa}
                <span className="text-muted block font-normal">{copy.truco.chipaBody}</span>
                <span className="block">🪙 {CHIPA_COST}</span>
              </button>
            </>
          )}
        </div>
      </main>

      {/* Avisos */}
      <div className="relative z-10 flex min-h-12 flex-col items-center justify-center px-3 text-center">
        <AnimatePresence mode="wait">
          {toast ? (
            <motion.p
              key={toast}
              className="rounded-xl bg-black/40 px-3 py-1 text-sm font-semibold"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {toast}
            </motion.p>
          ) : (
            pendingText &&
            responding && (
              <motion.p
                key={pendingText}
                className="font-display text-3xl leading-none text-[#f7c948]"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                {pendingText}
              </motion.p>
            )
          )}
        </AnimatePresence>
      </div>

      {/* Acciones */}
      <div className="relative z-10 flex min-h-[3.25rem] flex-wrap items-center justify-center gap-2 px-3">
        {responding && (
          <>
            <button type="button" className={chipPrimary} onClick={() => apply(0, { t: 'quiero' })}>
              {copy.truco.buttons.quiero}
            </button>
            <button type="button" className={chipSecondary} onClick={() => apply(0, { t: 'no' })}>
              {copy.truco.buttons.no}
            </button>
          </>
        )}
        {myTurn && can('truco') && (
          <button type="button" className={chipPrimary} onClick={() => apply(0, { t: 'truco' })}>
            {trucoLabel}
          </button>
        )}
        {(['envido', 'real', 'falta'] as const).map(
          (call) =>
            canEnvido(call) && (
              <button
                key={call}
                type="button"
                className={chipSecondary}
                onClick={() => apply(0, { t: 'envido', call })}
              >
                {envidoLabel(call)}
              </button>
            ),
        )}
        {myTurn && game.phase === 'play' && (
          <button type="button" className={chipSecondary} onClick={() => apply(0, { t: 'fold' })}>
            {copy.truco.buttons.fold}
          </button>
        )}
      </div>

      {/* Tu mano */}
      <div className="relative z-10 flex justify-center gap-2 px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <AnimatePresence>
          {game.hands[0].map((card, index) => (
            <motion.button
              key={`${card.n}-${card.suit}`}
              type="button"
              layout
              disabled={!(myTurn && game.phase === 'play')}
              onClick={() => apply(0, { t: 'play', index })}
              className="w-[min(26vw,108px)] disabled:opacity-90"
              initial={{ y: 80, opacity: 0, rotate: (index - 1) * 6 }}
              animate={{ y: 0, opacity: 1, rotate: (index - 1) * 3 }}
              exit={{ y: -60, opacity: 0, scale: 0.9 }}
              whileHover={myTurn ? { y: -10 } : undefined}
              whileTap={myTurn ? { scale: 0.94 } : undefined}
              transition={spring.bouncy}
            >
              <CardView card={card} className="w-full" />
            </motion.button>
          ))}
        </AnimatePresence>
      </div>

      {/* Fin de la mano */}
      <AnimatePresence>
        {game.phase === 'handOver' && result && (
          <motion.div
            className="bg-ink/55 absolute inset-0 z-20 grid place-items-center p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-surface text-ink rounded-card flex w-full max-w-xs flex-col items-center gap-3 p-6 text-center"
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={spring.bouncy}
            >
              <p className="font-display text-4xl leading-none">
                {result.winner === 0
                  ? copy.truco.handWon(result.points)
                  : copy.truco.handLost(result.points)}
              </p>
              <p className="text-muted text-sm">
                {(result.winner === 0 ? copy.truco.reasons : copy.truco.reasonsMine)[result.reason]}
              </p>
              <p className="text-muted text-sm">{copy.truco.luckHint}</p>
              <Button onClick={() => apply(0, { t: 'next' })}>{copy.truco.next}</Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {!started && (
        <Backdrop label={copy.truco.title}>
          <p className="text-6xl" aria-hidden>
            {opponent.icon}
          </p>
          <h2 className="font-display text-5xl leading-none">{opponent.name}</h2>
          <p className="text-muted">{opponent.bio}</p>
          <ul className="text-muted flex flex-col gap-2 text-left text-sm">
            {copy.truco.howTo.map((line) => (
              <li key={line.text} className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden>
                  {line.icon}
                </span>
                <span>{line.text}</span>
              </li>
            ))}
          </ul>
          <p className="text-muted text-xs">{copy.truco.noFlor}</p>
          <Button onClick={start}>{copy.truco.start}</Button>
          <label className="text-muted flex min-h-11 items-center justify-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-brand size-5"
              checked={sound}
              onChange={(e) => setSoundEnabled(e.target.checked)}
            />
            {copy.profile.sound}
          </label>
          <button type="button" onClick={onExit} className="text-muted min-h-11 text-sm underline">
            {copy.truco.exit}
          </button>
        </Backdrop>
      )}

      {game.phase === 'matchOver' && (
        <Backdrop label={game.matchWinner === 0 ? copy.truco.matchWon : copy.truco.matchLost}>
          <p className="text-6xl" aria-hidden>
            {game.matchWinner === 0 ? '🏆' : '😅'}
          </p>
          <h2 className="font-display text-5xl leading-none">
            {game.matchWinner === 0 ? copy.truco.matchWon : copy.truco.matchLost}
          </h2>
          <p className="text-muted">
            {game.scores[0]} a {game.scores[1]}
          </p>
          {earned > 0 && <p className="font-bold">🪙 {copy.truco.coinsEarned(earned)}</p>}
          <Button onClick={onRematch}>{copy.truco.rematch}</Button>
          <Button variant="ghost" onClick={onExit}>
            {copy.truco.exit}
          </Button>
        </Backdrop>
      )}
    </div>
  )
}
