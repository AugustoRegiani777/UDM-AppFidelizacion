import type { Card, Suit } from './cards.ts'

const INK = '#2a1a14'

const SUIT_COLOR: Record<Suit, string> = {
  oro: '#b07a00',
  copa: '#c8102e',
  espada: '#2f5d8a',
  basto: '#4f6f23',
}

/** Posiciones de los emblemas según el número (en una carta de 100 x 150). */
const LAYOUT: Record<number, readonly (readonly [number, number])[]> = {
  1: [[50, 75]],
  2: [
    [50, 42],
    [50, 108],
  ],
  3: [
    [50, 34],
    [50, 75],
    [50, 116],
  ],
  4: [
    [31, 46],
    [69, 46],
    [31, 104],
    [69, 104],
  ],
  5: [
    [31, 42],
    [69, 42],
    [50, 75],
    [31, 108],
    [69, 108],
  ],
  6: [
    [31, 38],
    [69, 38],
    [31, 75],
    [69, 75],
    [31, 112],
    [69, 112],
  ],
  7: [
    [31, 38],
    [69, 38],
    [50, 56],
    [31, 78],
    [69, 78],
    [31, 114],
    [69, 114],
  ],
  10: [[50, 75]],
  11: [[50, 75]],
  12: [[50, 75]],
}

function Emblem({ suit, x, y, scale }: { suit: Suit; x: number; y: number; scale: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {suit === 'oro' && (
        <>
          <circle r="17" fill="#f4c430" stroke="#8a5a00" strokeWidth="2" />
          <circle r="11" fill="none" stroke="#8a5a00" strokeWidth="1.5" />
          <circle r="4" fill="#fff1b0" />
        </>
      )}
      {suit === 'copa' && (
        <>
          <path
            d="M-15,-14 H15 Q15,6 0,9 Q-15,6 -15,-14 Z"
            fill="#c8102e"
            stroke={INK}
            strokeWidth="1.6"
          />
          <path d="M-9,-10 Q-9,0 -3,4" fill="none" stroke="#ff9a9a" strokeWidth="2" />
          <rect x="-2.5" y="9" width="5" height="9" fill="#c8102e" stroke={INK} strokeWidth="1.4" />
          <rect
            x="-10"
            y="18"
            width="20"
            height="4"
            rx="2"
            fill="#c8102e"
            stroke={INK}
            strokeWidth="1.4"
          />
        </>
      )}
      {suit === 'espada' && (
        <>
          <path d="M0,-22 L5,-10 V12 H-5 V-10 Z" fill="#d9e2ee" stroke={INK} strokeWidth="1.6" />
          <path d="M0,-18 V10" stroke="#8fa3bb" strokeWidth="1.4" />
          <rect
            x="-13"
            y="12"
            width="26"
            height="5"
            rx="2"
            fill="#b9892b"
            stroke={INK}
            strokeWidth="1.4"
          />
          <rect x="-3" y="17" width="6" height="8" fill="#7a4b25" stroke={INK} strokeWidth="1.4" />
        </>
      )}
      {suit === 'basto' && (
        <g transform="rotate(24)">
          <rect
            x="-5"
            y="-20"
            width="10"
            height="42"
            rx="5"
            fill="#7a4b25"
            stroke={INK}
            strokeWidth="1.6"
          />
          <circle cx="0" cy="-17" r="8" fill="#5f8a2e" stroke={INK} strokeWidth="1.5" />
          <circle cx="-4" cy="2" r="2" fill="#5b3b2e" />
          <circle cx="4" cy="10" r="2" fill="#5b3b2e" />
        </g>
      )}
    </g>
  )
}

const FACE_NAME: Record<number, string> = { 10: 'SOTA', 11: 'CABALLO', 12: 'REY' }

interface CardViewProps {
  card?: Card
  back?: boolean
  className?: string
  highlight?: boolean
}

/** Carta de la baraja española dibujada en SVG (el dorso lleva el sanguchito de la marca). */
export function CardView({ card, back, className = '', highlight }: CardViewProps) {
  const label = back || !card ? 'Carta boca abajo' : `${card.n} de ${card.suit}`
  return (
    <svg
      viewBox="0 0 100 150"
      className={`${className} ${highlight ? 'drop-shadow-[0_0_6px_rgba(247,201,72,0.95)]' : 'drop-shadow-md'}`}
      role="img"
      aria-label={label}
    >
      {back || !card ? (
        <>
          <rect
            x="2"
            y="2"
            width="96"
            height="146"
            rx="9"
            fill="#c8102e"
            stroke={INK}
            strokeWidth="2.5"
          />
          <rect
            x="9"
            y="9"
            width="82"
            height="132"
            rx="6"
            fill="none"
            stroke="#fff6e0"
            strokeWidth="2"
          />
          <path
            d="M9,60 L91,20 M9,100 L91,60 M9,140 L91,100 M9,20 L50,9"
            stroke="#e24a63"
            strokeWidth="6"
            opacity="0.5"
          />
          <text x="50" y="86" textAnchor="middle" fontSize="38">
            🥪
          </text>
        </>
      ) : (
        <>
          <rect
            x="2"
            y="2"
            width="96"
            height="146"
            rx="9"
            fill="#fff6e0"
            stroke={INK}
            strokeWidth="2.5"
          />
          <rect
            x="7"
            y="7"
            width="86"
            height="136"
            rx="6"
            fill="none"
            stroke={SUIT_COLOR[card.suit]}
            strokeWidth="1"
            opacity="0.5"
          />
          {(LAYOUT[card.n] ?? []).map(([x, y], i) => (
            <Emblem
              key={i}
              suit={card.suit}
              x={x}
              y={y}
              scale={card.n === 1 ? 1.75 : card.n >= 10 ? 1.45 : 0.82}
            />
          ))}
          {card.n >= 10 && (
            <text x="50" y="137" textAnchor="middle" fontSize="9" fontWeight="700" fill={INK}>
              {FACE_NAME[card.n]}
            </text>
          )}
          {card.n === 12 && (
            <path
              d="M38,24 L42,32 L50,22 L58,32 L62,24 L62,38 H38 Z"
              fill="#f4c430"
              stroke={INK}
              strokeWidth="1.4"
            />
          )}
          <text x="13" y="24" fontSize="19" fontWeight="800" fill={SUIT_COLOR[card.suit]}>
            {card.n}
          </text>
          <text
            x="87"
            y="140"
            fontSize="19"
            fontWeight="800"
            textAnchor="end"
            fill={SUIT_COLOR[card.suit]}
          >
            {card.n}
          </text>
        </>
      )}
    </svg>
  )
}

/** Marcador de fósforos: cada cinco puntos cierran un cuadrado con su diagonal. */
export function Fosforos({ points, target }: { points: number; target: number }) {
  const groups = Math.ceil(target / 5)
  return (
    <svg viewBox={`0 0 ${groups * 28} 24`} className="h-5" aria-hidden>
      {Array.from({ length: groups }, (_, g) => {
        const n = Math.max(0, Math.min(5, points - g * 5))
        const x = g * 28 + 2
        const sides = [
          [x, 2, x + 20, 2],
          [x + 20, 2, x + 20, 22],
          [x + 20, 22, x, 22],
          [x, 22, x, 2],
          [x, 22, x + 20, 2],
        ]
        return (
          <g key={g}>
            {sides.map(([x1, y1, x2, y2], i) => (
              <line
                key={i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={i < n ? '#fff6e0' : 'rgba(255,246,224,0.18)'}
                strokeWidth="3"
                strokeLinecap="round"
              />
            ))}
          </g>
        )
      })}
    </svg>
  )
}
