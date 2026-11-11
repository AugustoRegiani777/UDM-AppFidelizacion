// Rally de Cocina: sonido sintetizado con Web Audio (sin archivos). Mismos efectos y motor que la demo.
import { clamp } from './data.ts'
import type { SfxName } from './sim.ts'

interface Engine {
  o1: OscillatorNode
  o2: OscillatorNode
  o3: OscillatorNode
  f: BiquadFilterNode
  g: GainNode
  g3: GainNode
}

export interface EngineInfo {
  active: boolean
  finished: boolean
  speedRatio: number
  throttle: number
  turbo: boolean
  airborne: boolean
}

export class RallyAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private eng: Engine | null = null
  private noiseBuf: AudioBuffer | null = null

  constructor(private muted: boolean) {}

  get isMuted() {
    return this.muted
  }

  /** Hay que llamarlo desde un gesto del usuario (el navegador no deja sonar antes). */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    try {
      const ctx = new AC()
      this.ctx = ctx
      const master = ctx.createGain()
      master.gain.value = this.muted ? 0 : 0.5
      master.connect(ctx.destination)
      this.master = master
      const len = ctx.sampleRate
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const ch = buf.getChannelData(0)
      for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1
      this.noiseBuf = buf
      const o1 = ctx.createOscillator()
      o1.type = 'sawtooth'
      const o2 = ctx.createOscillator()
      o2.type = 'square'
      const o3 = ctx.createOscillator()
      o3.type = 'triangle'
      const f = ctx.createBiquadFilter()
      f.type = 'lowpass'
      f.Q.value = 3
      const g = ctx.createGain()
      g.gain.value = 0
      const g2 = ctx.createGain()
      g2.gain.value = 0.5
      const g3 = ctx.createGain()
      g3.gain.value = 0
      o1.connect(f)
      o2.connect(g2)
      g2.connect(f)
      f.connect(g)
      g.connect(master)
      o3.connect(g3)
      g3.connect(master)
      o1.start()
      o2.start()
      o3.start()
      this.eng = { o1, o2, o3, f, g, g3 }
    } catch {
      this.ctx = null
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted
    if (this.master) this.master.gain.value = muted ? 0 : 0.5
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend()
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume()
  }

  private tone(
    freq: number,
    dur: number,
    {
      type = 'square',
      vol = 0.2,
      to = null,
      delay = 0,
    }: {
      type?: OscillatorType
      vol?: number
      to?: number | null
      delay?: number
    } = {},
  ) {
    const ctx = this.ctx
    if (!ctx || !this.master || this.muted) return
    const t = ctx.currentTime + delay
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    g.connect(this.master)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  private noise(
    dur: number,
    {
      vol = 0.3,
      freq = 800,
      to = null,
      type = 'lowpass',
      delay = 0,
    }: {
      vol?: number
      freq?: number
      to?: number | null
      type?: BiquadFilterType
      delay?: number
    } = {},
  ) {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.noiseBuf || this.muted) return
    const t = ctx.currentTime + delay
    const s = ctx.createBufferSource()
    s.buffer = this.noiseBuf
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.setValueAtTime(freq, t)
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(Math.max(vol, 0.0002), t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    s.connect(f)
    f.connect(g)
    g.connect(this.master)
    s.start(t)
    s.stop(t + dur + 0.05)
  }

  /** `v` ya viene atenuado por la distancia (1 = a todo volumen). */
  play(name: SfxName, v = 1) {
    if (!this.ctx || this.muted) return
    switch (name) {
      case 'beep':
        this.tone(620, 0.18, { vol: 0.25 })
        break
      case 'go':
        this.tone(990, 0.5, { vol: 0.3 })
        this.tone(1480, 0.5, { vol: 0.12 })
        break
      case 'pickup':
        this.tone(520, 0.08, { vol: 0.15 })
        this.tone(780, 0.08, { vol: 0.15, delay: 0.07 })
        this.tone(1040, 0.12, { vol: 0.15, delay: 0.14 })
        break
      case 'got':
        this.tone(880, 0.12, { type: 'triangle', vol: 0.25 })
        this.tone(1320, 0.2, { type: 'triangle', vol: 0.2, delay: 0.1 })
        break
      case 'turbo':
        this.noise(0.6, { vol: 0.35 * v, freq: 600, to: 4000, type: 'bandpass' })
        this.tone(200, 0.5, { type: 'sawtooth', vol: 0.12 * v, to: 800 })
        break
      case 'rocket':
        this.tone(900, 0.45, { type: 'sawtooth', vol: 0.12 * v, to: 180 })
        this.noise(0.4, { vol: 0.2 * v, freq: 2000, to: 400 })
        break
      case 'boom':
        this.noise(0.8, { vol: 0.6 * v, freq: 1200, to: 80 })
        this.tone(120, 0.5, { type: 'sine', vol: 0.4 * v, to: 40 })
        break
      case 'bump':
        this.noise(0.12, { vol: 0.3 * v, freq: 500 })
        break
      case 'zap':
        this.tone(1600, 0.3, { type: 'sawtooth', vol: 0.12 * v, to: 200 })
        this.noise(0.3, { vol: 0.2 * v, freq: 5000, type: 'highpass' })
        break
      case 'oil':
        this.tone(400, 0.3, { type: 'sine', vol: 0.2 * v, to: 120 })
        break
      case 'drop':
        this.tone(300, 0.15, { type: 'sine', vol: 0.2 * v, to: 150 })
        break
      case 'lap':
        this.tone(660, 0.12, { vol: 0.2 })
        this.tone(880, 0.2, { vol: 0.2, delay: 0.12 })
        break
      case 'finish':
        ;[523, 659, 784, 1047].forEach((f, i) =>
          this.tone(f, 0.28, { vol: 0.22, delay: i * 0.13, type: 'triangle' }),
        )
        break
      case 'land':
        this.noise(0.15, { vol: 0.25, freq: 300 })
        break
      case 'hit':
        this.tone(300, 0.35, { type: 'square', vol: 0.18, to: 80 })
        break
    }
  }

  updateEngine(info: EngineInfo) {
    const eng = this.eng
    const ctx = this.ctx
    if (!eng || !ctx) return
    const t = ctx.currentTime
    let vol = 0
    let base = 60
    let sp = 0
    if (info.active && !this.muted) {
      sp = clamp(info.speedRatio, 0, 1.5)
      base = 80 + sp * 300 + (info.turbo ? 80 : 0)
      if (info.airborne) base *= 1.15
      vol = 0.035 + 0.05 * info.throttle + 0.03 * sp
      if (info.finished) vol *= 0.5
    }
    eng.o1.frequency.setTargetAtTime(base, t, 0.04)
    eng.o2.frequency.setTargetAtTime(base * 0.5, t, 0.04)
    eng.o3.frequency.setTargetAtTime(base * 3, t, 0.04)
    eng.f.frequency.setTargetAtTime(400 + sp * 2400, t, 0.05)
    eng.g.gain.setTargetAtTime(vol, t, 0.06)
    eng.g3.gain.setTargetAtTime(vol * 0.35, t, 0.06)
  }

  dispose() {
    const eng = this.eng
    if (eng) {
      for (const o of [eng.o1, eng.o2, eng.o3]) {
        try {
          o.stop()
        } catch {
          // ya detenido
        }
        o.disconnect()
      }
    }
    this.eng = null
    void this.ctx?.close().catch(() => {})
    this.ctx = null
    this.master = null
  }
}
