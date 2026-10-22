import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import QRCode from 'qrcode'

const WIDTH = 640
const HEIGHT = 480
const FRAMES = 15
const QUIET_ZONE = 4

/**
 * Genera un video Y4M de un QR fijo para la cámara falsa de Chromium
 * (`--use-file-for-fake-video-capture`). Así se prueba el escáner de punta a punta sin celular.
 */
export function writeQrVideo(path: string, text: string): void {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const modules = qr.modules.size + QUIET_ZONE * 2
  const cell = Math.floor(Math.min(WIDTH, HEIGHT) / modules)
  const offsetX = Math.floor((WIDTH - modules * cell) / 2)
  const offsetY = Math.floor((HEIGHT - modules * cell) / 2)

  const luma = Buffer.alloc(WIDTH * HEIGHT, 255)
  for (let row = 0; row < qr.modules.size; row++) {
    for (let col = 0; col < qr.modules.size; col++) {
      if (!qr.modules.get(row, col)) continue
      for (let y = 0; y < cell; y++) {
        const start =
          (offsetY + (row + QUIET_ZONE) * cell + y) * WIDTH + offsetX + (col + QUIET_ZONE) * cell
        luma.fill(0, start, start + cell)
      }
    }
  }
  const chroma = Buffer.alloc((WIDTH / 2) * (HEIGHT / 2), 128)

  const header = Buffer.from(`YUV4MPEG2 W${WIDTH} H${HEIGHT} F30:1 Ip A1:1 C420jpeg\n`)
  const frame = Buffer.concat([Buffer.from('FRAME\n'), luma, chroma, chroma])
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, Buffer.concat([header, ...Array.from({ length: FRAMES }, () => frame)]))
}
