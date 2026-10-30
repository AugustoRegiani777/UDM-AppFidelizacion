import { NINJA_LEVELS, ninjaStars, saveNinjaStars, unlockedNinja } from './progress'

describe('avance de Miga Ninja', () => {
  beforeEach(() => localStorage.clear())

  it('arranca sin estrellas y con el nivel 1 abierto', () => {
    expect(ninjaStars()).toEqual(Array.from({ length: NINJA_LEVELS }, () => 0))
    expect(unlockedNinja()).toBe(1)
  })

  it('guarda la mejor marca, sin bajarla, y la acota entre 0 y 3', () => {
    saveNinjaStars(1, 2)
    expect(saveNinjaStars(1, 1)[0]).toBe(2)
    expect(saveNinjaStars(1, 9)[0]).toBe(3)
    expect(saveNinjaStars(2, -4)[1]).toBe(0)
    expect(ninjaStars()[0]).toBe(3)
  })

  it('pasar un nivel abre el siguiente, de a uno, hasta el último', () => {
    saveNinjaStars(1, 1)
    expect(unlockedNinja()).toBe(2)
    saveNinjaStars(3, 3) // saltear no abre nada
    expect(unlockedNinja()).toBe(2)
    for (let i = 1; i <= NINJA_LEVELS; i++) saveNinjaStars(i, 1)
    expect(unlockedNinja()).toBe(NINJA_LEVELS)
  })

  it('tolera almacenamiento roto', () => {
    localStorage.setItem('arcade_ninja_stars', '{no es json')
    expect(unlockedNinja()).toBe(1)
    localStorage.setItem('arcade_ninja_stars', '["x", 2, 99]')
    expect(ninjaStars().slice(0, 3)).toEqual([0, 2, 3])
  })
})
