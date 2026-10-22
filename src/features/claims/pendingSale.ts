const KEY = 'pending_sale_uuid'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isSaleUuid(value: string | undefined | null): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

/**
 * Guarda el uuid de la venta para sobrevivir al login (y a la bienvenida).
 * El uuid también viaja en la URL de retorno, así que si el almacenamiento está vacío
 * (ej. PWA de iPhone, que no comparte datos con Safari) no se pierde.
 */
export function savePendingSale(uuid: string): void {
  try {
    localStorage.setItem(KEY, uuid)
  } catch {
    // Modo privado o almacenamiento bloqueado: la URL sigue llevando el uuid.
  }
}

export function readPendingSale(): string | null {
  try {
    const value = localStorage.getItem(KEY)
    return isSaleUuid(value) ? value : null
  } catch {
    return null
  }
}

export function clearPendingSale(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nada que limpiar.
  }
}

export const saleRoute = (uuid: string) => `/s/${uuid}`
