import { registerSW } from 'virtual:pwa-register'
import { isBusyPath, setApplyUpdate, updateAvailable, holdUpdates } from './updateGate'

const CHECK_EVERY_MS = 30 * 60 * 1000

/**
 * Registra el service worker y busca versiones nuevas: al abrir la app, al volver a ella desde
 * segundo plano y cada 30 minutos. La versión nueva se descarga sola; recién se recarga cuando
 * no hay un juego (ni el escáner) en pantalla.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateAvailable()
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return
      const check = () => {
        if (navigator.onLine) void registration.update().catch(() => {})
      }
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') check()
      })
      window.setInterval(check, CHECK_EVERY_MS)
    },
  })
  setApplyUpdate(() => void updateSW(true))

  // Rutas sensibles (escáner, raspadita…): la recarga espera a que se salga de ahí.
  let release: (() => void) | null = null
  const sync = () => {
    const busy = isBusyPath(window.location.pathname)
    if (busy && !release) release = holdUpdates()
    if (!busy && release) {
      release()
      release = null
    }
  }
  sync()
  window.setInterval(sync, 1000)
}
