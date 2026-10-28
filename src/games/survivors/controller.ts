// Controlador del juego: une la simulación (compartida con el servidor), el dibujo, los controles y el sonido.
// Es TypeScript puro (sin React) para que el lazo de animación sea simple; React solo muestra menús y HUD.

import {
  ARENA_H,
  ARENA_W,
  POWERS,
  QUEEN,
  TICKS_PER_SECOND,
  type GameConfig,
  type UpgradeId,
} from '@engine/config.ts'
import { InputRecorder } from '@engine/replay.ts'
import {
  createGame,
  pick,
  scoreOf,
  step,
  xpNeeded,
  type GameEvent,
  type GameState,
} from '@engine/sim.ts'
import { copy } from '@/copy'
import { vibrate } from '@/motion/feedback'
import { sfx, unlockAudio } from './audio.ts'
import type { GameOutcome, GameSession } from '../outcome.ts'
import type { HudData } from './HudOverlay.tsx'
import { InputController } from './input.ts'
import { SurvivorsRenderer } from './renderer.ts'

export type Phase = 'ready' | 'playing' | 'paused' | 'levelup' | 'ended'

export interface ControllerCallbacks {
  onPhase: (phase: Phase) => void
  onHud: (hud: HudData) => void
  onLevelUp: (choices: UpgradeId[], levels: Record<UpgradeId, number>) => void
  onBanner: (kind: 'boss' | 'wave' | null) => void
  onEnd: (outcome: GameOutcome) => void
}

const STEP_MS = 1000 / TICKS_PER_SECOND
const END_DELAY_MS = 1200
const MAX_DPR = 3
const SLOW_FRAME_MS = 21
const FRAME_SAMPLES = 90

export type { GameOutcome, GameSession }

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

export function hudOf(state: GameState): HudData {
  const boss = state.config.boss && state.tick >= state.surviveTicks
  const target = boss ? state.totalTicks : state.surviveTicks
  const queen = state.enemies.find((e) => e.alive && e.kind === QUEEN)
  return {
    hp: Math.max(0, state.player.hp),
    maxHp: state.player.maxHp,
    phase: boss ? 'boss' : 'survive',
    secondsLeft: Math.max(0, Math.ceil((target - state.tick) / TICKS_PER_SECOND)),
    totalSeconds: boss ? state.config.bossSeconds : state.config.durationSeconds,
    queenRatio: queen ? Math.max(0, queen.hp / queen.maxHp) : null,
    level: state.level,
    xpRatio: state.xp / xpNeeded(state.level),
    powers: POWERS.map((id) => ({ level: state.upgrades[id], charges: state.charges[id] })),
  }
}

function react(events: readonly GameEvent[]) {
  for (const event of events) {
    switch (event.t) {
      case 'shoot':
        sfx.shoot()
        break
      case 'hit':
        sfx.hit()
        break
      case 'kill':
        sfx.kill()
        break
      case 'gem':
        sfx.gem()
        break
      case 'hurt':
        sfx.hurt()
        vibrate(35)
        break
      case 'levelup':
        sfx.levelUp()
        vibrate(20)
        break
      case 'boss':
        sfx.boss()
        vibrate([60, 40, 60])
        break
      case 'wave':
        sfx.wave()
        break
      case 'soldier':
        sfx.soldier()
        break
      case 'chipa':
        sfx.chipa()
        break
      case 'bait':
        sfx.bait()
        break
      case 'power':
        sfx.power()
        vibrate(10)
        break
      case 'boom':
        sfx.boom()
        vibrate(15)
        break
      default:
    }
  }
}

export class GameController {
  private readonly state: GameState
  private readonly recorder = new InputRecorder()
  private readonly renderer: SurvivorsRenderer
  private readonly input: InputController
  private phase: Phase = 'ready'
  private raf = 0
  private last = 0
  private accumulator = 0
  private frame = 0
  private slowMs = 0
  private dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
  private bannerTimer = 0
  private endTimer = 0
  private readonly resizeObserver: ResizeObserver
  private readonly onVisibility = () => document.hidden && this.pause()
  /** Poderes que el jugador pidió soltar; se aplican de a uno por paso de simulación. */
  private readonly castQueue: number[] = []
  private readonly onKey = (e: KeyboardEvent) => {
    const index = ['1', '2', '3'].indexOf(e.key)
    if (index !== -1) this.cast(index)
  }

  constructor(
    canvas: HTMLCanvasElement,
    private readonly container: HTMLElement,
    session: GameSession<GameConfig>,
    private readonly callbacks: ControllerCallbacks,
  ) {
    this.state = createGame(session.config, session.seed)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.renderer = new SurvivorsRenderer(canvas, reduced, session.config.stage)
    this.input = new InputController(container, (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: ((clientX - rect.left) / rect.width) * ARENA_W,
        y: ((clientY - rect.top) / rect.height) * ARENA_H,
      }
    })
    this.layout()
    this.drawIdle()
    this.resizeObserver = new ResizeObserver(() => {
      this.layout()
      this.drawIdle()
    })
    this.resizeObserver.observe(container)
    document.addEventListener('visibilitychange', this.onVisibility)
    window.addEventListener('keydown', this.onKey)
    callbacks.onHud(hudOf(this.state))
  }

  private layout() {
    const width = Math.min(
      this.container.clientWidth,
      (this.container.clientHeight * ARENA_W) / ARENA_H,
    )
    this.renderer.resize(width, this.dpr)
  }

  private drawIdle() {
    this.renderer.render(this.state, 0, this.input.view(), performance.now())
  }

  private setPhase(next: Phase) {
    this.phase = next
    this.callbacks.onPhase(next)
  }

  /** Arranca desde el menú inicial (gesto del usuario: habilita el audio). */
  start() {
    unlockAudio()
    this.resume()
  }

  resume() {
    this.last = performance.now()
    this.accumulator = 0
    this.setPhase('playing')
    this.raf = requestAnimationFrame(this.tick)
  }

  pause() {
    if (this.phase !== 'playing') return
    cancelAnimationFrame(this.raf)
    this.setPhase('paused')
  }

  /** Pide soltar una burbuja de poder (0 = soldados, 1 = chipás, 2 = cebo). Sin burbuja lista no hace nada. */
  cast(index: number) {
    if (this.phase !== 'playing') return
    const id = POWERS[index]
    if (!id || this.state.upgrades[id] <= 0 || this.state.charges[id] <= 0) return
    if (this.castQueue.includes(index)) return
    this.castQueue.push(index)
  }

  /** Aplica la mejora elegida y sigue jugando. */
  choose(index: number) {
    if (!this.state.pending) return
    this.recorder.pick(this.state.tick, index)
    pick(this.state, index)
    sfx.pick()
    this.resume()
  }

  private showBanner(kind: 'boss' | 'wave') {
    this.callbacks.onBanner(kind)
    window.clearTimeout(this.bannerTimer)
    this.bannerTimer = window.setTimeout(() => this.callbacks.onBanner(null), 2400)
  }

  private adaptResolution(frameMs: number) {
    this.slowMs += frameMs
    if (++this.frame % FRAME_SAMPLES !== 0) return
    // Si el celular no llega a ~48 fps, se baja la definición de a poco (nunca vuelve a subir).
    if (this.slowMs / FRAME_SAMPLES > SLOW_FRAME_MS && this.dpr > 1) {
      this.dpr = Math.max(1, this.dpr - 0.25)
      this.layout()
    }
    this.slowMs = 0
  }

  private readonly tick = (now: number) => {
    if (this.phase !== 'playing') return
    const frameMs = Math.min(now - this.last, 100)
    this.last = now
    this.accumulator += frameMs
    this.adaptResolution(frameMs)

    const { state } = this
    while (this.accumulator >= STEP_MS) {
      const dir = this.input.direction()
      this.recorder.move(state.tick, dir)
      const cast = this.castQueue.shift() ?? -1
      if (cast >= 0) this.recorder.cast(state.tick, cast)
      step(state, dir, cast)
      this.renderer.ingest(state.events, state)
      react(state.events)
      if (state.events.some((e) => e.t === 'boss')) this.showBanner('boss')
      else if (state.events.some((e) => e.t === 'wave')) this.showBanner('wave')
      this.accumulator -= STEP_MS
      if (state.pending || state.status !== 'playing') break
    }
    // Una burbuja nueva o gastada se ve enseguida, sin esperar al refresco normal del HUD.
    if (state.events.some((e) => e.t === 'power' || e.t === 'soldier' || e.t === 'chipa' || e.t === 'bait')) {
      this.callbacks.onHud(hudOf(state))
    }

    this.renderer.render(state, Math.min(this.accumulator / STEP_MS, 1), this.input.view(), now)
    if (this.frame % 6 === 0 || state.pending || state.status !== 'playing') {
      this.callbacks.onHud(hudOf(state))
    }

    if (state.status !== 'playing') {
      this.finish()
      return
    }
    if (state.pending) {
      this.callbacks.onLevelUp(state.pending, { ...state.upgrades })
      this.setPhase('levelup')
      return
    }
    this.raf = requestAnimationFrame(this.tick)
  }

  private finish() {
    const { state } = this
    const won = state.status === 'won'
    this.setPhase('ended')
    if (won) {
      sfx.win()
      vibrate([30, 40, 30])
    } else {
      sfx.lose()
    }
    const score = scoreOf(state)
    const seconds = Math.floor(state.tick / TICKS_PER_SECOND)
    const queen = state.enemies.find((e) => e.kind === QUEEN && e.alive)
    const queenLife = queen ? Math.round((Math.max(0, queen.hp) / queen.maxHp) * 100) : 100
    const lostText = state.bossSpawned
      ? copy.chest.lostBodyQueen(queenLife)
      : copy.chest.lostBody(seconds, state.config.durationSeconds)
    const queenTime = clock(Math.max(0, (state.queenKillTick - state.surviveTicks) / TICKS_PER_SECOND))
    const statsText = won
      ? copy.chest.statsWon(state.kills, state.level, score, queenTime)
      : copy.chest.stats(state.kills, state.level, score)
    this.endTimer = window.setTimeout(() => {
      this.callbacks.onEnd({
        won,
        log: this.recorder.log,
        lostText,
        statsText,
        score,
        reason: state.endReason === 'time' ? 'time' : 'hp',
      })
    }, END_DELAY_MS)
  }

  dispose() {
    cancelAnimationFrame(this.raf)
    window.clearTimeout(this.bannerTimer)
    window.clearTimeout(this.endTimer)
    this.resizeObserver.disconnect()
    document.removeEventListener('visibilitychange', this.onVisibility)
    window.removeEventListener('keydown', this.onKey)
    this.input.dispose()
  }
}
