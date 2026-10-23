import { motion, useReducedMotion } from 'motion/react'
import { copy } from '@/copy'
import { spring } from '@/motion/presets'

interface LikeButtonProps {
  liked: boolean
  count: number
  disabled?: boolean
  onToggle: () => void
}

/** Corazón con contador: al dar like hace un pop. El like es anónimo, solo se ve la cantidad. */
export function LikeButton({ liked, count, disabled, onToggle }: LikeButtonProps) {
  const calm = useReducedMotion()
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={liked}
      aria-label={liked ? copy.community.unlikeAction : copy.community.likeAction}
      onClick={onToggle}
      className="text-muted flex min-h-11 items-center gap-1.5 rounded-full px-3 disabled:opacity-60"
    >
      <motion.svg
        viewBox="0 0 24 22"
        className="size-6"
        key={String(liked)}
        initial={calm ? false : { scale: 0.6 }}
        animate={{ scale: 1 }}
        transition={spring.bouncy}
        aria-hidden
      >
        <path
          d="M12 21 C4 14.5 1 10.5 1 6.8 C1 3.6 3.4 1.5 6.2 1.5 C8.6 1.5 10.7 2.9 12 5 C13.3 2.9 15.4 1.5 17.8 1.5 C20.6 1.5 23 3.6 23 6.8 C23 10.5 20 14.5 12 21 Z"
          fill={liked ? '#c8102e' : 'none'}
          stroke={liked ? '#c8102e' : 'currentColor'}
          strokeWidth="2"
        />
      </motion.svg>
      <span className={liked ? 'text-brand-ink font-bold' : 'font-semibold'}>{count}</span>
    </button>
  )
}
