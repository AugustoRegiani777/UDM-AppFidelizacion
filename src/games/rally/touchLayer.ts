// Rally de Cocina: capa táctil (celular en horizontal). A la izquierda la cruceta de 4 botones;
// a la derecha, "usar ítem" y freno de mano. Cada dedo es un puntero: se pueden apretar varios a la vez.
import {
  TouchModel,
  hitTest,
  type PadButton,
  type Rect,
  type TouchButton,
  type TouchState,
} from './touchModel.ts'

export interface TouchLabels {
  up: string
  down: string
  left: string
  right: string
  item: string
  handbrake: string
  itemEmpty: string
  itemRolling: string
}

export interface TouchLayerOptions {
  labels: TouchLabels
  /** Se llama cuando un dedo apoya directamente sobre un botón (para "usar ítem"). */
  onPress?: (button: TouchButton) => void
}

export interface TouchLayer {
  el: HTMLElement
  model: TouchModel
  state(): TouchState
  /** Suelta todos los dedos (pérdida de foco, pausa, etc.). */
  release(): void
  setVisible(visible: boolean): void
  /** Ícono (SVG) del ítem actual, o null si no hay. `rolling` mientras se sortea. */
  setItem(iconSvg: string | null, name: string, rolling: boolean): void
  dispose(): void
}

const ARROWS: Record<PadButton, string> = {
  up: '<path d="M12 5 4.5 15h15z"/>',
  down: '<path d="M12 19 4.5 9h15z"/>',
  left: '<path d="M5 12 15 4.5v15z"/>',
  right: '<path d="M19 12 9 4.5v15z"/>',
}
const arrow = (id: PadButton) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${ARROWS[id]}</svg>`

const HANDBRAKE_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="7.5"/><path d="M12 8v4.6M12 15.6v.1"/><path d="M3.5 7.5a10 10 0 0 0 0 9M20.5 7.5a10 10 0 0 1 0 9"/></svg>'

function makeButton(id: TouchButton, label: string, html: string, cls: string) {
  const b = document.createElement('button')
  b.type = 'button'
  b.tabIndex = -1
  b.className = `rdc-tb ${cls}`
  b.dataset.btn = id
  b.setAttribute('data-testid', `rally-btn-${id}`)
  b.setAttribute('aria-label', label)
  b.innerHTML = html
  return b
}

export function createTouchLayer(parent: HTMLElement, options: TouchLayerOptions): TouchLayer {
  const { labels } = options
  const model = new TouchModel(options.onPress)

  const root = document.createElement('div')
  root.className = 'rdc-touch'
  root.dataset.r = 'touch'
  root.setAttribute('data-testid', 'rally-touch')

  const pad = document.createElement('div')
  pad.className = 'rdc-pad'
  pad.setAttribute('role', 'group')
  pad.setAttribute('aria-label', 'Cruceta')
  const buttons: Partial<Record<TouchButton, HTMLButtonElement>> = {}
  const padIds: PadButton[] = ['up', 'left', 'right', 'down']
  for (const id of padIds) {
    const b = makeButton(id, labels[id], arrow(id), `rdc-tb-${id}`)
    buttons[id] = b
    pad.appendChild(b)
  }

  const actions = document.createElement('div')
  actions.className = 'rdc-actions'
  actions.setAttribute('role', 'group')
  const handbrake = makeButton(
    'handbrake',
    labels.handbrake,
    `${HANDBRAKE_ICON}<span class="rdc-tb-cap">${labels.handbrake}</span>`,
    'rdc-tb-handbrake',
  )
  const item = makeButton(
    'item',
    labels.item,
    `<span class="rdc-tb-icon" data-r="item-icon"></span><span class="rdc-tb-cap" data-r="item-cap">${labels.itemEmpty}</span>`,
    'rdc-tb-item',
  )
  buttons.handbrake = handbrake
  buttons.item = item
  actions.append(handbrake, item)
  root.append(pad, actions)
  parent.appendChild(root)

  const itemIcon = item.querySelector<HTMLElement>('[data-r="item-icon"]')!
  const itemCap = item.querySelector<HTMLElement>('[data-r="item-cap"]')!

  const rectsOf = (ids: TouchButton[]) => {
    const rects: Partial<Record<TouchButton, Rect>> = {}
    for (const id of ids) {
      const r = buttons[id]!.getBoundingClientRect()
      rects[id] = { left: r.left, top: r.top, right: r.right, bottom: r.bottom }
    }
    return rects
  }

  const paint = () => {
    const pressed = model.pressed()
    for (const id of Object.keys(buttons) as TouchButton[]) {
      const on = pressed.has(id)
      const b = buttons[id]!
      if (b.dataset.pressed !== String(on)) b.dataset.pressed = String(on)
    }
  }

  const cleanups: (() => void)[] = []
  const bindGroup = (group: HTMLElement, ids: TouchButton[]) => {
    const hit = (e: PointerEvent) => hitTest(rectsOf(ids), e.clientX, e.clientY, 12)
    const onDown = (e: PointerEvent) => {
      e.preventDefault()
      try {
        group.setPointerCapture?.(e.pointerId)
      } catch {
        // Puntero sintético o ya soltado: el seguimiento por posición sigue funcionando.
      }
      model.down(e.pointerId, hit(e))
      paint()
    }
    const onMove = (e: PointerEvent) => {
      if (!model.has(e.pointerId)) return
      e.preventDefault()
      model.move(e.pointerId, hit(e))
      paint()
    }
    const onEnd = (e: PointerEvent) => {
      model.up(e.pointerId)
      paint()
    }
    group.addEventListener('pointerdown', onDown)
    group.addEventListener('pointermove', onMove)
    group.addEventListener('pointerup', onEnd)
    group.addEventListener('pointercancel', onEnd)
    group.addEventListener('lostpointercapture', onEnd)
    cleanups.push(() => {
      group.removeEventListener('pointerdown', onDown)
      group.removeEventListener('pointermove', onMove)
      group.removeEventListener('pointerup', onEnd)
      group.removeEventListener('pointercancel', onEnd)
      group.removeEventListener('lostpointercapture', onEnd)
    })
  }
  bindGroup(pad, padIds)
  bindGroup(actions, ['handbrake', 'item'])

  // Sin menú contextual ni selección por toques largos.
  const noMenu = (e: Event) => e.preventDefault()
  root.addEventListener('contextmenu', noMenu)
  root.addEventListener('selectstart', noMenu)
  cleanups.push(() => {
    root.removeEventListener('contextmenu', noMenu)
    root.removeEventListener('selectstart', noMenu)
  })

  let lastItemKey = ''
  return {
    el: root,
    model,
    state: () => model.state(),
    release() {
      model.clear()
      paint()
    },
    setVisible(visible) {
      root.hidden = !visible
      if (!visible) this.release()
    },
    setItem(iconSvg, name, rolling) {
      const key = `${rolling ? 'r' : ''}|${name}|${iconSvg ? 1 : 0}`
      const full = `${key}|${iconSvg ?? ''}`
      if (full === lastItemKey) return
      lastItemKey = full
      itemIcon.innerHTML = iconSvg ?? ''
      itemCap.textContent = rolling ? labels.itemRolling : iconSvg ? name : labels.itemEmpty
      item.dataset.full = String(!!iconSvg && !rolling)
      item.dataset.item = iconSvg && !rolling ? name : ''
    },
    dispose() {
      cleanups.forEach((fn) => fn())
      model.clear()
      root.remove()
    },
  }
}

export const TOUCH_CSS = `
.rdc .rdc-touch{position:absolute;inset:0;pointer-events:none;z-index:6;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none}
.rdc .rdc-touch[hidden]{display:none}
.rdc .rdc-pad,.rdc .rdc-actions{position:absolute;pointer-events:auto;touch-action:none;bottom:calc(12px + env(safe-area-inset-bottom,0px))}
.rdc .rdc-pad{left:calc(14px + env(safe-area-inset-left,0px));display:grid;grid-template-columns:repeat(3,var(--rdc-btn));grid-template-rows:repeat(3,var(--rdc-btn));gap:6px}
.rdc .rdc-actions{right:calc(14px + env(safe-area-inset-right,0px));display:flex;align-items:flex-end;gap:14px}
.rdc .rdc-tb{display:grid;place-items:center;align-content:center;gap:2px;padding:0;margin:0;color:#fff;background:rgba(13,19,48,.34);border:3px solid rgba(255,255,255,.4);border-radius:18px;font-family:var(--f-data);font-weight:700;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;transition:transform .06s,background-color .06s}
.rdc .rdc-tb svg{width:46%;height:46%;display:block;filter:drop-shadow(0 2px 0 rgba(13,19,48,.55));pointer-events:none}
.rdc .rdc-tb[data-pressed="true"]{background:rgba(255,210,63,.6);border-color:rgba(255,255,255,.85);color:var(--ink);transform:scale(.94)}
.rdc .rdc-tb-up{grid-column:2;grid-row:1}
.rdc .rdc-tb-left{grid-column:1;grid-row:2}
.rdc .rdc-tb-right{grid-column:3;grid-row:2}
.rdc .rdc-tb-down{grid-column:2;grid-row:3}
.rdc .rdc-tb-handbrake,.rdc .rdc-tb-item{flex-direction:column}
.rdc .rdc-tb-handbrake{width:var(--rdc-btn);height:var(--rdc-btn);border-radius:50%}
.rdc .rdc-tb-handbrake svg{width:44%;height:44%}
.rdc .rdc-tb-item{width:calc(var(--rdc-btn) * 1.28);height:calc(var(--rdc-btn) * 1.28);border-radius:22px}
.rdc .rdc-tb-item[data-full="true"]{background:rgba(255,210,63,.3);border-color:var(--sun)}
.rdc .rdc-tb-item[data-full="true"][data-pressed="true"]{background:rgba(255,210,63,.7)}
.rdc .rdc-tb-icon{display:grid;place-items:center;width:100%;height:46%}
.rdc .rdc-tb-icon svg{width:auto;height:100%;aspect-ratio:1}
.rdc .rdc-tb-cap{font-size:10px;letter-spacing:.08em;text-transform:uppercase;line-height:1.1;text-shadow:0 1px 0 rgba(13,19,48,.6);pointer-events:none;text-align:center;max-width:100%}
.rdc .rdc-tb-item:not([data-full="true"]) .rdc-tb-icon{border:3px dashed rgba(255,255,255,.35);border-radius:50%;width:38%;height:38%;opacity:.8}
`
