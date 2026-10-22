// Minimal typing de la API BarcodeDetector (todavía no está en lib.dom de TypeScript).
interface DetectedBarcode {
  rawValue: string
}
interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>
}
interface BarcodeDetectorConstructor {
  new (options?: { formats?: string[] }): BarcodeDetectorInstance
  getSupportedFormats?(): Promise<string[]>
}

export type QrDetector = (video: HTMLVideoElement) => Promise<string | null>

const FALLBACK_MAX_SIDE = 480

async function nativeDetector(): Promise<QrDetector | null> {
  const Native = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor })
    .BarcodeDetector
  if (!Native) return null
  const formats = (await Native.getSupportedFormats?.()) ?? ['qr_code']
  if (!formats.includes('qr_code')) return null
  const detector = new Native({ formats: ['qr_code'] })
  return async (video) => (await detector.detect(video))[0]?.rawValue ?? null
}

/** jsQR (liviana, se descarga solo si el navegador no trae BarcodeDetector, ej. Safari/Firefox). */
async function jsQrDetector(): Promise<QrDetector> {
  const { default: jsQR } = await import('jsqr')
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  return async (video) => {
    if (!context || !video.videoWidth) return null
    const scale = Math.min(1, FALLBACK_MAX_SIDE / Math.max(video.videoWidth, video.videoHeight))
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const image = context.getImageData(0, 0, canvas.width, canvas.height)
    return jsQR(image.data, image.width, image.height)?.data ?? null
  }
}

export async function createQrDetector(): Promise<QrDetector> {
  return (await nativeDetector()) ?? (await jsQrDetector())
}
