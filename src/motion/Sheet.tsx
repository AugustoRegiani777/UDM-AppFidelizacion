import { AnimatePresence, motion } from 'motion/react'
import { useEffect, type ReactNode } from 'react'
import { spring } from './presets'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

const CLOSE_DISTANCE = 120

/** Bottom sheet: se cierra arrastrando hacia abajo, tocando afuera, con la X o con Escape. */
export function Sheet({ open, onClose, title, children }: SheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="bg-ink/50 fixed inset-0 z-40 flex items-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="bg-surface mx-auto w-full max-w-md rounded-t-[var(--radius-card)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring.snappy}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => info.offset.y > CLOSE_DISTANCE && onClose()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bg-track mx-auto mb-3 h-1.5 w-10 rounded-full" aria-hidden />
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-3xl">{title}</h2>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={onClose}
                className="text-muted grid size-12 place-items-center text-2xl"
              >
                ✕
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
