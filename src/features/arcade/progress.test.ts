import { STAGE_COUNT } from '@engine/config.ts'
import {
  addCoins,
  getCoins,
  spendCoins,
  unlockAfterWin,
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
    expect(unlockRacing(3)).toBe(3)
    expect(unlockedTrack()).toBe(3)
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
