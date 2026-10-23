import { motion, useReducedMotion } from 'motion/react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/Button'
import type { UnlockedReward } from '@/features/claims/claimApi'
import { spring } from '@/motion/presets'
import { copy } from '@/copy'

/** Regalo que se abre: la tapa salta, un brillo dorado aparece y el botón late suave. */
function Gift() {
  const calm = useReducedMotion()
  return (
    <svg viewBox="0 0 120 110" className="mx-auto size-32" aria-hidden>
      <motion.circle
        cx="60"
        cy="62"
        r="46"
        fill="#d9962b"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 0.25, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        style={{ transformOrigin: '60px 62px' }}
      />
      <rect x="22" y="52" width="76" height="48" rx="6" fill="#c8102e" />
      <rect x="56" y="52" width="8" height="48" fill="#faf3e3" />
      <motion.g
        initial={{ y: 0, rotate: 0 }}
        animate={{ y: -16, rotate: -14 }}
        transition={{ ...spring.bouncy, delay: calm ? 0 : 0.25 }}
        style={{ transformOrigin: '30px 46px' }}
      >
        <rect x="16" y="38" width="88" height="16" rx="5" fill="#9c0c23" />
        <rect x="56" y="38" width="8" height="16" fill="#faf3e3" />
      </motion.g>
    </svg>
  )
}

/** Popup "premio desbloqueado": se abre solo tras una compra (no es espontáneo) y se cierra fácil. */
export function RewardUnlockedPopup({
  reward,
  onClose,
}: {
  reward: UnlockedReward
  onClose: () => void
}) {
  const navigate = useNavigate()
  const calm = useReducedMotion()

  return (
    <div className="flex flex-col gap-3">
      <Gift />
      <h2 className="font-display text-4xl leading-none">{copy.sale.unlocked(reward.name)}</h2>
      <motion.div
        animate={calm ? undefined : { scale: [1, 1.04, 1] }}
        transition={{ duration: 1.8, repeat: Infinity }}
      >
        <Button
          onClick={() => {
            onClose()
            navigate(`/cofre/${reward.id}`)
          }}
        >
          {copy.chest.cta}
        </Button>
      </motion.div>
      <Button variant="ghost" onClick={onClose}>
        {copy.sale.later}
      </Button>
    </div>
  )
}
