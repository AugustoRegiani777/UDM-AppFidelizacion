import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { createQrDetector } from './qrDetector'

export type ScannerState = 'idle' | 'starting' | 'scanning' | 'denied' | 'unavailable'

const SCAN_INTERVAL_MS = 200

async function isCameraBlocked(): Promise<boolean> {
  try {
    const status = await navigator.permissions.query({ name: 'camera' as PermissionName })
    return status.state === 'denied'
  } catch {
    return false // Safari no soporta consultar el permiso de cámara.
  }
}

/**
 * Abre la cámara trasera y llama a `onText` con cada QR que lea hasta que devuelva true
 * (aceptado); ahí apaga la cámara. Limpia el stream al salir.
 */
export function useQrScanner(
  videoRef: RefObject<HTMLVideoElement | null>,
  onText: (text: string) => boolean,
) {
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const onTextRef = useRef(onText)
  const [state, setState] = useState<ScannerState>('idle')

  useEffect(() => {
    onTextRef.current = onText
  })

  const stop = useCallback(() => {
    window.clearTimeout(timerRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => stop, [stop])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setState('unavailable')
    setState('starting')
    if (await isCameraBlocked()) return setState('denied')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return stop()
      video.srcObject = stream
      await video.play()
      const detect = await createQrDetector()
      setState('scanning')

      const tick = async () => {
        if (!streamRef.current) return
        const text = document.hidden ? null : await detect(video).catch(() => null)
        if (text && onTextRef.current(text)) {
          stop()
          return
        }
        timerRef.current = window.setTimeout(tick, SCAN_INTERVAL_MS)
      }
      void tick()
    } catch (error) {
      stop()
      const name = error instanceof DOMException ? error.name : ''
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable')
    }
  }, [stop, videoRef])

  return { state, start }
}
