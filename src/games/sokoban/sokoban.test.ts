// @vitest-environment node
import { Board, parseLevel, starsFor } from './engine.ts'
import { LEVELS, LEVEL_COUNT } from './levels.ts'
import { pushDistances, solve, walkTo } from './solver.ts'
import { THEMES } from './themes.ts'

const board = (...rows: string[]) => new Board(parseLevel(rows))

describe('mapas', () => {
  it('lee paredes, entregas, cajas y jugador', () => {
    const b = board('#####', '#@$.#', '#####')
    expect(b.player).toBe(6)
    expect(b.boxes).toEqual([7])
    expect(b.layout.goal[8]).toBe(true)
    expect(b.layout.wall[0]).toBe(true)
  })

  it('una caja sobre la entrega (*) y el jugador sobre una entrega (+) cuentan las dos cosas', () => {
    const b = board('######', '#+ $ #', '######')
    expect(b.layout.goal[7]).toBe(true)
    expect(b.player).toBe(7)
    const c = board('#####', '#@*$.#', '######')
    expect(c.boxesOnGoal).toBe(1)
  })

  it('rechaza mapas mal armados', () => {
    expect(() => parseLevel(['#####', '# $.#', '#####'])).toThrow(/jugador/)
    expect(() => parseLevel(['#####', '#@ .#', '#####'])).toThrow(/cajas/)
    expect(() => parseLevel(['#######', '#@$ $.#', '#######'])).toThrow(/tantas entregas/)
  })

  it('el piso al que no se llega es "afuera" (decorado)', () => {
    const layout = parseLevel(['#######', '#@$.# #', '#######'])
    expect(layout.inside[8]).toBe(true)
    expect(layout.inside[12]).toBe(false)
  })
})

describe('reglas', () => {
  it('empujar una caja la mueve y cuenta un movimiento y un empuje', () => {
    const b = board('######', '#@$ .#', '######')
    const result = b.move('R')
    expect(result?.pushed).toEqual({ from: 8, to: 9 })
    expect(b.boxes).toEqual([9])
    expect(b.player).toBe(8)
    expect(b.moves).toBe(1)
    expect(b.pushes).toBe(1)
    expect(result?.landed).toBe(false)
    expect(b.move('R')?.landed).toBe(true)
    expect(b.solved).toBe(true)
  })

  it('no se puede pasar por una pared ni salir del mapa', () => {
    const b = board('######', '#@$ .#', '######')
    expect(b.move('U')).toBeNull()
    expect(b.move('L')).toBeNull()
    expect(b.moves).toBe(0)
  })

  it('no se puede empujar una caja contra una pared', () => {
    const d = board('#####', '#@$##', '#.  #', '#####')
    expect(d.move('R')).toBeNull()
    expect(d.boxes).toEqual([7])
  })

  it('no se pueden empujar dos cajas juntas', () => {
    const b = board('#######', '#@$$ .#', '#.    #', '#######')
    expect(b.move('R')).toBeNull()
    expect(b.moves).toBe(0)
  })

  it('no se puede tirar de una caja: alejarse no la arrastra', () => {
    const b = board('######', '#$@ .#', '######')
    expect(b.move('R')).not.toBeNull()
    expect(b.boxes).toEqual([7])
  })

  it('deshacer devuelve todo a como estaba, caja incluida', () => {
    const b = board('#######', '#@$  .#', '#######')
    b.play('RR')
    expect(b.boxes).toEqual([11])
    expect(b.undo()?.pushed).not.toBeNull()
    expect(b.boxes).toEqual([10])
    expect(b.moves).toBe(1)
    expect(b.pushes).toBe(1)
    b.undo()
    expect(b.boxes).toEqual([9])
    expect(b.player).toBe(8)
    expect(b.moves).toBe(0)
    expect(b.canUndo).toBe(false)
    expect(b.undo()).toBeNull()
  })

  it('reiniciar vuelve al comienzo', () => {
    const b = board('#######', '#@$  .#', '#######')
    b.play('RRR')
    b.reset()
    expect(b.boxes).toEqual(b.layout.startBoxes)
    expect(b.player).toBe(b.layout.startPlayer)
    expect(b.moves).toBe(0)
  })

  it('las estrellas dependen de los movimientos respecto de la marca', () => {
    expect(starsFor(100, 100)).toBe(3)
    expect(starsFor(115, 100)).toBe(3)
    expect(starsFor(116, 100)).toBe(2)
    expect(starsFor(170, 100)).toBe(2)
    expect(starsFor(171, 100)).toBe(1)
    expect(starsFor(1000, 100)).toBe(1)
  })
})

describe('resolvedor', () => {
  it('resuelve un nivel simple con la menor cantidad de empujes', () => {
    const layout = parseLevel(['#######', '#     #', '#@$  .#', '#######'])
    const solution = solve(layout)!
    expect(solution.pushes).toBe(3)
    expect(solution.keys).toBe('RRR')
    const b = new Board(layout)
    b.play(solution.keys)
    expect(b.solved).toBe(true)
    expect(b.moves).toBe(solution.moves)
  })

  it('un nivel imposible da null (caja en un rincón sin entrega)', () => {
    const layout = parseLevel(['######', '#$   #', '#@  .#', '######'])
    expect(solve(layout)).toBeNull()
    expect(pushDistances(layout)[7]).toBe(Infinity)
  })

  it('el camino a pie esquiva cajas y paredes', () => {
    const layout = parseLevel(['#####', '#@$.#', '#   #', '#####'])
    const path = walkTo(layout, layout.startPlayer, 8, layout.startBoxes)!
    expect(path.length).toBe(4)
    expect(walkTo(layout, layout.startPlayer, 0, layout.startBoxes)).toBeNull()
  })
})

describe('niveles', { timeout: 60_000 }, () => {
  it('hay 12 niveles', () => {
    expect(LEVEL_COUNT).toBe(12)
    expect(LEVELS).toHaveLength(12)
  })

  it.each(LEVELS.map((level) => [level.id, level] as const))(
    'el nivel %i se gana reproduciendo su solución, con la marca anotada',
    (_, level) => {
      const b = new Board(level.layout)
      const done = b.play(level.keys)
      expect(done).toBe(level.keys.length) // ningún paso de la solución es ilegal
      expect(b.solved).toBe(true)
      expect(b.moves).toBe(level.par)
      expect(b.pushes).toBe(level.pushes)
      expect(starsFor(b.moves, level.par)).toBe(3)
    },
  )

  it('ningún nivel arranca resuelto ni con cajas en callejones sin salida', () => {
    for (const level of LEVELS) {
      const b = new Board(level.layout)
      expect(b.solved).toBe(false)
      const dist = pushDistances(level.layout)
      expect(level.layout.startBoxes.every((box) => dist[box] !== Infinity)).toBe(true)
    }
  })

  it('la dificultad sube: más cajas y más empujes a medida que avanzan', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      const prev = LEVELS[i - 1]!
      const level = LEVELS[i]!
      expect(level.layout.startBoxes.length).toBeGreaterThanOrEqual(prev.layout.startBoxes.length)
      // Dificultad: cada caja pesa más que un empuje, porque se estorban entre sí.
      const score = (l: typeof level) => l.pushes + 4 * l.layout.startBoxes.length
      expect(score(level)).toBeGreaterThanOrEqual(score(prev))
    }
    expect(LEVELS[0]!.layout.startBoxes.length).toBe(1)
    expect(LEVELS[LEVELS.length - 1]!.layout.startBoxes.length).toBeGreaterThanOrEqual(5)
  })

  it('el resolvedor confirma los empujes mínimos de los niveles chicos', () => {
    for (const level of LEVELS.filter((l) => l.layout.startBoxes.length <= 3)) {
      expect(solve(level.layout)!.pushes).toBe(level.pushes)
    }
  })
})

describe('escenarios y vehículos', () => {
  it('cada nivel tiene su escenario propio y se usan los cuatro vehículos', () => {
    expect(new Set(LEVELS.map((l) => l.theme.id)).size).toBe(12)
    const vehicles = new Set(LEVELS.map((l) => l.theme.vehicle))
    expect(vehicles).toEqual(new Set(['car', 'moto', 'boat', 'heli']))
    for (const vehicle of vehicles) {
      expect(LEVELS.filter((l) => l.theme.vehicle === vehicle).length).toBeGreaterThanOrEqual(3)
    }
  })

  it('los niveles de lancha son sobre agua y los de helicóptero no', () => {
    for (const theme of THEMES) {
      const water = theme.floor === 'water' || theme.floor === 'lagoon'
      expect(water).toBe(theme.vehicle === 'boat')
    }
  })

  it('un escenario no repite el mismo vehículo en dos niveles seguidos', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i]!.theme.vehicle).not.toBe(LEVELS[i - 1]!.theme.vehicle)
    }
  })
})
