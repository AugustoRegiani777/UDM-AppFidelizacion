// Baraja española de 40 cartas y sus valores en el truco.

export type Suit = 'oro' | 'copa' | 'espada' | 'basto'
export const SUITS: readonly Suit[] = ['oro', 'copa', 'espada', 'basto']
export const NUMBERS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12]

export interface Card {
  suit: Suit
  n: number
}

export function fullDeck(): Card[] {
  return SUITS.flatMap((suit) => NUMBERS.map((n) => ({ suit, n })))
}

export const cardId = (card: Card) => `${card.n}-${card.suit}`

export const sameCard = (a: Card, b: Card) => a.n === b.n && a.suit === b.suit

/** Jerarquía del truco: 14 = el ancho de espadas (la más brava), 1 = los cuatros. */
export function trucoRank(card: Card): number {
  const { n, suit } = card
  if (n === 1 && suit === 'espada') return 14
  if (n === 1 && suit === 'basto') return 13
  if (n === 7 && suit === 'espada') return 12
  if (n === 7 && suit === 'oro') return 11
  if (n === 3) return 10
  if (n === 2) return 9
  if (n === 1) return 8 // ancho falso: copa y oro
  if (n === 12) return 7
  if (n === 11) return 6
  if (n === 10) return 5
  if (n === 7) return 4 // sietes falsos: copa y basto
  if (n === 6) return 3
  if (n === 5) return 2
  return 1
}

/** Valor de una carta para el envido: las figuras no suman. */
export const envidoValue = (card: Card) => (card.n >= 10 ? 0 : card.n)

/** Tanto de una mano: 20 + las dos más altas del mismo palo, o la carta más alta si no hay pares. */
export function envidoPoints(hand: readonly Card[]): number {
  let best = 0
  for (const card of hand) best = Math.max(best, envidoValue(card))
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const a = hand[i]!
      const b = hand[j]!
      if (a.suit === b.suit) best = Math.max(best, 20 + envidoValue(a) + envidoValue(b))
    }
  }
  return best
}

export const cardName = (card: Card) =>
  `${card.n} de ${card.suit === 'oro' ? 'oro' : card.suit === 'copa' ? 'copa' : card.suit === 'espada' ? 'espada' : 'basto'}`
