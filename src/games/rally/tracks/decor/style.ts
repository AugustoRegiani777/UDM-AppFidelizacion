// Rally de Cocina: el "look" de cada ambiente: colores, luz, niebla y materiales de la pista.
import type { ThemeId } from '../types.ts'

export interface ThemeStyle {
  background: number
  fog: { color: number; near: number; far: number }
  hemi: { sky: number; ground: number; intensity: number }
  sun: { color: number; intensity: number; offset: [number, number, number] }
  /** Asfalto: color base, puntitos (r,g,b base), líneas de los bordes y de la mitad. */
  road: {
    base: string
    speck: [number, number, number]
    edge: string
    center: string
    glow?: number
  }
  curbs: [number, number]
  /** Color de los costados cuando la pista está elevada. */
  skirt: number
  slick: { color: number; accent: string }
  sand: { color: number; accent: string }
  gate: { poleA: number; poleB: number; cap: number; top: number }
  /** Si la escena es de noche (más brillo propio en cajas y partículas de la pista). */
  night?: boolean
}

export const STYLES: Record<ThemeId, ThemeStyle> = {
  cocina: {
    background: 0xd9e7e1,
    fog: { color: 0xd9e7e1, near: 150, far: 420 },
    hemi: { sky: 0xfff7ea, ground: 0xa48c6c, intensity: 1.25 },
    sun: { color: 0xfff1dc, intensity: 2.1, offset: [-45, 110, 60] },
    road: { base: '#4b5160', speck: [70, 74, 86], edge: '#f4f1ea', center: 'rgba(255,210,63,.85)' },
    curbs: [0xe8392b, 0xf6f1e7],
    skirt: 0xd9d4cc,
    slick: { color: 0x6b3a16, accent: '#c98a46' },
    sand: { color: 0xe6dfcf, accent: '#bfb59c' },
    gate: { poleA: 0xffc928, poleB: 0x3fa7ff, cap: 0xc0c4c8, top: 0xff8fa8 },
  },
  obrador: {
    background: 0xe4e8ec,
    fog: { color: 0xe4e8ec, near: 170, far: 440 },
    hemi: { sky: 0xffffff, ground: 0x9aa3ab, intensity: 1.35 },
    sun: { color: 0xfff6e8, intensity: 2.0, offset: [-55, 115, 40] },
    road: { base: '#3b4048', speck: [64, 68, 76], edge: '#ffffff', center: 'rgba(255,196,64,.9)' },
    curbs: [0xd9573a, 0xf3efe6],
    skirt: 0xe9e4d8,
    slick: { color: 0x6b3a16, accent: '#c98a46' },
    sand: { color: 0xf3f0e8, accent: '#cfc9b8' },
    gate: { poleA: 0xe9edf0, poleB: 0xd9573a, cap: 0xb7bdc4, top: 0xffd23f },
  },
  barra: {
    background: 0x3a2a20,
    fog: { color: 0x4a3526, near: 120, far: 380 },
    hemi: { sky: 0xffe2b8, ground: 0x4a3322, intensity: 1.1 },
    sun: { color: 0xffd9a3, intensity: 1.9, offset: [-35, 100, 65] },
    road: { base: '#2f2926', speck: [58, 50, 44], edge: '#f1e2c6', center: 'rgba(255,170,60,.85)' },
    curbs: [0x7a3b16, 0xf1e2c6],
    skirt: 0x6b4a30,
    slick: { color: 0x2a1408, accent: '#6b3a16' },
    sand: { color: 0xf4efe6, accent: '#d6ccb4' },
    gate: { poleA: 0xc0392b, poleB: 0x6b4a30, cap: 0xd8c07a, top: 0xf1e2c6 },
  },
  vitrina: {
    background: 0xfbeef0,
    fog: { color: 0xfbeef0, near: 160, far: 430 },
    hemi: { sky: 0xffffff, ground: 0xd8c3c8, intensity: 1.4 },
    sun: { color: 0xfff4f0, intensity: 1.85, offset: [-30, 120, 50] },
    road: { base: '#59505a', speck: [82, 74, 86], edge: '#ffffff', center: 'rgba(255,180,120,.9)' },
    curbs: [0xe05a8a, 0xffffff],
    skirt: 0xf4e6e9,
    slick: { color: 0x8a4a1a, accent: '#e8a456' },
    sand: { color: 0xf6efe4, accent: '#ddd0b8' },
    gate: { poleA: 0xf5a7c0, poleB: 0x8fd3d9, cap: 0xe9e4e6, top: 0xffd23f },
  },
  harina: {
    background: 0xe9f1f7,
    fog: { color: 0xeef3f6, near: 120, far: 360 },
    hemi: { sky: 0xf4f9ff, ground: 0xd9d2c4, intensity: 1.45 },
    sun: { color: 0xfff7e6, intensity: 2.15, offset: [-50, 105, 50] },
    road: { base: '#5a5047', speck: [92, 82, 70], edge: '#ffffff', center: 'rgba(255,205,90,.9)' },
    curbs: [0xc0572f, 0xf6f1e7],
    skirt: 0xf3efe6,
    slick: { color: 0x6b3a16, accent: '#c98a46' },
    sand: { color: 0xfaf7f0, accent: '#d9d3c4' },
    gate: { poleA: 0xc0572f, poleB: 0x6b8f5a, cap: 0xd8d2c4, top: 0xfff3d1 },
  },
  terraza: {
    background: 0xffd9a8,
    fog: { color: 0xffe0b8, near: 160, far: 440 },
    hemi: { sky: 0xffe6c2, ground: 0x9c7a5a, intensity: 1.2 },
    sun: { color: 0xffb870, intensity: 2.3, offset: [-90, 70, 30] },
    road: { base: '#51493f', speck: [80, 72, 62], edge: '#f6efe2', center: 'rgba(255,214,120,.9)' },
    curbs: [0x2f8f6b, 0xf6efe2],
    skirt: 0xc9a77c,
    slick: { color: 0x6b3a16, accent: '#c98a46' },
    sand: { color: 0xe8d6b0, accent: '#c9b184' },
    gate: { poleA: 0x2f8f6b, poleB: 0xe05a3a, cap: 0xd8c07a, top: 0xffe6a8 },
  },
  fallas: {
    background: 0x0b1030,
    fog: { color: 0x0e1438, near: 70, far: 300 },
    hemi: { sky: 0x6f7fe0, ground: 0x1a1230, intensity: 0.95 },
    sun: { color: 0xa9b8ff, intensity: 1.15, offset: [-40, 110, 50] },
    road: {
      base: '#24273a',
      speck: [46, 50, 70],
      edge: '#fff2b0',
      center: 'rgba(255,120,200,.9)',
      glow: 0x1a1d30,
    },
    curbs: [0xff3d8b, 0xffe14d],
    skirt: 0x2a2250,
    slick: { color: 0x2a1850, accent: '#a06bff' },
    sand: { color: 0x3b4a7a, accent: '#6f86c8' },
    gate: { poleA: 0xff3d8b, poleB: 0xffe14d, cap: 0xc0c4c8, top: 0x7ef0ff },
    night: true,
  },
}
