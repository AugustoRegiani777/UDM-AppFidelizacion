// Los 10 niveles de "Miga Ninja": misma mecánica, cada vez más velocidad, más objetos por oleada,
// patrones nuevos, hormigas más frecuentes y objetos especiales. Los objetivos son de puntaje o de cortes.

import type { GoodKind, PatternId } from './engine.ts'

export type SceneId =
  | 'counter'
  | 'vitrine'
  | 'bakery'
  | 'espresso'
  | 'plaza'
  | 'market'
  | 'beach'
  | 'arts'
  | 'fallas'
  | 'finale'

export interface LevelDef {
  id: number
  scene: SceneId
  /** Duración del nivel en segundos. */
  seconds: number
  /** Cosas buenas que se pueden dejar caer antes de terminar. */
  lives: number
  /** Velocidad general del tiempo (1 = normal). */
  speed: number
  /** Segundos entre oleadas al empezar, y cuánto se acorta hacia el final (multiplicador). */
  interval: number
  rampTo: number
  waveMin: number
  waveMax: number
  patterns: PatternId[]
  kinds: GoodKind[]
  /** Probabilidad de que un objeto sea una hormiga. */
  bombChance: number
  /** Probabilidad por oleada de que aparezca un cinnamon dorado / un café frío. */
  golden: number
  ice: number
  goal: { type: 'score' | 'cuts'; target: number }
  /** Puntaje para la 2.ª y la 3.ª estrella (la 1.ª es cumplir el objetivo). */
  stars: [number, number]
}

const ALL: GoodKind[] = ['sandwich', 'medialuna', 'chipa', 'cinnamon', 'cafe']

export const LEVELS: readonly LevelDef[] = [
  {
    id: 1,
    scene: 'counter',
    seconds: 40,
    lives: 5,
    speed: 0.9,
    interval: 1.7,
    rampTo: 0.8,
    waveMin: 1,
    waveMax: 2,
    patterns: ['single', 'single', 'pair'],
    kinds: ['sandwich', 'medialuna', 'cafe'],
    bombChance: 0,
    golden: 0,
    ice: 0,
    goal: { type: 'score', target: 150 },
    stars: [260, 360],
  },
  {
    id: 2,
    scene: 'vitrine',
    seconds: 45,
    lives: 5,
    speed: 0.95,
    interval: 1.55,
    rampTo: 0.8,
    waveMin: 2,
    waveMax: 3,
    patterns: ['pair', 'volley', 'fan'],
    kinds: ['sandwich', 'medialuna', 'chipa', 'cafe'],
    bombChance: 0.06,
    golden: 0,
    ice: 0,
    goal: { type: 'cuts', target: 28 },
    stars: [380, 640],
  },
  {
    id: 3,
    scene: 'bakery',
    seconds: 50,
    lives: 5,
    speed: 1,
    interval: 1.5,
    rampTo: 0.78,
    waveMin: 2,
    waveMax: 4,
    patterns: ['pair', 'fan', 'sweep', 'cross'],
    kinds: ALL,
    bombChance: 0.1,
    golden: 0.35,
    ice: 0,
    goal: { type: 'score', target: 700 },
    stars: [1300, 2200],
  },
  {
    id: 4,
    scene: 'espresso',
    seconds: 55,
    lives: 5,
    speed: 1.05,
    interval: 1.4,
    rampTo: 0.75,
    waveMin: 3,
    waveMax: 4,
    patterns: ['volley', 'fan', 'sweep', 'fountain'],
    kinds: ALL,
    bombChance: 0.13,
    golden: 0.3,
    ice: 0.35,
    goal: { type: 'cuts', target: 70 },
    stars: [1500, 2500],
  },
  {
    id: 5,
    scene: 'plaza',
    seconds: 60,
    lives: 5,
    speed: 1.1,
    interval: 1.35,
    rampTo: 0.72,
    waveMin: 3,
    waveMax: 5,
    patterns: ['fan', 'cross', 'sweep', 'fountain', 'rain'],
    kinds: ALL,
    bombChance: 0.15,
    golden: 0.3,
    ice: 0.3,
    goal: { type: 'score', target: 1500 },
    stars: [2500, 3800],
  },
  {
    id: 6,
    scene: 'market',
    seconds: 60,
    lives: 4,
    speed: 1.15,
    interval: 1.3,
    rampTo: 0.7,
    waveMin: 3,
    waveMax: 5,
    patterns: ['volley', 'cross', 'fountain', 'rain', 'sweep'],
    kinds: ALL,
    bombChance: 0.18,
    golden: 0.3,
    ice: 0.3,
    goal: { type: 'cuts', target: 100 },
    stars: [2800, 4800],
  },
  {
    id: 7,
    scene: 'beach',
    seconds: 65,
    lives: 4,
    speed: 1.2,
    interval: 1.25,
    rampTo: 0.7,
    waveMin: 4,
    waveMax: 6,
    patterns: ['fan', 'fountain', 'rain', 'cross', 'volley'],
    kinds: ALL,
    bombChance: 0.2,
    golden: 0.3,
    ice: 0.3,
    goal: { type: 'score', target: 2800 },
    stars: [4500, 7000],
  },
  {
    id: 8,
    scene: 'arts',
    seconds: 65,
    lives: 4,
    speed: 1.25,
    interval: 1.2,
    rampTo: 0.68,
    waveMin: 4,
    waveMax: 6,
    patterns: ['rain', 'fountain', 'sweep', 'cross', 'fan'],
    kinds: ALL,
    bombChance: 0.22,
    golden: 0.3,
    ice: 0.3,
    goal: { type: 'cuts', target: 140 },
    stars: [5000, 8500],
  },
  {
    id: 9,
    scene: 'fallas',
    seconds: 70,
    lives: 4,
    speed: 1.3,
    interval: 1.15,
    rampTo: 0.66,
    waveMin: 4,
    waveMax: 7,
    patterns: ['rain', 'fountain', 'volley', 'cross', 'sweep', 'fan'],
    kinds: ALL,
    bombChance: 0.24,
    golden: 0.3,
    ice: 0.3,
    goal: { type: 'score', target: 4000 },
    stars: [6000, 10000],
  },
  {
    id: 10,
    scene: 'finale',
    seconds: 75,
    lives: 4,
    speed: 1.4,
    interval: 1.1,
    rampTo: 0.62,
    waveMin: 5,
    waveMax: 8,
    patterns: ['rain', 'fountain', 'volley', 'cross', 'sweep', 'fan'],
    kinds: ALL,
    bombChance: 0.26,
    golden: 0.35,
    ice: 0.3,
    goal: { type: 'score', target: 5500 },
    stars: [9000, 14000],
  },
]

export const LEVEL_COUNT = LEVELS.length

export function levelAt(id: number): LevelDef {
  return LEVELS[Math.min(LEVEL_COUNT, Math.max(1, Math.floor(id))) - 1]!
}
