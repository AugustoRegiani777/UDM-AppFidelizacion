// Escenarios de "Entregas de Miga": cada nivel tiene su lugar, su piso, sus obstáculos, su fondo y su vehículo.
// (Los textos están en copy.sokoban.levels, en el mismo orden.)

export type VehicleId = 'car' | 'moto' | 'boat' | 'heli'

export type FloorStyle =
  'asphalt' | 'tile' | 'water' | 'lagoon' | 'grass' | 'cobble' | 'roof' | 'plaza' | 'sand' | 'night'

export type WallStyle =
  | 'building'
  | 'stall'
  | 'container'
  | 'hedge'
  | 'terrace'
  | 'reeds'
  | 'arch'
  | 'palm'
  | 'house'
  | 'ninot'

export type SceneryId =
  | 'street'
  | 'market'
  | 'port'
  | 'rooftops'
  | 'park'
  | 'barrio'
  | 'lagoon'
  | 'arts'
  | 'beach'
  | 'oldtown'
  | 'rice'
  | 'fallas'

export type AmbientId = 'none' | 'leaves' | 'bubbles' | 'birds' | 'sparks' | 'dust'

export interface Palette {
  /** Cielo / fondo de arriba y de abajo. */
  skyTop: string
  skyBottom: string
  floorA: string
  floorB: string
  wallA: string
  wallB: string
  /** Borde del mapa (vereda, muelle, borde del techo). */
  frame: string
  accent: string
  box: string
  boxDark: string
  goal: string
}

export interface Theme {
  id: SceneryId
  vehicle: VehicleId
  floor: FloorStyle
  wall: WallStyle
  ambient: AmbientId
  night: boolean
  palette: Palette
}

export const THEMES: readonly Theme[] = [
  {
    id: 'street',
    vehicle: 'car',
    floor: 'asphalt',
    wall: 'building',
    ambient: 'dust',
    night: false,
    palette: {
      skyTop: '#9fd3f2',
      skyBottom: '#fff1d0',
      floorA: '#6b6f78',
      floorB: '#62666f',
      wallA: '#e8c27a',
      wallB: '#c8102e',
      frame: '#bdb6a6',
      accent: '#f7c948',
      box: '#c89a5f',
      boxDark: '#8b5e34',
      goal: '#fff6e0',
    },
  },
  {
    id: 'market',
    vehicle: 'moto',
    floor: 'tile',
    wall: 'stall',
    ambient: 'dust',
    night: false,
    palette: {
      skyTop: '#f6e3b8',
      skyBottom: '#fff6e0',
      floorA: '#e9dcc0',
      floorB: '#d8c9a6',
      wallA: '#d6281c',
      wallB: '#fff6e0',
      frame: '#8b5e34',
      accent: '#4c9a5b',
      box: '#d9a653',
      boxDark: '#8f5f1f',
      goal: '#4c9a5b',
    },
  },
  {
    id: 'port',
    vehicle: 'boat',
    floor: 'water',
    wall: 'container',
    ambient: 'bubbles',
    night: false,
    palette: {
      skyTop: '#7fc8ee',
      skyBottom: '#d7f0fb',
      floorA: '#2f8fc0',
      floorB: '#2a82b2',
      wallA: '#c8102e',
      wallB: '#2f5d8a',
      frame: '#8b6a45',
      accent: '#ff9d3c',
      box: '#b98543',
      boxDark: '#7a5326',
      goal: '#ff6b2e',
    },
  },
  {
    id: 'rooftops',
    vehicle: 'heli',
    floor: 'roof',
    wall: 'building',
    ambient: 'birds',
    night: false,
    palette: {
      skyTop: '#8cc7ef',
      skyBottom: '#f4ecd8',
      floorA: '#c9744a',
      floorB: '#bb6a42',
      wallA: '#e8dcc4',
      wallB: '#9aa6b4',
      frame: '#8f4f33',
      accent: '#f7c948',
      box: '#d4a65f',
      boxDark: '#8f6a2a',
      goal: '#fff6e0',
    },
  },
  {
    id: 'park',
    vehicle: 'car',
    floor: 'grass',
    wall: 'hedge',
    ambient: 'leaves',
    night: false,
    palette: {
      skyTop: '#b4e1f5',
      skyBottom: '#e8f6d8',
      floorA: '#7fbf5a',
      floorB: '#74b350',
      wallA: '#2f7a3a',
      wallB: '#3f9a48',
      frame: '#b8a07a',
      accent: '#ff9d9d',
      box: '#c89a5f',
      boxDark: '#8b5e34',
      goal: '#fff6e0',
    },
  },
  {
    id: 'barrio',
    vehicle: 'moto',
    floor: 'cobble',
    wall: 'terrace',
    ambient: 'leaves',
    night: false,
    palette: {
      skyTop: '#ffd9a8',
      skyBottom: '#fff1d6',
      floorA: '#b3a48a',
      floorB: '#a69679',
      wallA: '#e0562e',
      wallB: '#f7c948',
      frame: '#7a6a52',
      accent: '#2f6fb5',
      box: '#c89a5f',
      boxDark: '#8b5e34',
      goal: '#2f6fb5',
    },
  },
  {
    id: 'lagoon',
    vehicle: 'boat',
    floor: 'lagoon',
    wall: 'reeds',
    ambient: 'birds',
    night: false,
    palette: {
      skyTop: '#ffb36b',
      skyBottom: '#ffe3b0',
      floorA: '#4f9f8f',
      floorB: '#478f82',
      wallA: '#8a9a3a',
      wallB: '#b7b85a',
      frame: '#7a6a3a',
      accent: '#fff6e0',
      box: '#b98543',
      boxDark: '#7a5326',
      goal: '#ff6b2e',
    },
  },
  {
    id: 'arts',
    vehicle: 'heli',
    floor: 'plaza',
    wall: 'arch',
    ambient: 'bubbles',
    night: false,
    palette: {
      skyTop: '#9ad9f5',
      skyBottom: '#f2fbff',
      floorA: '#eef3f6',
      floorB: '#dfe8ee',
      wallA: '#ffffff',
      wallB: '#9fc4d9',
      frame: '#6fb4d6',
      accent: '#2f9fd6',
      box: '#d4a65f',
      boxDark: '#8f6a2a',
      goal: '#2f9fd6',
    },
  },
  {
    id: 'beach',
    vehicle: 'car',
    floor: 'sand',
    wall: 'palm',
    ambient: 'dust',
    night: false,
    palette: {
      skyTop: '#7fd0f2',
      skyBottom: '#fff0c8',
      floorA: '#f0d9a0',
      floorB: '#e8cf92',
      wallA: '#2f8a4a',
      wallB: '#6b4a2b',
      frame: '#d9c28a',
      accent: '#ff6b6b',
      box: '#c89a5f',
      boxDark: '#8b5e34',
      goal: '#ff6b6b',
    },
  },
  {
    id: 'oldtown',
    vehicle: 'moto',
    floor: 'cobble',
    wall: 'house',
    ambient: 'dust',
    night: false,
    palette: {
      skyTop: '#c9b5e8',
      skyBottom: '#ffe6c7',
      floorA: '#8f8672',
      floorB: '#82796a',
      wallA: '#e3b98a',
      wallB: '#b8553a',
      frame: '#5d5547',
      accent: '#f7c948',
      box: '#c89a5f',
      boxDark: '#8b5e34',
      goal: '#f7c948',
    },
  },
  {
    id: 'rice',
    vehicle: 'boat',
    floor: 'lagoon',
    wall: 'house',
    ambient: 'birds',
    night: false,
    palette: {
      skyTop: '#ff9d6b',
      skyBottom: '#ffd9a0',
      floorA: '#5a9fb0',
      floorB: '#4f93a4',
      wallA: '#fff6e0',
      wallB: '#b8553a',
      frame: '#9a8a4a',
      accent: '#fff6e0',
      box: '#b98543',
      boxDark: '#7a5326',
      goal: '#ff6b2e',
    },
  },
  {
    id: 'fallas',
    vehicle: 'heli',
    floor: 'night',
    wall: 'ninot',
    ambient: 'sparks',
    night: true,
    palette: {
      skyTop: '#1c1633',
      skyBottom: '#4a2a5e',
      floorA: '#2a2547',
      floorB: '#322c55',
      wallA: '#ff6b6b',
      wallB: '#f7c948',
      frame: '#6b4a8a',
      accent: '#ffd45c',
      box: '#e0b86e',
      boxDark: '#9a6a2a',
      goal: '#ffd45c',
    },
  },
]

export const VEHICLE_ICON: Record<VehicleId, string> = {
  car: '🚗',
  moto: '🛵',
  boat: '🚤',
  heli: '🚁',
}
