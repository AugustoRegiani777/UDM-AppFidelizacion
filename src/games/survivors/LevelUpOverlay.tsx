import { motion } from 'motion/react'
import { useEffect } from 'react'
import { UPGRADES, type UpgradeId } from '@engine/config.ts'
import { copy } from '@/copy'
import { spring } from '@/motion/presets'

interface LevelUpOverlayProps {
  level: number
  choices: UpgradeId[]
  upgradeLevels: Record<UpgradeId, number>
  onPick: (index: number) => void
}

/** Pausa el juego y deja elegir 1 de 3 mejoras. Tocá una carta o apretá 1, 2 o 3. */
export function LevelUpOverlay({ level, choices, upgradeLevels, onPick }: LevelUpOverlayProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1
      if (index >= 0 && index < choices.length) onPick(index)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choices, onPick])

  return (
    <motion.div
      className="bg-ink/70 absolute inset-0 z-20 flex flex-col justify-center gap-3 p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      role="dialog"
      aria-modal="true"
      aria-label={copy.survivors.levelUpTitle(level)}
    >
      <motion.h2
        className="font-display text-bg text-center text-5xl leading-none"
        initial={{ y: -12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={spring.bouncy}
      >
        {copy.survivors.levelUpTitle(level)}
      </motion.h2>
      <p className="text-bg/80 text-center text-sm">{copy.survivors.levelUpHint}</p>
      {choices.map((id, index) => {
        const info = copy.survivors.upgrades[id]
        const max = UPGRADES.find((u) => u.id === id)?.maxLevel ?? 1
        const owned = upgradeLevels[id]
        return (
          <motion.button
            key={id}
            type="button"
            onClick={() => onPick(index)}
            className="bg-surface rounded-card flex min-h-20 items-center gap-4 p-4 text-left shadow-lg"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring.gentle, delay: 0.08 * (index + 1) }}
            whileTap={{ scale: 0.97 }}
          >
            <span className="text-4xl" aria-hidden>
              {info.icon}
            </span>
            <span className="flex-1">
              <span className="block text-lg leading-tight font-bold">{info.name}</span>
              <span className="text-muted block text-sm leading-snug">{info.description}</span>
              <span
                className="mt-1.5 flex gap-1"
                aria-label={copy.survivors.upgradeLevel(owned + 1, max)}
              >
                {Array.from({ length: max }, (_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-5 rounded-full ${i < owned ? 'bg-brand' : i === owned ? 'bg-brand/40' : 'bg-track'}`}
                  />
                ))}
              </span>
            </span>
            <span className="text-muted hidden text-sm sm:block">{index + 1}</span>
          </motion.button>
        )
      })}
    </motion.div>
  )
}
