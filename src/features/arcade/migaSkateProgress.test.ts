import { migaSkateStars, saveMigaSkateStars, unlockedMigaSkate } from './progress'
import { SPOT_COUNT } from '@/games/migaskate/spots'

describe('avance de Miga Skate', () => {
  beforeEach(() => localStorage.clear())

  it('arranca con el primer spot abierto y sin estrellas', () => {
    expect(migaSkateStars()).toEqual(Array(5).fill(0))
    expect(unlockedMigaSkate()).toBe(1)
  })

  it('hay un casillero de estrellas por cada spot del juego', () => {
    expect(migaSkateStars()).toHaveLength(SPOT_COUNT)
  })

  it('una estrella abre el siguiente spot y la mejor marca no baja', () => {
    saveMigaSkateStars(1, 1)
    expect(unlockedMigaSkate()).toBe(2)
    saveMigaSkateStars(1, 3)
    saveMigaSkateStars(1, 2)
    expect(migaSkateStars()[0]).toBe(3)
    saveMigaSkateStars(2, 1)
    saveMigaSkateStars(3, 2)
    expect(unlockedMigaSkate()).toBe(4)
  })

  it('no se salta spots aunque haya estrellas más adelante, y tolera datos rotos', () => {
    saveMigaSkateStars(5, 3)
    expect(unlockedMigaSkate()).toBe(1)
    localStorage.setItem('arcade_migaskate_stars', '[[[')
    expect(migaSkateStars()).toEqual(Array(5).fill(0))
  })

  it('recorta valores fuera de rango', () => {
    saveMigaSkateStars(1, 9)
    saveMigaSkateStars(99, 2)
    expect(migaSkateStars()).toEqual([3, 0, 0, 0, 2])
  })
})
