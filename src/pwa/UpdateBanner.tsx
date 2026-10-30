import { useSyncExternalStore } from 'react'
import { copy } from '@/copy'
import { applyNow, getUpdateState, subscribeUpdate } from './updateGate'

/** Aviso discreto de versión nueva: solo aparece si hay algo en pantalla que no se debe interrumpir. */
export function UpdateBanner() {
  const state = useSyncExternalStore(subscribeUpdate, getUpdateState, getUpdateState)
  if (!state.pending) return null
  return (
    <div
      role="status"
      className="bg-ink text-bg fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm shadow-lg"
    >
      <span>{copy.pwa.newVersion}</span>
      <button type="button" onClick={applyNow} className="min-h-11 px-2 font-bold underline">
        {copy.pwa.update}
      </button>
    </div>
  )
}
