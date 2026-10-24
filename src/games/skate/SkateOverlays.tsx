import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { Button } from '@/components/Button'
import { copy } from '@/copy'
import { setSoundEnabled, useSoundEnabled } from '@/motion/preferences'
import { spring } from '@/motion/presets'

function Backdrop({
  children,
  label,
  wide = false,
}: {
  children: ReactNode
  label: string
  wide?: boolean
}) {
  return (
    <motion.div
      className="bg-ink/75 absolute inset-0 z-20 grid place-items-center overflow-y-auto p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <motion.div
        className={`bg-surface rounded-card flex w-full flex-col gap-3 p-5 text-center ${wide ? 'max-w-2xl' : 'max-w-sm'}`}
        initial={{ scale: 0.92, y: 14 }}
        animate={{ scale: 1, y: 0 }}
        transition={spring.bouncy}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

interface ReadyOverlayProps {
  relaxed: boolean
  onPlay: () => void
  onExit: () => void
}

/** Menú inicial: cómo se juega con los dos pulgares. */
export function SkateReadyOverlay({ relaxed, onPlay, onExit }: ReadyOverlayProps) {
  const sound = useSoundEnabled()
  return (
    <Backdrop label={copy.skate.title} wide>
      <h2 className="font-display text-4xl leading-none">{copy.skate.title}</h2>
      <p className="font-semibold">{copy.skate.goal}</p>
      <ul className="text-muted grid gap-x-5 gap-y-2 text-left text-sm sm:grid-cols-2">
        {copy.skate.guide.map((line) => (
          <li key={line.text} className="flex items-start gap-2.5">
            <span className="text-xl" aria-hidden>
              {line.icon}
            </span>
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
      {relaxed && (
        <p className="bg-green-soft text-green-ink rounded-chip px-3 py-2 text-sm font-semibold">
          {copy.skate.relaxedNotice}
        </p>
      )}
      <div className="mx-auto flex w-full max-w-xs flex-col gap-2">
        <Button onClick={onPlay}>{copy.skate.play}</Button>
        <label className="text-muted flex min-h-11 items-center justify-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-brand size-5"
            checked={sound}
            onChange={(e) => setSoundEnabled(e.target.checked)}
          />
          {copy.profile.sound}
        </label>
        <button type="button" onClick={onExit} className="text-muted min-h-10 text-sm underline">
          {copy.skate.exit}
        </button>
      </div>
    </Backdrop>
  )
}

export function SkatePauseOverlay({
  onResume,
  onExit,
}: {
  onResume: () => void
  onExit: () => void
}) {
  return (
    <Backdrop label={copy.skate.paused}>
      <h2 className="font-display text-4xl leading-none">{copy.skate.paused}</h2>
      <Button onClick={onResume}>{copy.skate.resume}</Button>
      <Button variant="ghost" onClick={onExit}>
        {copy.skate.exit}
      </Button>
    </Backdrop>
  )
}

export function SkateEndedOverlay({ won }: { won: boolean }) {
  return (
    <motion.div
      className="bg-ink/55 absolute inset-0 z-20 grid place-items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.p
        className="font-display text-bg text-center text-6xl leading-none"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring.bouncy}
      >
        {won ? copy.skate.survived : copy.skate.caught}
      </motion.p>
    </motion.div>
  )
}

/** Aviso a pantalla completa mientras el celular está en vertical. */
export function RotateOverlay() {
  return (
    <div
      className="bg-ink absolute inset-0 z-30 grid place-items-center p-8 text-center"
      role="alert"
    >
      <div className="flex flex-col items-center gap-4">
        <motion.span
          className="text-7xl"
          aria-hidden
          animate={{ rotate: [0, -90, -90, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, times: [0, 0.35, 0.8, 1] }}
        >
          📱
        </motion.span>
        <h2 className="font-display text-bg text-5xl leading-none">{copy.skate.rotateTitle}</h2>
        <p className="text-bg/80">{copy.skate.rotateBody}</p>
      </div>
    </div>
  )
}
