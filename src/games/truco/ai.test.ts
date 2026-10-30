// @vitest-environment node
import { decide, PROFILES, riskMultiplier, type Profile } from './ai.ts'
import { createMatch, dealHand, type TrucoState } from './engine.ts'

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const [pibe, rosa, maestro] = PROFILES as [Profile, Profile, Profile]

/** Primera decisión del rival (asiento 1) en una mano recién repartida donde le toca jugar. */
function openingStates(count: number): TrucoState[] {
  const states: TrucoState[] = []
  let s = createMatch(7)
  for (let i = 0; i < count; i++) {
    // mano = 0 antes de repartir => queda mano el asiento 1 y arranca el rival
    s = dealHand({ ...s, rngState: i * 7919 + 11, mano: 0 }, 0)
    states.push(s)
  }
  return states
}

function bluffRate(profile: Profile, seed: number, scores: [number, number] = [0, 0]) {
  const random = rng(seed)
  const states = openingStates(3000)
  let bluffs = 0
  for (const s of states) {
    const d = decide({ ...s, scores }, 1, profile, random)
    if (d.deceit) bluffs++
  }
  return bluffs / states.length
}

describe('personalidad del rival', () => {
  it('con la misma semilla decide siempre lo mismo', () => {
    const s = openingStates(1)[0]!
    const a = decide(s, 1, maestro, rng(5))
    const b = decide(s, 1, maestro, rng(5))
    expect(a).toEqual(b)
  })

  it('el principiante casi nunca blufea', () => {
    expect(bluffRate(pibe, 1)).toBeLessThan(0.02)
    expect(bluffRate(pibe, 2, [3, 11])).toBeLessThan(0.02)
  })

  it('el experto blufea con una frecuencia razonable (ni nunca ni siempre)', () => {
    const rate = bluffRate(maestro, 3)
    expect(rate).toBeGreaterThan(0.1)
    expect(rate).toBeLessThan(0.45)
  })

  it('cada nivel es más mentiroso que el anterior', () => {
    const a = bluffRate(pibe, 4)
    const b = bluffRate(rosa, 4)
    const c = bluffRate(maestro, 4)
    expect(b).toBeGreaterThan(a)
    expect(c).toBeGreaterThan(b)
  })

  it('el experto se la juega más cuando va perdiendo que cuando va ganando', () => {
    // El rival de la IA es el asiento 1: [12, 2] = va perdiendo, [2, 12] = va ganando.
    const losing = bluffRate(maestro, 5, [12, 2])
    const winning = bluffRate(maestro, 5, [2, 12])
    expect(losing).toBeGreaterThan(winning)
  })

  it('el riesgo sube si va perdiendo y baja si va ganando; el principiante no lo siente', () => {
    const s = openingStates(1)[0]!
    expect(riskMultiplier({ ...s, scores: [12, 2] }, 1, maestro)).toBeGreaterThan(1)
    expect(riskMultiplier({ ...s, scores: [2, 12] }, 1, maestro)).toBeLessThan(1)
    expect(riskMultiplier({ ...s, scores: [12, 2] }, 1, pibe)).toBe(1)
  })

  it('el experto a veces canta falta envido sin tener tanto; el principiante, nunca', () => {
    const faltaBluffs = (profile: Profile) => {
      const random = rng(9)
      let n = 0
      for (const s of openingStates(3000)) {
        const d = decide(s, 1, profile, random)
        if (d.deceit && d.action.t === 'envido' && d.action.call === 'falta') n++
      }
      return n
    }
    expect(faltaBluffs(maestro)).toBeGreaterThan(20)
    expect(faltaBluffs(pibe)).toBe(0)
  })

  it('el experto miente al responder y el principiante no', () => {
    const lies = (profile: Profile) => {
      const random = rng(13)
      let n = 0
      for (const base of openingStates(1500)) {
        // El jugador (asiento 0) canta truco al rival, que tiene que responder.
        const s: TrucoState = {
          ...base,
          phase: 'respond',
          turn: 1,
          pending: { kind: 'truco', from: 0, level: 1 },
          scores: [8, 8],
        }
        const d = decide(s, 1, profile, random)
        if (d.deceit === 'lie') n++
      }
      return n
    }
    expect(lies(maestro)).toBeGreaterThan(30)
    expect(lies(pibe)).toBeLessThan(15)
  })

  it('el experto se va al mazo cuando la mano está perdida y el principiante nunca', () => {
    const folds = (profile: Profile) => {
      const random = rng(21)
      let n = 0
      for (const base of openingStates(1500)) {
        // Perdió la primera baza y le queda una carta floja con el truco cantado.
        const s: TrucoState = {
          ...base,
          trucoLevel: 1,
          trucoLast: 0,
          tricks: [0],
          hands: [
            base.hands[0].slice(0, 2),
            [
              { suit: 'copa', n: 4 },
              { suit: 'basto', n: 5 },
            ],
          ],
          table: [[base.hands[0][0]!], [{ suit: 'oro', n: 3 }]],
          turn: 1,
        }
        if (decide(s, 1, profile, random).action.t === 'fold') n++
      }
      return n
    }
    expect(folds(maestro)).toBeGreaterThan(50)
    expect(folds(pibe)).toBe(0)
  })
})
