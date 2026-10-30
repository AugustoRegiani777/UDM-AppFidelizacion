// Actualización de la app instalada (service worker). Lógica pura y testeable:
// - Cuando el service worker detecta una versión nueva, se avisa con `updateAvailable()`.
// - Si no hay nada importante en pantalla, se aplica enseguida (recarga segura).
// - Si hay un juego, el escáner o similar, se espera: se muestra un aviso discreto y se aplica
//   apenas la pantalla queda libre, o cuando la persona toca "Actualizar".

export interface UpdateState {
  /** Hay una versión nueva descargada esperando. */
  pending: boolean
  /** Hay algo en pantalla que no conviene interrumpir. */
  busy: boolean
}

type Listener = () => void

let applyFn: (() => void) | null = null
let pending = false
let busyCount = 0
let snapshot: UpdateState = { pending, busy: false }
const listeners = new Set<Listener>()

function emit() {
  const next = { pending, busy: busyCount > 0 }
  if (next.pending === snapshot.pending && next.busy === snapshot.busy) return
  snapshot = next
  listeners.forEach((l) => l())
}

function maybeApply() {
  if (pending && busyCount === 0 && applyFn) {
    const apply = applyFn
    pending = false
    emit()
    apply()
  }
}

/** Qué hace "aplicar": normalmente activa el service worker nuevo y recarga la página. */
export function setApplyUpdate(fn: (() => void) | null) {
  applyFn = fn
}

/** El service worker avisa que hay una versión nueva lista. */
export function updateAvailable() {
  pending = true
  emit()
  maybeApply()
}

/** Marca una pantalla como "ocupada" (un juego en curso). Devuelve la función que la libera. */
export function holdUpdates(): () => void {
  busyCount += 1
  emit()
  let released = false
  return () => {
    if (released) return
    released = true
    busyCount = Math.max(0, busyCount - 1)
    emit()
    maybeApply()
  }
}

/** Aplicar ya, aunque haya algo en pantalla (lo pide la persona con el botón). */
export function applyNow() {
  if (!pending || !applyFn) return
  const apply = applyFn
  pending = false
  emit()
  apply()
}

export function subscribeUpdate(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getUpdateState(): UpdateState {
  return snapshot
}

/** Solo para tests. */
export function resetUpdateGate() {
  applyFn = null
  pending = false
  busyCount = 0
  snapshot = { pending: false, busy: false }
  listeners.clear()
}

/** Rutas donde una recarga arruinaría lo que la persona está haciendo (cámara, raspadita, cofre…). */
const BUSY_PATHS = ['/escanear', '/ruleta', '/raspadita', '/cofre', '/canje']

export function isBusyPath(pathname: string): boolean {
  return BUSY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}
