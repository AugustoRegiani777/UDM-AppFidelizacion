import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { spring } from './presets'
import { PopupContext, type Popup } from './popupContext'

/**
 * Cola de popups: nunca dos a la vez y, como mucho, un popup espontáneo por sesión.
 * Todos se cierran con la X, tocando afuera o con Escape (docs/04).
 */
export function PopupQueueProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<Popup[]>([])
  const spontaneousShown = useRef(false)

  const show = useCallback((popup: Popup) => {
    if (popup.spontaneous) {
      if (spontaneousShown.current) return
      spontaneousShown.current = true
    }
    setQueue((current) => (current.some((p) => p.id === popup.id) ? current : [...current, popup]))
  }, [])

  const close = useCallback(() => setQueue((current) => current.slice(1)), [])
  const current = queue[0]

  return (
    <PopupContext value={{ show }}>
      {children}
      <AnimatePresence mode="wait">
        {current && (
          <PopupFrame key={current.id} onClose={close}>
            {current.render(close)}
          </PopupFrame>
        )}
      </AnimatePresence>
    </PopupContext>
  )
}

function PopupFrame({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      className="bg-ink/50 fixed inset-0 z-50 grid place-items-center p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        className="bg-surface rounded-card relative w-full max-w-sm p-6 text-center"
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={spring.bouncy}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="text-muted absolute top-2 right-2 grid size-12 place-items-center text-2xl"
        >
          ✕
        </button>
        {children}
      </motion.div>
    </motion.div>
  )
}
