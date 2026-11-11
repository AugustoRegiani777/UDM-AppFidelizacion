import { useEffect, useRef, useState } from 'react'
import { copy } from '@/copy'
import { isSoundEnabled, setSoundEnabled } from '@/motion/preferences'
import { usePortrait } from '../shared/landscape.ts'
import type { RallyGame as RallyHandle } from './rallyEngine.ts'

/**
 * Rally de Cocina a pantalla completa. El juego (three.js, menús, HUD) vive en su propio paquete y se
 * monta acá dentro; al desmontar se libera todo (también con StrictMode, que monta dos veces).
 */
export function RallyGame({ onExit }: { onExit: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const handleRef = useRef<RallyHandle | null>(null)
  const exitRef = useRef(onExit)
  const [loading, setLoading] = useState(true)
  const [touch, setTouch] = useState(false)
  const portrait = usePortrait()

  useEffect(() => {
    exitRef.current = onExit
  })

  useEffect(() => {
    let cancelled = false
    let created: RallyHandle | null = null
    const container = containerRef.current!
    void import('./rallyEngine.ts').then(({ createRallyGame }) => {
      if (cancelled) return
      created = createRallyGame(container, {
        onExit: () => exitRef.current(),
        getSound: isSoundEnabled,
        setSound: setSoundEnabled,
      })
      handleRef.current = created
      setTouch(created.touch)
      setLoading(false)
    })
    return () => {
      cancelled = true
      created?.dispose()
      handleRef.current = null
    }
  }, [])

  const blocked = touch && portrait
  useEffect(() => {
    if (blocked) handleRef.current?.pause()
  }, [blocked])

  return (
    <div
      ref={containerRef}
      className="bg-ink fixed inset-0 touch-none overflow-hidden select-none"
      data-testid="rally-container"
    >
      {loading && (
        <div className="bg-ink absolute inset-0 z-20 grid place-items-center">
          <p className="font-display text-bg text-3xl" role="status">
            {copy.rally.loading}
          </p>
        </div>
      )}
      {blocked && (
        <div
          className="bg-ink absolute inset-0 z-50 grid place-items-center p-8 text-center"
          role="alert"
          data-testid="rally-rotate"
        >
          <div className="flex flex-col items-center gap-4">
            <span className="text-7xl" aria-hidden>
              📱
            </span>
            <h2 className="font-display text-bg text-5xl leading-none">{copy.rally.rotateTitle}</h2>
            <p className="text-bg/80">{copy.rally.rotateBody}</p>
            <button type="button" onClick={onExit} className="text-bg/80 min-h-12 underline">
              {copy.rally.exit}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
