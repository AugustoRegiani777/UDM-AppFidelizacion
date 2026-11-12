// Rally de Cocina: capa táctil (celular en horizontal).
// Dos esquemas (ver touchModel.ts): "Un pulgar" (mitad izquierda = pedales por altura + dirección por
// desplazamiento; derecha = ítem y freno de mano) y "Dos pulgares" (izquierda = dirección; derecha = pedales;
// ítem y freno de mano en una columna sobre el borde derecho). Pointer Events con captura y multitouch real.
import { copy } from '@/copy'
import { store } from './data.ts'
import {
  DEFAULT_PAD_CONFIG,
  PEDAL_SPLIT,
  TouchControls,
  type ActionButton,
  type Scheme,
  type TouchButton,
  type TouchState,
} from './touchModel.ts'

export interface TouchLabels {
  item: string
  handbrake: string
  itemEmpty: string
  itemRolling: string
  gas: string
  brake: string
  steer: string
}

/** Ajustes del control táctil (se guardan en el celular). */
export interface TouchPrefs {
  scheme: Scheme
  sensitivity: number
}
export const SENSITIVITIES = { soft: 0.75, normal: 1, high: 1.3 } as const
export const DEFAULT_PREFS: TouchPrefs = {
  scheme: DEFAULT_PAD_CONFIG.scheme,
  sensitivity: DEFAULT_PAD_CONFIG.sensitivity,
}

export function loadTouchPrefs(): TouchPrefs {
  const scheme = store.get<string>('scheme', DEFAULT_PREFS.scheme)
  const sens = store.get<number>('sens', DEFAULT_PREFS.sensitivity)
  const known = Object.values(SENSITIVITIES) as number[]
  return {
    scheme: scheme === 'two' ? 'two' : 'one',
    sensitivity: known.includes(sens) ? sens : DEFAULT_PREFS.sensitivity,
  }
}

export interface TouchLayerOptions {
  labels: TouchLabels
  prefs?: TouchPrefs
  /** Se llama cuando un dedo apoya directamente sobre un botón (para "usar ítem"). */
  onPress?: (button: TouchButton) => void
}

export interface TouchLayer {
  el: HTMLElement
  controls: TouchControls
  /** Lo que piden los pulgares este cuadro. `dt` avanza la rampa del giro. */
  state(dt?: number): TouchState
  /** Suelta todos los dedos (pérdida de foco, pausa, etc.). */
  release(): void
  setVisible(visible: boolean): void
  setPrefs(prefs: TouchPrefs): void
  /** Ícono (SVG) del ítem actual, o null si no hay. `rolling` mientras se sortea. */
  setItem(iconSvg: string | null, name: string, rolling: boolean): void
  dispose(): void
}

const HANDBRAKE_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="7.5"/><path d="M12 8v4.6M12 15.6v.1"/><path d="M3.5 7.5a10 10 0 0 0 0 9M20.5 7.5a10 10 0 0 1 0 9"/></svg>'
const ARROW_L =
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M4.5 12 15.5 4v16z"/></svg>'
const ARROW_R =
  '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M19.5 12 8.5 4v16z"/></svg>'

function makeButton(id: ActionButton, label: string, html: string) {
  const b = document.createElement('button')
  b.type = 'button'
  b.tabIndex = -1
  b.className = `rdc-tb rdc-tb-${id}`
  b.dataset.btn = id
  b.setAttribute('data-testid', `rally-btn-${id}`)
  b.setAttribute('aria-label', label)
  b.innerHTML = html
  return b
}

const buzz = (ms: number) => {
  try {
    navigator.vibrate?.(ms)
  } catch {
    // Sin vibración (iOS, escritorio): no pasa nada.
  }
}

/** Guía de pedales: dos mitades (acelerar arriba, frenar abajo) con la línea de división. */
const pedalsHtml = (labels: TouchLabels) =>
  `<div class="rdc-pedals" aria-hidden="true" style="--split:${PEDAL_SPLIT * 100}%"><div class="rdc-gas"><span>${labels.gas}</span></div><div class="rdc-brk"><span>${labels.brake}</span></div></div>`

export function createTouchLayer(parent: HTMLElement, options: TouchLayerOptions): TouchLayer {
  const { labels } = options
  const prefs = options.prefs ?? DEFAULT_PREFS
  const controls = new TouchControls(
    { scheme: prefs.scheme, sensitivity: prefs.sensitivity },
    (b) => {
      buzz(14)
      options.onPress?.(b)
    },
  )

  const root = document.createElement('div')
  root.className = 'rdc-touch'
  root.dataset.r = 'touch'
  root.dataset.scheme = prefs.scheme
  root.dataset.pedal = 'none'
  root.setAttribute('data-testid', 'rally-touch')

  const zoneL = document.createElement('div')
  zoneL.className = 'rdc-zone rdc-zone-l'
  zoneL.setAttribute('data-testid', 'rally-zone-left')
  zoneL.innerHTML = `${pedalsHtml(labels)}<div class="rdc-hint" aria-hidden="true">${ARROW_L}<b>${labels.steer}</b>${ARROW_R}</div>`
  const zoneR = document.createElement('div')
  zoneR.className = 'rdc-zone rdc-zone-r'
  zoneR.setAttribute('data-testid', 'rally-zone-right')
  zoneR.innerHTML = pedalsHtml(labels)

  // Indicador de dirección: una barrita centrada en el origen del pulgar con una perilla que se corre.
  const meter = document.createElement('div')
  meter.className = 'rdc-meter'
  meter.setAttribute('data-testid', 'rally-meter')
  meter.setAttribute('aria-hidden', 'true')
  meter.innerHTML = `<span class="rdc-m-l">${ARROW_L}</span><span class="rdc-m-r">${ARROW_R}</span><i class="rdc-knob"></i>`
  const knob = meter.querySelector<HTMLElement>('.rdc-knob')!
  const mL = meter.querySelector<HTMLElement>('.rdc-m-l')!
  const mR = meter.querySelector<HTMLElement>('.rdc-m-r')!

  const handbrake = makeButton(
    'handbrake',
    labels.handbrake,
    `${HANDBRAKE_ICON}<span class="rdc-tb-cap">${labels.handbrake}</span>`,
  )
  const item = makeButton(
    'item',
    labels.item,
    `<span class="rdc-tb-icon" data-r="item-icon"></span><span class="rdc-tb-cap" data-r="item-cap">${labels.itemEmpty}</span>`,
  )
  const buttons: Record<ActionButton, HTMLButtonElement> = { handbrake, item }
  root.append(zoneL, zoneR, meter, item, handbrake)
  parent.appendChild(root)

  const itemIcon = item.querySelector<HTMLElement>('[data-r="item-icon"]')!
  const itemCap = item.querySelector<HTMLElement>('[data-r="item-cap"]')!

  /* ---------- medidas ---------- */
  let dirty = true
  let radius = DEFAULT_PAD_CONFIG.radius
  const layout = () => {
    dirty = false
    const rr = root.getBoundingClientRect()
    radius = Math.max(46, Math.min(70, rr.width * 0.085))
    controls.configure({ radius })
    meter.style.setProperty('--rdc-r', `${radius}px`)
    const l = zoneL.getBoundingClientRect()
    const r = zoneR.getBoundingClientRect()
    controls.setLayout(
      { left: l.left, top: l.top, right: l.right, bottom: l.bottom },
      { left: r.left, top: r.top, right: r.right, bottom: r.bottom },
    )
    paint()
  }

  const flag = (el: HTMLElement, key: string, v: string) => {
    if (el.dataset[key] !== v) el.dataset[key] = v
  }
  const paint = () => {
    const down = controls.actions.pressed()
    for (const id of Object.keys(buttons) as ActionButton[])
      flag(buttons[id], 'pressed', String(down.has(id)))
    flag(root, 'pedal', controls.pedal)
    flag(root, 'steering', String(controls.steerPointer !== null))
    const st = controls.state()
    flag(root, 'drift', String(st.drift))
    // Barrita de dirección: sigue al pulgar (solo transform).
    if (controls.steerPointer !== null) {
      const rr = root.getBoundingClientRect()
      const x = controls.origin - rr.left - radius
      const y = controls.thumbY - rr.top - 22
      meter.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`
      const dx = Math.max(-radius, Math.min(radius, controls.thumbX - controls.origin))
      knob.style.transform = `translate3d(${dx.toFixed(1)}px,0,0)`
    }
    flag(mL, 'on', String(controls.steerTarget > 0.02))
    flag(mR, 'on', String(controls.steerTarget < -0.02))
  }

  const cleanups: (() => void)[] = []
  const listen = (el: EventTarget, type: string, fn: (e: PointerEvent) => void) => {
    el.addEventListener(type, fn as EventListener)
    cleanups.push(() => el.removeEventListener(type, fn as EventListener))
  }
  const capture = (el: Element, id: number) => {
    try {
      el.setPointerCapture?.(id)
    } catch {
      // Puntero sintético o ya soltado: el seguimiento por posición sigue funcionando.
    }
  }

  /* ---------- superficies ---------- */
  const bindSurface = (zone: HTMLElement, surface: 'left' | 'right') => {
    listen(zone, 'pointerdown', (e) => {
      e.preventDefault()
      if (dirty) layout()
      if (controls.down(e.pointerId, surface, e.clientX, e.clientY)) capture(zone, e.pointerId)
      paint()
    })
    listen(zone, 'pointermove', (e) => {
      if (e.pointerId !== controls.steerPointer && e.pointerId !== controls.pedalPointer) return
      e.preventDefault()
      controls.move(e.pointerId, e.clientX, e.clientY)
      paint()
    })
    const end = (e: PointerEvent) => {
      if (e.pointerId !== controls.steerPointer && e.pointerId !== controls.pedalPointer) return
      controls.up(e.pointerId)
      paint()
    }
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(zone, type, end)
  }
  bindSurface(zoneL, 'left')
  bindSurface(zoneR, 'right')

  /* ---------- botones (cada dedo se queda con su botón) ---------- */
  for (const id of Object.keys(buttons) as ActionButton[]) {
    const b = buttons[id]
    listen(b, 'pointerdown', (e) => {
      e.preventDefault()
      capture(b, e.pointerId)
      controls.actions.down(e.pointerId, id)
      paint()
    })
    const end = (e: PointerEvent) => {
      if (!controls.actions.has(e.pointerId)) return
      controls.actions.up(e.pointerId)
      paint()
    }
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(b, type, end)
  }

  const noMenu = (e: Event) => e.preventDefault()
  root.addEventListener('contextmenu', noMenu)
  root.addEventListener('selectstart', noMenu)
  cleanups.push(() => {
    root.removeEventListener('contextmenu', noMenu)
    root.removeEventListener('selectstart', noMenu)
  })

  // Perder el foco o girar el celular suelta todos los dedos y vuelve a medir.
  const release = () => {
    controls.release()
    paint()
  }
  const markDirty = () => {
    dirty = true
  }
  window.addEventListener('blur', release)
  window.addEventListener('resize', markDirty)
  window.addEventListener('orientationchange', markDirty)
  cleanups.push(() => {
    window.removeEventListener('blur', release)
    window.removeEventListener('resize', markDirty)
    window.removeEventListener('orientationchange', markDirty)
  })
  let observer: ResizeObserver | null = null
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      markDirty()
      if (!root.hidden && controls.steerPointer === null && controls.pedalPointer === null) layout()
    })
    observer.observe(root)
  }

  let lastItemKey = ''
  return {
    el: root,
    controls,
    state(dt = 0) {
      const st = dt > 0 ? controls.step(dt) : controls.state()
      // La rampa del giro avanza sin eventos: el derrape y el color de la perilla se actualizan acá.
      flag(root, 'drift', String(st.drift))
      return st
    },
    release,
    setVisible(visible) {
      root.hidden = !visible
      if (!visible) release()
      else {
        dirty = true
        layout()
      }
    },
    setPrefs(p) {
      root.dataset.scheme = p.scheme
      controls.configure({ scheme: p.scheme, sensitivity: p.sensitivity })
      dirty = true
      if (!root.hidden) layout()
      paint()
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
      observer?.disconnect()
      controls.release()
      root.remove()
    },
  }
}

/* ---------- menú: ajustes y cartel de "cómo se maneja" ---------- */

const optRow = (name: string, values: [string, string][]) =>
  values
    .map(
      ([v, label]) =>
        `<input type="radio" name="rdc-${name}" id="rdc-${name}-${v}" value="${v}"><label for="rdc-${name}-${v}">${label}</label>`,
    )
    .join('')

/** Ajustes del control táctil para el menú (los `name` son rdc-scheme y rdc-sens). */
export function touchOptionsHtml(): string {
  const o = copy.rally.touchOptions
  return `
          <fieldset class="seg" data-testid="rally-touch-options">
            <legend>${o.scheme}</legend>
            <div class="seg-row">${optRow('scheme', [
              ['one', o.one],
              ['two', o.two],
            ])}</div>
          </fieldset>
          <fieldset class="seg">
            <legend>${o.sens}</legend>
            <div class="seg-row">${optRow('sens', [
              ['soft', o.soft],
              ['normal', o.normal],
              ['high', o.high],
            ])}</div>
          </fieldset>`
}

/** Dibujo "cómo se maneja": el celular en horizontal con las superficies y los botones del esquema elegido. */
export function touchHelpHtml(scheme: Scheme = loadTouchPrefs().scheme): string {
  const d = copy.rally.touchDraw
  const lines = scheme === 'one' ? copy.rally.touchHelpOne : copy.rally.touchHelpTwo
  const T = (x: number, y: number, s: string, a = 'middle') =>
    `<text x="${x}" y="${y}" text-anchor="${a}" class="th-t">${s}</text>`
  const swipe = (cx: number, cy: number) =>
    `<path d="M${cx - 34} ${cy}h68M${cx - 34} ${cy}l8-6m-8 6 8 6M${cx + 34} ${cy}l-8-6m8 6-8 6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`
  const btn = (cx: number, cy: number, r: number, label: string, fill: string) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="#fff" stroke-width="3"/>${T(cx, cy + r + 13, label)}`
  const frame = `<rect x="4" y="4" width="352" height="146" rx="22" fill="rgba(13,19,48,.55)" stroke="#fff" stroke-opacity=".55" stroke-width="3"/>`
  const gasBrake = (x0: number, x1: number) =>
    `<rect x="${x0}" y="14" width="${x1 - x0}" height="${PEDAL_SPLIT * 126}" fill="rgba(120,230,120,.18)"/>
     <rect x="${x0}" y="${14 + PEDAL_SPLIT * 126}" width="${x1 - x0}" height="${(1 - PEDAL_SPLIT) * 126}" fill="rgba(255,74,61,.22)"/>
     <path d="M${x0} ${14 + PEDAL_SPLIT * 126}H${x1}" stroke="#fff" stroke-dasharray="6 5" stroke-width="2.5"/>
     ${T((x0 + x1) / 2, 44, d.gas)}${T((x0 + x1) / 2, 128, d.brake)}`
  const body =
    scheme === 'one'
      ? `${gasBrake(14, 176)}${swipe(95, 62)}${T(95, 82, d.steer)}
         ${btn(236, 52, 24, d.item, 'rgba(255,210,63,.35)')}
         ${btn(298, 108, 24, d.handbrake, 'rgba(255,255,255,.14)')}`
      : `<rect x="14" y="14" width="150" height="126" fill="rgba(255,255,255,.07)"/>${swipe(89, 70)}${T(89, 94, d.steer)}
         ${gasBrake(180, 262)}
         ${btn(310, 50, 24, d.item, 'rgba(255,210,63,.35)')}
         ${btn(310, 108, 17, d.handbrake, 'rgba(255,255,255,.14)')}`
  return `
        <figure class="touch-help" data-testid="rally-howto" data-scheme="${scheme}">
          <svg viewBox="0 0 360 154" role="img" aria-label="${d.alt}">${frame}${body}</svg>
        </figure>
        <ul class="keys">
          ${lines.map((line) => `<li><span style="margin-left:0">${line}</span></li>`).join('')}
        </ul>`
}

export const TOUCH_CSS = `
.rdc .rdc-touch{position:absolute;inset:0;pointer-events:none;z-index:6;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:none;--rdc-act:clamp(84px,24vh,100px);--rdc-col:calc(var(--rdc-act) + 28px);--rdc-top:calc(60px + env(safe-area-inset-top,0px))}
.rdc .rdc-touch[hidden]{display:none}
.rdc .rdc-zone{position:absolute;top:var(--rdc-top);bottom:0;pointer-events:auto;touch-action:none}
.rdc .rdc-zone-l{left:0;width:50%}
.rdc .rdc-zone-r{left:50%;right:var(--rdc-col);display:none}
.rdc .rdc-touch[data-scheme="two"] .rdc-zone-r{display:block}
.rdc .rdc-touch[data-scheme="two"] .rdc-zone-l .rdc-pedals{display:none}
.rdc .rdc-touch[data-scheme="two"] .rdc-zone-l .rdc-hint{top:42%}
.rdc .rdc-pedals{position:absolute;inset:0;pointer-events:none}
.rdc .rdc-gas,.rdc .rdc-brk{position:absolute;left:0;right:0;display:flex;justify-content:center;font-family:var(--f-data);font-weight:700;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.7);text-shadow:0 1px 0 rgba(13,19,48,.7);transition:background-color .08s}
.rdc .rdc-gas{top:0;height:var(--split);align-items:flex-start;padding-top:6px}
.rdc .rdc-brk{top:var(--split);bottom:0;align-items:flex-end;padding-bottom:calc(6px + env(safe-area-inset-bottom,0px));border-top:2px dashed rgba(255,255,255,.5)}
.rdc .rdc-touch[data-pedal="gas"] .rdc-gas{background:rgba(120,230,120,.16);color:#fff}
.rdc .rdc-touch[data-pedal="brake"] .rdc-brk{background:rgba(255,74,61,.22);color:#fff}
.rdc .rdc-hint{position:absolute;left:50%;top:24%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;color:rgba(255,255,255,.7);font-family:var(--f-data);font-weight:700;font-size:11px;letter-spacing:.14em;text-transform:uppercase;pointer-events:none;text-shadow:0 1px 0 rgba(13,19,48,.7)}
.rdc .rdc-hint svg{width:16px;height:16px}
.rdc .rdc-touch[data-steering="true"] .rdc-hint{opacity:0}
.rdc .rdc-meter{--rdc-r:58px;position:absolute;left:0;top:0;width:calc(var(--rdc-r) * 2);height:44px;border-radius:22px;background:rgba(13,19,48,.4);border:3px solid rgba(255,255,255,.7);opacity:0;pointer-events:none;will-change:transform}
.rdc .rdc-touch[data-steering="true"] .rdc-meter{opacity:1}
.rdc .rdc-m-l,.rdc .rdc-m-r{position:absolute;top:50%;width:16px;height:16px;margin-top:-8px;color:#fff;opacity:.7}
.rdc .rdc-m-l{left:8px}.rdc .rdc-m-r{right:8px}
.rdc .rdc-m-l[data-on="true"],.rdc .rdc-m-r[data-on="true"]{color:var(--sun);opacity:1}
.rdc .rdc-m-l svg,.rdc .rdc-m-r svg{width:100%;height:100%;display:block}
.rdc .rdc-knob{position:absolute;left:50%;top:50%;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:rgba(255,210,63,.9);border:3px solid #fff;will-change:transform}
.rdc .rdc-touch[data-drift="true"] .rdc-knob{background:var(--tomato)}
.rdc .rdc-tb{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:0;margin:0;width:var(--rdc-act);height:var(--rdc-act);color:#fff;background:rgba(13,19,48,.4);border:3px solid rgba(255,255,255,.55);font-family:var(--f-data);font-weight:700;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;pointer-events:auto;transition:transform .06s,background-color .06s}
.rdc .rdc-tb::before{content:"";position:absolute;inset:-12px;border-radius:inherit}
.rdc .rdc-tb svg{display:block;filter:drop-shadow(0 2px 0 rgba(13,19,48,.55));pointer-events:none}
.rdc .rdc-tb[data-pressed="true"]{background:rgba(255,210,63,.75);border-color:#fff;color:var(--ink);transform:scale(.92)}
.rdc .rdc-tb-handbrake{right:calc(18px + env(safe-area-inset-right,0px));bottom:calc(14px + env(safe-area-inset-bottom,0px));border-radius:50%}
.rdc .rdc-tb-handbrake svg{width:42%;height:42%}
.rdc .rdc-tb-item{right:calc(18px + var(--rdc-act) * .62 + env(safe-area-inset-right,0px));bottom:calc(14px + var(--rdc-act) + 22px + env(safe-area-inset-bottom,0px));border-radius:24px}
.rdc .rdc-touch[data-scheme="two"] .rdc-tb-item{right:calc(14px + env(safe-area-inset-right,0px));bottom:auto;top:calc(var(--rdc-top) + 112px)}
.rdc .rdc-touch[data-scheme="two"] .rdc-tb-handbrake{--rdc-hb:calc(var(--rdc-act) * .8);width:var(--rdc-hb);height:var(--rdc-hb);right:calc(14px + var(--rdc-act) * .1 + env(safe-area-inset-right,0px))}
.rdc .rdc-tb-item[data-full="true"]{background:rgba(255,210,63,.32);border-color:var(--sun)}
.rdc .rdc-tb-item[data-full="true"][data-pressed="true"]{background:rgba(255,210,63,.8)}
.rdc .rdc-tb-icon{display:grid;place-items:center;width:100%;height:48%}
.rdc .rdc-tb-icon svg{width:auto;height:100%;aspect-ratio:1}
.rdc .rdc-tb-cap{font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;line-height:1.1;text-shadow:0 1px 0 rgba(13,19,48,.6);pointer-events:none;text-align:center;max-width:100%}
.rdc .rdc-tb-item:not([data-full="true"]) .rdc-tb-icon{border:3px dashed rgba(255,255,255,.35);border-radius:50%;width:36%;height:36%;opacity:.8}
.rdc .touch-help{margin:0 0 10px;max-width:420px}
.rdc .touch-help svg{width:100%;height:auto;display:block}
.rdc .touch-help .th-t{font-family:var(--f-data);font-weight:700;font-size:11px;fill:#fff;letter-spacing:.04em}
`
