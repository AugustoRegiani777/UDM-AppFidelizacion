// Rally de Cocina: la fábrica del juego. Arma el DOM (HUD, menús) y el mundo 3D dentro de un contenedor,
// corre el bucle y devuelve `dispose()`. Se carga con import dinámico: three no entra al paquete inicial.
import '@fontsource/bungee/latin-400.css'
import '@fontsource/chakra-petch/latin-500.css'
import '@fontsource/chakra-petch/latin-700.css'
import '@fontsource/rubik/latin-400.css'
import '@fontsource/rubik/latin-500.css'
import '@fontsource/rubik/latin-700.css'
import { copy } from '@/copy'
import { enterLandscape } from '../shared/landscape.ts'
import { RallyAudio } from './audio.ts'
import {
  CARS,
  HW,
  ICONS,
  ITEM_KEYS,
  ITEM_NAMES,
  clamp,
  fmt,
  hex,
  loadSettings,
  store,
  type RallySettings,
} from './data.ts'
import { createInput } from './input.ts'
import {
  ADAPT_WINDOW,
  SHADOW_PROBE_FRAMES,
  adaptResolution,
  detectTouch,
  qualityFor,
  shouldDisableShadows,
} from './quality.ts'
import { RallySim, type SimHooks } from './sim.ts'
import { RALLY_CSS } from './style.ts'
import { DIST, LEN, NRM, TAN, TP, trackCheck } from './track.ts'
import { createTouchLayer } from './touchLayer.ts'
import { EMPTY_TOUCH } from './touchModel.ts'
import { buildTemplate, carSVG } from './ui.ts'
import { createWorld, type RallyWorld } from './world.ts'

export interface RallyOptions {
  /** Vuelve a la sala de juegos. */
  onExit(): void
  /** Fuerza (true/false) la capa táctil; si falta, se detecta (o `?touch=1`). */
  touch?: boolean
  /** Sonido de la app (arranca apagado). */
  getSound?(): boolean
  setSound?(on: boolean): void
  /** Expone `window.__rally` para las pruebas. */
  test?: boolean
}

export interface RallyGame {
  /** ¿Se muestran los controles táctiles? */
  readonly touch: boolean
  /** Pausa si hay una carrera en curso (por ejemplo, con el celular en vertical). */
  pause(): void
  dispose(): void
}

const MM_W = 190
const MM_H = 150

export function createRallyGame(container: HTMLElement, options: RallyOptions): RallyGame {
  const touch = options.touch ?? detectTouch(location.search)
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const q = qualityFor(touch, window.devicePixelRatio || 1, reduced)

  const root = document.createElement('div')
  root.className = `rdc${touch ? ' is-touch' : ''}`
  root.setAttribute('data-testid', 'rally-root')
  root.dataset.state = 'menu'
  const style = document.createElement('style')
  style.textContent = RALLY_CSS
  root.appendChild(style)
  const body = document.createElement('div')
  body.style.display = 'contents'
  body.innerHTML = buildTemplate(touch)
  root.appendChild(body)
  container.appendChild(root)

  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector<T>(`[data-r="${id}"]`)!
  const stage = $('stage')
  const hudEl = $('hud')
  const menuEl = $('menu')
  const pauseEl = $('pause')
  const resultsEl = $('results')
  const fatalEl = $('fatal')

  const cleanups: (() => void)[] = []
  const on = <K extends keyof HTMLElementEventMap>(
    el: HTMLElement,
    type: K,
    fn: (e: HTMLElementEventMap[K]) => void,
  ) => {
    el.addEventListener(type, fn)
    cleanups.push(() => el.removeEventListener(type, fn))
  }

  let disposed = false
  let raf = 0
  const exit = () => options.onExit()

  /* ---------- sonido ---------- */
  const soundOn = () => options.getSound?.() ?? true
  const audio = new RallyAudio(!soundOn())

  /* ---------- simulación + mundo ---------- */
  const settings: RallySettings = loadSettings()
  let hudCache: Record<string, string | boolean> = {}
  let wrongT = 0
  let statsT = 0

  let world: RallyWorld | null = null
  const hooks: SimHooks = {
    emit: (...a) => world?.hooks.emit(...a),
    sfx(name, x, z, k = 1) {
      let v = k
      if (x !== undefined && z !== undefined) {
        const p = sim.player
        if (!p || sim.attract) return
        const d = Math.hypot(x - p.x, z - p.z)
        v *= clamp(1 - d / 70, 0, 1)
        if (v < 0.05) return
      }
      audio.play(name, v)
    },
    toast,
    bigMsg,
    fx: (...a) => world?.hooks.fx(...a),
    onClear: () => world?.hooks.onClear(),
    onCarCreated: (c) => world?.hooks.onCarCreated(c),
    onRaceStarted(attract) {
      world?.hooks.onRaceStarted(attract)
      hudCache = {}
      wrongT = 0
      if (!attract) updateItemHUD(true)
    },
    onRocketSpawn: (r) => world?.hooks.onRocketSpawn(r),
    onRocketRemove: (r) => world?.hooks.onRocketRemove(r),
    onOilSpawn: (o) => world?.hooks.onOilSpawn(o),
    onOilRemove: (o) => world?.hooks.onOilRemove(o),
    saveBest(carId, lap) {
      const key = 'best:' + carId
      const prev = store.get<number | null>(key, null)
      if (prev == null || lap < prev) {
        store.set(key, lap)
        return true
      }
      return false
    },
  }
  const sim = new RallySim(hooks, settings)

  try {
    world = createWorld(stage, sim, q, store.get<number>('cam', 0) ? 1 : 0)
  } catch {
    menuEl.hidden = true
    fatalEl.hidden = false
    on($('btn-exit-fatal'), 'click', exit)
    return {
      touch,
      pause() {},
      dispose() {
        disposed = true
        root.remove()
        audio.dispose()
      },
    }
  }
  const w3d = world

  /* ---------- capa táctil ---------- */
  const layer = touch
    ? createTouchLayer(root, {
        labels: {
          up: copy.rally.touch.up,
          down: copy.rally.touch.down,
          left: copy.rally.touch.left,
          right: copy.rally.touch.right,
          item: copy.rally.touch.item,
          handbrake: copy.rally.touch.handbrake,
          itemEmpty: copy.rally.touch.itemEmpty,
          itemRolling: copy.rally.touch.itemRolling,
        },
        onPress: (b) => {
          if (b === 'item') sim.tryUseItem()
        },
      })
    : null
  layer?.setVisible(false)

  /* ---------- HUD ---------- */
  function setT(id: string, v: string) {
    if (hudCache[id] !== v) {
      hudCache[id] = v
      $(id).textContent = v
    }
  }
  function bigMsg(text: string, long?: boolean) {
    const el = $('center-msg')
    el.textContent = text
    el.classList.toggle('long', !!long)
    el.classList.remove('pop')
    void el.offsetWidth
    el.classList.add('pop')
  }
  function toast(text: string) {
    const el = $('toast')
    el.textContent = text
    el.classList.remove('show')
    void el.offsetWidth
    el.classList.add('show')
  }
  function updateItemHUD(force?: boolean) {
    const p = sim.player
    if (!p) return
    const rolling = p.rolling > 0
    const it = rolling ? ITEM_KEYS[Math.floor(sim.time * 12) % 4]! : p.item
    const key = (rolling ? 'r:' : '') + (it ?? '')
    if (!force && hudCache.item === key) return
    hudCache.item = key
    $('item-icon').innerHTML = it ? ICONS[it] : ''
    $('item-label').textContent = rolling
      ? 'SORTEANDO…'
      : it
        ? ITEM_NAMES[it] + (touch ? '' : ' · ESPACIO')
        : 'SIN ÍTEM'
    $('item-slot').classList.toggle('full', !!p.item)
    layer?.setItem(it ? ICONS[it] : null, it ? ITEM_NAMES[it] : '', rolling)
  }

  const mm = $<HTMLCanvasElement>('minimap')
  const mctx = mm.getContext('2d')!
  const MDPR = Math.min(2, window.devicePixelRatio || 1)
  let mmBase: HTMLCanvasElement
  let mapX: (x: number) => number
  let mapZ: (z: number) => number
  function buildMinimap() {
    mm.width = MM_W * MDPR
    mm.height = MM_H * MDPR
    let x0 = 1e9,
      x1 = -1e9,
      z0 = 1e9,
      z1 = -1e9
    for (const p of TP) {
      x0 = Math.min(x0, p.x)
      x1 = Math.max(x1, p.x)
      z0 = Math.min(z0, p.z)
      z1 = Math.max(z1, p.z)
    }
    const sc = Math.min((MM_W - 24) / (x1 - x0), (MM_H - 24) / (z1 - z0))
    const ox = MM_W / 2 - ((x0 + x1) / 2) * sc
    const oz = MM_H / 2 - ((z0 + z1) / 2) * sc
    mapX = (x) => ox + x * sc
    mapZ = (z) => oz + z * sc
    mmBase = document.createElement('canvas')
    mmBase.width = mm.width
    mmBase.height = mm.height
    const b = mmBase.getContext('2d')!
    b.scale(MDPR, MDPR)
    b.lineJoin = 'round'
    const path = () => {
      b.beginPath()
      TP.forEach((p, i) => (i ? b.lineTo(mapX(p.x), mapZ(p.z)) : b.moveTo(mapX(p.x), mapZ(p.z))))
      b.closePath()
    }
    b.strokeStyle = 'rgba(255,255,255,.25)'
    b.lineWidth = HW * 2 * sc
    path()
    b.stroke()
    b.strokeStyle = 'rgba(255,255,255,.8)'
    b.lineWidth = 1.5
    path()
    b.stroke()
    const p = TP[0]!
    const n = NRM[0]!
    b.strokeStyle = '#ffd23f'
    b.lineWidth = 3
    b.beginPath()
    b.moveTo(mapX(p.x + n.x * HW), mapZ(p.z + n.z * HW))
    b.lineTo(mapX(p.x - n.x * HW), mapZ(p.z - n.z * HW))
    b.stroke()
  }
  function drawMinimap() {
    mctx.setTransform(1, 0, 0, 1, 0, 0)
    mctx.clearRect(0, 0, mm.width, mm.height)
    mctx.drawImage(mmBase, 0, 0)
    mctx.setTransform(MDPR, 0, 0, MDPR, 0, 0)
    for (const c of sim.cars) {
      if (c === sim.player) continue
      mctx.fillStyle = hex(c.def.color)
      mctx.beginPath()
      mctx.arc(mapX(c.x), mapZ(c.z), 3.4, 0, 7)
      mctx.fill()
    }
    const p = sim.player
    if (p) {
      mctx.fillStyle = hex(p.def.color)
      mctx.strokeStyle = '#fff'
      mctx.lineWidth = 2.2
      mctx.beginPath()
      mctx.arc(mapX(p.x), mapZ(p.z), 5, 0, 7)
      mctx.fill()
      mctx.stroke()
    }
  }
  function updateHUD(dt: number) {
    const p = sim.player!
    setT('hud-pos', String(p.pos))
    setT('hud-total', String(sim.cars.length))
    setT(
      'hud-lap',
      (p.finished ? sim.totalLaps : clamp(p.lapsDone + 1, 1, sim.totalLaps)) + '/' + sim.totalLaps,
    )
    const rt = sim.state === 'countdown' ? 0 : sim.raceTime
    setT('hud-time', fmt(p.finished ? p.finishTime : rt))
    setT(
      'hud-laptime',
      fmt(p.finished ? (p.lapTimes[p.lapTimes.length - 1] ?? 0) : Math.max(0, rt - p.lapStart)),
    )
    setT('hud-best', fmt(p.bestLap))
    setT('hud-speed', String(Math.round(Math.abs(p.vf) * 3.6)))
    const tw = Math.round(clamp(p.turbo / 2.6, 0, 1) * 100) + '%'
    if (hudCache.tw !== tw) {
      hudCache.tw = tw
      $('hud-turbo').style.width = tw
    }
    updateItemHUD()
    const t = TAN[p.idx]!
    const dot = Math.sin(p.heading) * t.x + Math.cos(p.heading) * t.z
    const sp = Math.hypot(p.vx, p.vz)
    if (sim.state === 'race' && dot < -0.3 && sp > 2.5) wrongT += dt
    else wrongT = Math.max(0, wrongT - dt * 3)
    const ww = wrongT > 1.1
    if (hudCache.ww !== ww) {
      hudCache.ww = ww
      $('wrongway').hidden = !ww
    }
    drawMinimap()
  }

  /* ---------- sonido: botón de silencio ---------- */
  const SVG_SOUND_ON =
    '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" fill="#fff"/><path d="M13 6.5a5 5 0 0 1 0 7M15.5 4a8.5 8.5 0 0 1 0 12" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>'
  const SVG_SOUND_OFF =
    '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 7.5h3l4-3.5v12l-4-3.5H3z" fill="#fff"/><path d="m13 7 5 6m0-6-5 6" stroke="#ff4a3d" stroke-width="2" stroke-linecap="round"/></svg>'
  function paintMute() {
    const btn = $('btn-mute')
    btn.innerHTML = audio.isMuted ? SVG_SOUND_OFF : SVG_SOUND_ON
    btn.setAttribute('aria-label', audio.isMuted ? copy.rally.unmute : copy.rally.mute)
  }
  function toggleMute() {
    const nextOn = audio.isMuted // si estaba en silencio, ahora suena
    audio.setMuted(!nextOn)
    options.setSound?.(nextOn)
    paintMute()
  }

  /* ---------- flujo ---------- */
  const inRace = () => sim.state === 'race' || sim.state === 'countdown'
  let last = performance.now()
  function setState() {
    root.dataset.state = sim.state
  }
  function togglePause() {
    const wasPaused = sim.state === 'paused'
    if (!inRace() && !wasPaused) return
    sim.togglePause(() => {
      last = performance.now()
    })
    layer?.release()
    resetFrameStats()
    if (sim.state === 'paused') {
      pauseEl.hidden = false
      $('btn-resume').focus({ preventScroll: true })
      audio.suspend()
    } else {
      pauseEl.hidden = true
      audio.resume()
    }
    setState()
  }
  function renderResults() {
    const player = sim.player
    if (!player) return
    $('res-body').innerHTML = sim.ranked
      .map(
        (c) =>
          `<tr class="${c.isPlayer ? 'me' : ''}"><td>${c.pos}º</td><td><span class="dot" style="background:${hex(c.def.color)}"></span>${c.def.name}${c.isPlayer ? ' (vos)' : ''}</td><td>${c.finished ? fmt(c.finishTime) : 'en carrera'}</td><td>${isFinite(c.bestLap) ? fmt(c.bestLap) : '--:--.--'}</td></tr>`,
      )
      .join('')
    $('res-title').textContent = player.place === 1 ? '¡Ganaste!' : `Llegaste ${player.place}º`
    $('res-sub').textContent =
      `${sim.totalLaps} ${sim.totalLaps === 1 ? 'vuelta' : 'vueltas'} con ${player.def.name}. Tu mejor vuelta: ${fmt(player.bestLap)}${player.newRecord ? ' (récord personal)' : ''}.`
  }
  function showResults() {
    statsT = 0.5
    renderResults()
    layer?.setVisible(false)
    resultsEl.hidden = false
    $('btn-again').focus({ preventScroll: true })
  }
  function updateRecord() {
    const def = CARS.find((c) => c.id === settings.car) ?? CARS[0]!
    const b = store.get<number | null>('best:' + def.id, null)
    $('record-line').textContent = b
      ? `Tu mejor vuelta con ${def.name}: ${fmt(b)}`
      : `Todavía no tenés récord con ${def.name}.`
  }
  function showMenu() {
    hudEl.hidden = true
    resultsEl.hidden = true
    pauseEl.hidden = true
    menuEl.hidden = false
    layer?.setVisible(false)
    audio.resume()
    updateRecord()
    sim.startRace(true)
    setState()
  }
  function startGame() {
    audio.init()
    audio.resume()
    menuEl.hidden = true
    resultsEl.hidden = true
    pauseEl.hidden = true
    hudEl.hidden = false
    layer?.setVisible(true)
    sim.settings = { ...settings }
    sim.startRace(false)
    last = performance.now()
    resetFrameStats()
    setState()
    // En el celular: pantalla completa y horizontal (si el navegador lo permite).
    if (touch) void enterLandscape()
  }

  /* ---------- menú ---------- */
  function buildMenu() {
    const grid = $('car-grid')
    grid.innerHTML = ''
    const sv = (v: number) => clamp(v, 0.08, 1).toFixed(2)
    for (const def of CARS) {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'car-card'
      b.dataset.car = def.id
      b.setAttribute('data-testid', 'rally-car-' + def.id)
      b.setAttribute('role', 'radio')
      b.setAttribute('aria-checked', String(def.id === settings.car))
      b.innerHTML = `${carSVG(def)}<div><div class="car-name">${def.name}</div><div class="car-motor">${def.motor}</div><div class="stats"><span>VEL</span><span class="bar"><i style="--v:${sv((def.maxSpeed - 26) / 9)}"></i></span><span>ACEL</span><span class="bar"><i style="--v:${sv((def.accel - 17) / 11)}"></i></span><span>AGARRE</span><span class="bar"><i style="--v:${sv((def.grip - 6) / 3.6)}"></i></span></div></div>`
      on(b, 'click', () => {
        settings.car = def.id
        store.set('car', def.id)
        grid
          .querySelectorAll('.car-card')
          .forEach((x) => x.setAttribute('aria-checked', String(x === b)))
        updateRecord()
      })
      grid.appendChild(b)
    }
    const bind = <K extends 'laps' | 'rivals' | 'diff'>(
      name: K,
      parse: (v: string) => RallySettings[K],
    ) =>
      root.querySelectorAll<HTMLInputElement>(`input[name="rdc-${name}"]`).forEach((r) => {
        r.checked = parse(r.value) === settings[name]
        on(r, 'change', () => {
          settings[name] = parse(r.value)
          store.set(name, settings[name])
        })
      })
    bind('laps', Number)
    bind('rivals', Number)
    bind('diff', (v) => (v === 'easy' || v === 'hard' ? v : 'normal'))
    on($('btn-start'), 'click', startGame)
    on($('btn-exit'), 'click', exit)
    on($('btn-exit-pause'), 'click', exit)
    on($('btn-resume'), 'click', togglePause)
    on($('btn-restart'), 'click', () => {
      pauseEl.hidden = true
      startGame()
    })
    on($('btn-menu'), 'click', showMenu)
    on($('btn-again'), 'click', startGame)
    on($('btn-res-menu'), 'click', showMenu)
    on($('btn-pause'), 'click', (e) => {
      ;(e.currentTarget as HTMLElement).blur()
      if (inRace() || sim.state === 'paused') togglePause()
    })
    on($('btn-mute'), 'click', (e) => {
      ;(e.currentTarget as HTMLElement).blur()
      audio.init()
      toggleMute()
    })
    on($('btn-cam'), 'click', (e) => {
      ;(e.currentTarget as HTMLElement).blur()
      toggleCamera()
    })
    paintMute()
    updateRecord()
  }
  function toggleCamera() {
    w3d.camMode = (w3d.camMode + 1) % 2
    store.set('cam', w3d.camMode)
  }

  /* ---------- entrada ---------- */
  const input = createInput({
    useItem: () => sim.tryUseItem(),
    reset: () => sim.tryReset(),
    togglePause: () => {
      if (inRace() || sim.state === 'paused') togglePause()
    },
    toggleCamera,
    toggleMute: () => {
      audio.init()
      toggleMute()
    },
    toggleFullscreen: () => {
      try {
        if (!document.fullscreenElement)
          void document.documentElement.requestFullscreen?.().catch(() => {})
        else void document.exitFullscreen?.().catch(() => {})
      } catch {
        // sin pantalla completa
      }
    },
    enter: (e) => {
      if (
        !menuEl.hidden &&
        !(e.target instanceof HTMLButtonElement) &&
        !(e.target instanceof HTMLInputElement)
      )
        startGame()
    },
    capturesArrows: () => sim.state !== 'menu',
    lostFocus: () => {
      layer?.release()
      if (inRace()) togglePause()
    },
  })

  /* ---------- rendimiento ---------- */
  let frameCount = 0
  let frameSum = 0
  let probed = !(q.touch && q.shadowSize > 0)
  let probeSum = 0
  let probeN = 0
  function resetFrameStats() {
    frameCount = 0
    frameSum = 0
  }
  function trackFrameTime(ms: number) {
    if (!q.touch || ms > 100) return
    if (!probed) {
      // Los primeros cuadros compilan shaders: se ignoran.
      if (++probeN > 12) probeSum += ms
      if (probeN >= 12 + SHADOW_PROBE_FRAMES) {
        probed = true
        if (shouldDisableShadows(probeSum / SHADOW_PROBE_FRAMES)) w3d.setShadows(false)
      }
      return
    }
    if (!q.adaptive) return
    frameSum += ms
    if (++frameCount >= ADAPT_WINDOW) {
      const next = adaptResolution(frameSum / frameCount, w3d.getPixelRatio())
      if (next) w3d.setPixelRatio(next.pixelRatio)
      frameCount = 0
      frameSum = 0
    }
  }

  /* ---------- bucle ---------- */
  function update(dt: number) {
    const pin = input.read(layer ? layer.state() : EMPTY_TOUCH)
    sim.update(dt, pin)
    w3d.update(dt)
    if (sim.player && !sim.attract) updateHUD(dt)
    if (sim.state === 'finished') {
      if (sim.resultsTimer > 0) {
        sim.resultsTimer -= dt
        if (sim.resultsTimer <= 0) showResults()
      } else if (!resultsEl.hidden) {
        statsT -= dt
        if (statsT <= 0) {
          statsT = 0.5
          renderResults()
        }
      }
    }
    if (root.dataset.state !== sim.state) setState()
  }
  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    const ms = Math.max(0, now - last)
    const dt = Math.min(0.05, ms / 1000)
    last = now
    if (sim.state !== 'paused') {
      trackFrameTime(ms)
      update(dt)
      w3d.updateCamera(dt)
    }
    const p = sim.player
    audio.updateEngine({
      active:
        !!p &&
        !sim.attract &&
        (sim.state === 'race' || sim.state === 'countdown' || sim.state === 'finished'),
      finished: sim.state === 'finished',
      speedRatio: p ? Math.abs(p.vf) / p.def.maxSpeed : 0,
      throttle: p?.thrVis ?? 0,
      turbo: !!p && p.turbo > 0,
      airborne: !!p && p.airborne,
    })
    w3d.render()
  }

  const resizeObserver = new ResizeObserver(() => {
    w3d.resize(container.clientWidth, container.clientHeight)
  })
  resizeObserver.observe(container)

  /* ---------- arranque ---------- */
  buildMinimap()
  buildMenu()
  showMenu()
  last = performance.now()
  raf = requestAnimationFrame(frame)

  // Gancho de pruebas: solo con ?test=1 o en desarrollo.
  const testHook = options.test ?? (import.meta.env.DEV || location.search.includes('test=1'))
  if (testHook) {
    ;(window as unknown as { __rally?: unknown }).__rally = {
      get sim() {
        return sim
      },
      trackCheck,
      len: LEN,
      dist: DIST,
      tp: TP,
      tan: TAN,
      quality: q,
      get pixelRatio() {
        return w3d.getPixelRatio()
      },
    }
  }

  return {
    touch,
    pause() {
      if (inRace()) togglePause()
      layer?.release()
    },
    dispose() {
      if (disposed) return
      disposed = true
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      input.dispose()
      cleanups.forEach((fn) => fn())
      layer?.dispose()
      audio.dispose()
      w3d.dispose()
      root.remove()
      if (testHook) delete (window as unknown as { __rally?: unknown }).__rally
      // Al salir devolvemos la pantalla como estaba (silencio si el navegador no lo permite).
      if (touch) {
        try {
          screen.orientation?.unlock?.()
          if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {})
        } catch {
          // nada que hacer
        }
      }
    },
  }
}
