// Rally de Cocina: entrada del jugador. Teclado, joystick (Gamepad) y capa táctil se mezclan en un solo Control.
import { clamp, type Control } from './data.ts'
import { EMPTY_TOUCH, type TouchState } from './touchModel.ts'

/** Lo mínimo que se necesita de un joystick (botones por índice, ejes). */
export interface PadSnapshot {
  axes: readonly number[]
  buttons: readonly { pressed: boolean; value: number }[]
}

/** Mezcla teclado, joystick y táctil. Lo que más acelera/frena gana; la dirección táctil pisa a la del teclado. */
export function combineInput(
  keys: ReadonlySet<string>,
  pad: PadSnapshot | null,
  touch: TouchState = EMPTY_TOUCH,
): Control {
  const k = (c: string) => keys.has(c)
  let throttle = k('ArrowUp') || k('KeyW') ? 1 : 0
  let brake = k('ArrowDown') || k('KeyS') ? 1 : 0
  let steer = (k('ArrowLeft') || k('KeyA') ? 1 : 0) - (k('ArrowRight') || k('KeyD') ? 1 : 0)
  let handbrake = k('ShiftLeft') || k('ShiftRight')
  if (pad) {
    const ax = pad.axes[0] || 0
    if (Math.abs(ax) > 0.15) steer = -ax
    const bv = (i: number) => {
      const b = pad.buttons[i]
      return b ? b.value || (b.pressed ? 1 : 0) : 0
    }
    throttle = Math.max(throttle, bv(7), bv(0))
    brake = Math.max(brake, bv(6))
    handbrake = handbrake || bv(1) > 0.5 || bv(5) > 0.5
  }
  throttle = Math.max(throttle, touch.throttle)
  brake = Math.max(brake, touch.brake)
  if (touch.steer !== 0) steer = touch.steer
  handbrake = handbrake || touch.handbrake
  return { throttle: clamp(throttle, 0, 1), brake: clamp(brake, 0, 1), steer, handbrake }
}

export interface InputActions {
  useItem(): void
  reset(): void
  togglePause(): void
  toggleCamera(): void
  toggleMute(): void
  toggleFullscreen(): void
  /** Enter en el menú. */
  enter(e: KeyboardEvent): void
  /** Hay que frenar el scroll de las flechas y el espacio (todo menos en el menú). */
  capturesArrows(): boolean
  /** La ventana pierde el foco o la pestaña se oculta. */
  lostFocus(): void
}

export interface RallyInput {
  /** Lee el estado de este cuadro (y dispara los botones de un solo toque del joystick). */
  read(touch: TouchState): Control
  clear(): void
  dispose(): void
}

export function createInput(actions: InputActions): RallyInput {
  const keys = new Set<string>()
  let padPrev: boolean[] = []

  const onKeyDown = (e: KeyboardEvent) => {
    const c = e.code
    if (
      actions.capturesArrows() &&
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(c)
    )
      e.preventDefault()
    keys.add(c)
    if (e.repeat) return
    if (c === 'Space') actions.useItem()
    else if (c === 'KeyR') actions.reset()
    else if (c === 'KeyC') actions.toggleCamera()
    else if (c === 'KeyP' || c === 'Escape') actions.togglePause()
    else if (c === 'KeyM') actions.toggleMute()
    else if (c === 'KeyF') actions.toggleFullscreen()
    else if (c === 'Enter') actions.enter(e)
  }
  const onKeyUp = (e: KeyboardEvent) => {
    keys.delete(e.code)
  }
  const onBlur = () => {
    keys.clear()
    actions.lostFocus()
  }
  const onVisibility = () => {
    if (document.hidden) {
      keys.clear()
      actions.lostFocus()
    }
  }
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibility)

  return {
    read(touch) {
      const pads = navigator.getGamepads ? navigator.getGamepads() : []
      const gp = pads && [...pads].find((p) => p)
      if (gp) {
        const bv = (i: number) => {
          const b = gp.buttons[i]
          return b ? b.value || (b.pressed ? 1 : 0) : 0
        }
        const pressed = (i: number) => bv(i) > 0.5 && !padPrev[i]
        if (pressed(2)) actions.useItem()
        if (pressed(3)) actions.reset()
        if (pressed(9)) actions.togglePause()
        padPrev = gp.buttons.map((b) => b.pressed)
      }
      return combineInput(keys, gp ?? null, touch)
    },
    clear() {
      keys.clear()
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}
