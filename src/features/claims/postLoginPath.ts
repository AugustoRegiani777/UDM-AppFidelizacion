import { readPendingSale, saleRoute } from './pendingSale'

/** A dónde ir una vez logueado y bienvenido: a la compra que quedó pendiente, o al panel. */
export function postLoginPath(): string {
  const pending = readPendingSale()
  return pending ? saleRoute(pending) : '/panel'
}
