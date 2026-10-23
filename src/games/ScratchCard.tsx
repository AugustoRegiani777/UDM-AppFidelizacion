import { animate, useMotionValue, useReducedMotion } from 'motion/react'
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { copy } from '@/copy'

const BRUSH = 40
const REVEAL_RATIO = 0.5
const SAMPLE_STEP = 10

interface ScratchCardProps {
  /** Lo que hay debajo de la capa (el premio, ya decidido por el servidor). */
  children: ReactNode
  onRevealed: () => void
}

function paintCoating(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
  gradient.addColorStop(0, '#c8102e')
  gradient.addColorStop(1, '#9c0c23')
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = 'rgba(250,243,227,0.9)'
  context.font = `${Math.round(canvas.width / 9)}px "Bebas Neue", sans-serif`
  context.textAlign = 'center'
  context.fillText(copy.games.scratchHere, canvas.width / 2, canvas.height / 2)
}

function clearedRatio(canvas: HTMLCanvasElement): number {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return 0
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
  let cleared = 0
  let total = 0
  for (let y = 0; y < height; y += SAMPLE_STEP) {
    for (let x = 0; x < width; x += SAMPLE_STEP) {
      total++
      if ((data[(y * width + x) * 4 + 3] ?? 255) < 128) cleared++
    }
  }
  return total ? cleared / total : 0
}

/** Capa que se raspa con el dedo (canvas). Al despejar la mitad se revela sola. También hay botón para quien no pueda raspar. */
export function ScratchCard({ children, onRevealed }: ScratchCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const [revealed, setRevealed] = useState(false)
  const calm = useReducedMotion()
  const coatingOpacity = useMotionValue(1)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = canvas.clientWidth * ratio
    canvas.height = canvas.clientHeight * ratio
    paintCoating(canvas)
  }, [])

  const reveal = useCallback(() => {
    setRevealed(true)
    const finish = () => onRevealed()
    if (calm) {
      coatingOpacity.set(0)
      finish()
    } else {
      animate(coatingOpacity, 0, { duration: 0.4 }).then(finish)
    }
  }, [calm, coatingOpacity, onRevealed])

  function scratchTo(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const rect = canvas.getBoundingClientRect()
    const scale = canvas.width / rect.width
    const point = { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale }
    context.globalCompositeOperation = 'destination-out'
    context.lineWidth = BRUSH * scale
    context.lineCap = 'round'
    context.beginPath()
    context.moveTo(lastPoint.current?.x ?? point.x, lastPoint.current?.y ?? point.y)
    context.lineTo(point.x, point.y)
    context.stroke()
    lastPoint.current = point
  }

  /** Seguir el dedo aunque salga del canvas. Es opcional: si el navegador no puede, se raspa igual. */
  function capturePointer(event: PointerEvent<HTMLCanvasElement>) {
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // sin captura de puntero
    }
  }

  function endScratch() {
    drawing.current = false
    lastPoint.current = null
    const canvas = canvasRef.current
    if (canvas && !revealed && clearedRatio(canvas) >= REVEAL_RATIO) reveal()
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-card relative aspect-[3/2] w-full overflow-hidden bg-surface">
        <div className="absolute inset-0 grid place-items-center">{children}</div>
        <motion.canvas
          ref={canvasRef}
          aria-hidden
          data-testid="scratch-canvas"
          className="absolute inset-0 size-full touch-none"
          style={{ opacity: coatingOpacity, pointerEvents: revealed ? 'none' : 'auto' }}
          onPointerDown={(event) => {
            drawing.current = true
            capturePointer(event)
            scratchTo(event)
          }}
          onPointerMove={(event) => drawing.current && scratchTo(event)}
          onPointerUp={endScratch}
          onPointerCancel={endScratch}
        />
      </div>
      {!revealed && (
        <button type="button" onClick={reveal} className="text-muted min-h-12 text-sm underline">
          {copy.games.revealButton}
        </button>
      )}
    </div>
  )
}
