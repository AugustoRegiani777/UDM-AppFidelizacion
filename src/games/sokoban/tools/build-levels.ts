// Busca los niveles de "Entregas de Miga".
// Uso:
//   node src/games/sokoban/tools/build-levels.ts <nivel>      busca UN nivel y lo guarda en tools/out/
//   node src/games/sokoban/tools/build-levels.ts juntar       arma levels.data.ts con los 12 encontrados
// Cada candidato se genera jugando "al revés" (siempre tiene solución), se resuelve con el solver, y de todos
// se queda el que más empujes necesita (el más difícil) dentro del tiempo disponible.

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { parseLevel } from '../engine.ts'
import { solve } from '../solver.ts'
import { generate, rngFrom, type Spec } from './generate.ts'

interface Target extends Spec {
  /** Empujes mínimos deseados (si se llega, se sigue buscando uno mejor un rato más). */
  want: number
  seconds: number
  limit: number
}

const TARGETS: Target[] = [
  { w: 6, h: 5, boxes: 1, blocks: 1, steps: 8, want: 5, seconds: 8, limit: 60_000 },
  { w: 7, h: 6, boxes: 2, blocks: 2, steps: 8, want: 9, seconds: 20, limit: 100_000 },
  { w: 7, h: 7, boxes: 2, blocks: 3, steps: 10, want: 12, seconds: 25, limit: 150_000 },
  { w: 8, h: 7, boxes: 3, blocks: 3, steps: 10, want: 14, seconds: 40, limit: 250_000 },
  { w: 8, h: 8, boxes: 3, blocks: 4, steps: 12, want: 17, seconds: 50, limit: 300_000 },
  { w: 9, h: 7, boxes: 4, blocks: 4, steps: 12, want: 18, seconds: 70, limit: 400_000 },
  { w: 9, h: 8, boxes: 4, blocks: 5, steps: 14, want: 22, seconds: 80, limit: 500_000 },
  { w: 9, h: 9, boxes: 4, blocks: 6, steps: 16, want: 26, seconds: 90, limit: 500_000 },
  { w: 10, h: 8, boxes: 5, blocks: 6, steps: 16, want: 24, seconds: 100, limit: 600_000 },
  { w: 10, h: 9, boxes: 5, blocks: 7, steps: 18, want: 28, seconds: 110, limit: 600_000 },
  { w: 10, h: 10, boxes: 5, blocks: 8, steps: 20, want: 32, seconds: 120, limit: 700_000 },
  { w: 11, h: 10, boxes: 6, blocks: 9, steps: 22, want: 34, seconds: 140, limit: 700_000 },
]

const OUT = new URL('./out/', import.meta.url)

interface Picked {
  rows: string[]
  keys: string
  pushes: number
  moves: number
  states: number
}

function search(index: number): Picked | null {
  const target = TARGETS[index]!
  const started = Date.now()
  let best: Picked | null = null
  let tried = 0
  for (let n = 0; ; n++) {
    const elapsed = (Date.now() - started) / 1000
    if (elapsed > target.seconds) break
    // Cuando ya se llegó a lo deseado, se busca un rato más (la mitad del tiempo) y se corta.
    if (best && best.pushes >= target.want && elapsed > target.seconds / 2) break
    const rng = rngFrom((index + 1) * 100_003 + n * 7919)
    const candidate = generate(target, rng)
    if (!candidate) continue
    tried++
    const solution = solve(parseLevel(candidate.rows), target.limit)
    if (!solution) continue
    const better =
      !best ||
      solution.pushes > best.pushes ||
      (solution.pushes === best.pushes && solution.states > best.states)
    if (better) {
      best = {
        rows: candidate.rows,
        keys: solution.keys,
        pushes: solution.pushes,
        moves: solution.moves,
        states: solution.states,
      }
    }
  }
  console.log(
    `nivel ${index + 1}: ${best ? `empujes ${best.pushes} (querido ${target.want}), movimientos ${best.moves}, estados ${best.states}` : 'SIN RESULTADO'}; candidatos ${tried}; ${((Date.now() - started) / 1000).toFixed(0)} s`,
  )
  return best
}

const arg = process.argv[2]
mkdirSync(OUT, { recursive: true })

if (arg === 'juntar') {
  const picked: Picked[] = []
  for (let i = 1; i <= TARGETS.length; i++) {
    const file = new URL(`level-${i}.json`, OUT)
    if (!existsSync(file)) throw new Error(`falta el nivel ${i}: corré build-levels.ts ${i}`)
    picked.push(JSON.parse(readFileSync(file, 'utf8')) as Picked)
  }
  const body = picked
    .map(
      (p) =>
        `  {\n    rows: ${JSON.stringify(p.rows)},\n    keys: '${p.keys}',\n    pushes: ${p.pushes},\n    moves: ${p.moves},\n  },`,
    )
    .join('\n')
  writeFileSync(
    new URL('../levels.data.ts', import.meta.url),
    `// Generado por tools/build-levels.ts. No editar a mano.\n\nexport interface LevelData {\n  rows: string[]\n  /** Solución con la menor cantidad de empujes. */\n  keys: string\n  pushes: number\n  moves: number\n}\n\nexport const LEVEL_DATA: LevelData[] = [\n${body}\n]\n`,
  )
  console.log('escrito levels.data.ts')
} else {
  const index = Number(arg) - 1
  if (!(index >= 0 && index < TARGETS.length)) throw new Error('indicá un nivel del 1 al 12 o "juntar"')
  const best = search(index)
  if (best) writeFileSync(new URL(`level-${index + 1}.json`, OUT), JSON.stringify(best))
}
