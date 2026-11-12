// Tutorial corto e interactivo de "Miga Skate" (la primera vez). TypeScript puro: avanza con los eventos
// de la fisica, asi cada paso se cumple haciendo el gesto de verdad y no leyendo. Tres pasos:
// ollie, flip en el aire, catch. Se puede saltear en cualquier momento y se recuerda que ya se hizo.

import type { SkateEvent } from './skatePhysics.ts'

export type TutorialStep = 'ollie' | 'flip' | 'catch'

export const TUTORIAL_STEPS: readonly TutorialStep[] = ['ollie', 'flip', 'catch']

const STORAGE_KEY = 'migaskate.tutorial.v1'

/** Evento que completa cada paso. */
const COMPLETES: Record<TutorialStep, SkateEvent['t']> = {
  ollie: 'pop',
  flip: 'flip',
  catch: 'catch',
}

export function tutorialSeen(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function markTutorialSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, '1')
  } catch {
    // Sin almacenamiento: el tutorial simplemente puede repetirse.
  }
}

export class Tutorial {
  private index: number

  /** `done` = ya se hizo (o se salteo): no muestra nada. */
  constructor(done = false) {
    this.index = done ? TUTORIAL_STEPS.length : 0
  }

  get step(): TutorialStep | null {
    return TUTORIAL_STEPS[this.index] ?? null
  }

  get finished(): boolean {
    return this.index >= TUTORIAL_STEPS.length
  }

  /** Paso actual (0-based) y total, para la tirita de progreso. */
  get progress() {
    return { index: Math.min(this.index, TUTORIAL_STEPS.length), total: TUTORIAL_STEPS.length }
  }

  /** Avanza si el evento cumple el paso actual. Devuelve true si cambio de paso. */
  onEvent(e: { t: string }): boolean {
    const step = this.step
    if (!step || e.t !== COMPLETES[step]) return false
    this.index++
    if (this.finished) markTutorialSeen()
    return true
  }

  skip() {
    this.index = TUTORIAL_STEPS.length
    markTutorialSeen()
  }
}
