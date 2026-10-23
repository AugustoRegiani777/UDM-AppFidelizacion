import { motion } from 'motion/react'
import { Button } from '@/components/Button'
import { copy } from '@/copy'
import { spring } from '@/motion/presets'
import { setSoundEnabled, useSoundEnabled } from '@/motion/preferences'

function Backdrop({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <motion.div
      className="bg-ink/75 absolute inset-0 z-20 grid place-items-center p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <motion.div
        className="bg-surface rounded-card flex w-full max-w-sm flex-col gap-4 p-6 text-center"
        initial={{ scale: 0.9, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={spring.bouncy}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

interface ReadyOverlayProps {
  durationSeconds: number
  relaxed: boolean
  onPlay: () => void
  onExit: () => void
}

export function ReadyOverlay({ durationSeconds, relaxed, onPlay, onExit }: ReadyOverlayProps) {
  const sound = useSoundEnabled()
  return (
    <Backdrop label={copy.survivors.title}>
      <h2 className="font-display text-5xl leading-none">{copy.survivors.title}</h2>
      <p className="text-lg font-semibold">{copy.survivors.goal(durationSeconds)}</p>
      <ul className="text-muted flex flex-col gap-2 text-left">
        {copy.survivors.howTo.map((line) => (
          <li key={line.text} className="flex items-center gap-3">
            <span className="text-2xl" aria-hidden>
              {line.icon}
            </span>
            <span>{line.text}</span>
          </li>
        ))}
      </ul>
      {relaxed && (
        <p className="bg-green-soft text-green-ink rounded-chip px-3 py-2 text-sm font-semibold">
          {copy.survivors.relaxedNotice}
        </p>
      )}
      <Button onClick={onPlay}>{copy.survivors.play}</Button>
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
        {copy.survivors.exit}
      </button>
    </Backdrop>
  )
}

export function PauseOverlay({ onResume, onExit }: { onResume: () => void; onExit: () => void }) {
  return (
    <Backdrop label={copy.survivors.paused}>
      <h2 className="font-display text-5xl leading-none">{copy.survivors.paused}</h2>
      <Button onClick={onResume}>{copy.survivors.resume}</Button>
      <Button variant="ghost" onClick={onExit}>
        {copy.survivors.exit}
      </Button>
    </Backdrop>
  )
}

export function EndedOverlay({ won }: { won: boolean }) {
  return (
    <motion.div
      className="absolute inset-0 z-20 grid place-items-center bg-ink/55"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <motion.p
        className="font-display text-bg text-center text-6xl leading-none"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={spring.bouncy}
      >
        {won ? copy.survivors.survived : copy.survivors.caught}
      </motion.p>
    </motion.div>
  )
}
