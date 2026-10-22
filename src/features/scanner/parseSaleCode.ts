import { isSaleUuid } from '@/features/claims/pendingSale'

const SALE_PATH_RE = /\/s\/([0-9a-f-]{36})(?:[/?#]|$)/i

/**
 * Saca el uuid de una venta de lo que leyó la cámara o escribió el cliente:
 * el link completo `{APP_URL}/s/{uuid}` o el uuid suelto. Devuelve null si no es una venta.
 * Solo se usa el uuid: el servidor decide todo lo demás (regla de oro 2).
 */
export function parseSaleCode(raw: string): string | null {
  const text = raw.trim()
  if (isSaleUuid(text)) return text.toLowerCase()
  const match = SALE_PATH_RE.exec(text)
  const candidate = match?.[1]
  return isSaleUuid(candidate) ? candidate.toLowerCase() : null
}
