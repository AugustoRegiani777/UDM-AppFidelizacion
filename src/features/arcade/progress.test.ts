import { STAGE_COUNT } from '@engine/config.ts'
import {
  addCoins,
  getCoins,
  parkStars,
  saveParkStars,
  saveSokobanStars,
  sokobanStars,
  spendCoins,
  unlockAfterWin,
  unlockedPark,
  unlockedSokoban,
  unlockedStage,
  unlockedTrack,
  unlockRacing,
} from './progress'

describe('avance de la sala de juegos', () => {
  beforeEach(() => localStorage.clear())

  it('arranca con el nivel 1 abierto', () => {
    expect(unlockedStage()).toBe(1)
  })

  it('ganar un nivel abre el siguiente y no retrocede', () => {
    expect(unlockAfterWin(1)).toBe(2)
    expect(unlockAfterWin(3)).toBe(4)
    expect(unlockAfterWin(1)).toBe(4)
    expect(unlockedStage()).toBe(4)
  })

  it('no pasa del último nivel y tolera valores rotos', () => {
    expect(unlockAfterWin(STAGE_COUNT)).toBe(STAGE_COUNT)
    localStorage.setItem('arcade_survivors_unlocked', 'basura')
    expect(unlockedStage()).toBe(1)
  })
})

describe('avance de las carreras', () => {
  beforeEach(() => localStorage.clear())

  it('arranca con la pista 1 y el podio abre la siguiente sin retroceder', () => {
    expect(unlockedTrack()).toBe(1)
    expect(unlockRacing(1)).toBe(2)
    expect(unlockRacing(1)).toBe(2)
    expect(unlockRacing(2)).toBe(3)
    expect(unlockRacing(3)).toBe(4)
    expect(unlockRacing(4)).toBe(5)
    expect(unlockRacing(5)).toBe(5)
    expect(unlockedTrack()).toBe(5)
  })
})

describe('monedas de la sala de juegos', () => {
  beforeEach(() => localStorage.clear())

  it('suman, se gastan si alcanzan y nunca quedan negativas', () => {
    expect(getCoins()).toBe(0)
    expect(addCoins(5)).toBe(5)
    expect(spendCoins(3)).toBe(true)
    expect(getCoins()).toBe(2)
    expect(spendCoins(3)).toBe(false)
    expect(getCoins()).toBe(2)
    expect(addCoins(-4)).toBe(2)
  })
})

describe('avance de Skate Spot', () => {
  beforeEach(() => localStorage.clear())

  it('guarda la mejor marca y abre el nivel siguiente con una estrella', () => {
    expect(parkStars()).toEqual([0, 0, 0, 0, 0])
    expect(unlockedPark()).toBe(1)
    saveParkStars(1, 2)
    saveParkStars(1, 1)
    expect(parkStars()[0]).toBe(2)
    expect(unlockedPark()).toBe(2)
    saveParkStars(2, 0)
    expect(unlockedPark()).toBe(2)
    saveParkStars(2, 3)
    expect(unlockedPark()).toBe(3)
  })

  it('tolera datos rotos', () => {
    localStorage.setItem('arcade_skatepark_stars', '{no es json')
    expect(parkStars()).toEqual([0, 0, 0, 0, 0])
    localStorage.setItem('arcade_skatepark_stars', JSON.stringify([9, 'x', -2]))
    expect(parkStars()).toEqual([3, 0, 0, 0, 0])
  })
})

describe('avance de Entregas de Miga', () => {
  beforeEach(() => localStorage.clear())

  it('terminar un nivel abre el siguiente y se guarda la mejor marca', () => {
    expect(sokobanStars()).toEqual(Array(12).fill(0))
    expect(unlockedSokoban()).toBe(1)
    saveSokobanStars(1, 1)
    expect(unlockedSokoban()).toBe(2)
    saveSokobanStars(1, 3)
    saveSokobanStars(1, 2)
    expect(sokobanStars()[0]).toBe(3)
    saveSokobanStars(2, 1)
    saveSokobanStars(3, 2)
    expect(unlockedSokoban()).toBe(4)
  })

  it('no se salta niveles aunque haya estrellas más adelante, y tolera datos rotos', () => {
    saveSokobanStars(5, 3)
    expect(unlockedSokoban()).toBe(1)
    localStorage.setItem('arcade_sokoban_stars', '[[[')
    expect(sokobanStars()).toEqual(Array(12).fill(0))
  })
})
