// Fondos de "Sobreviví a las migas": cada etapa pasa en un lugar del local de Uno de Miga.
// Es decorado puro: no choca con nadie ni cambia la simulación (que se vuelve a correr en el servidor).

import { ARENA_H, ARENA_W } from '@engine/config.ts'
import { SCENES, drawBlade, drawSolid, drawZone } from '../racing/scenes.ts'
import type { SceneId, SolidKind, ZoneKind } from '../racing/tracks.ts'

type Ctx = CanvasRenderingContext2D

interface Decor {
  solids: readonly [SolidKind, number, number, number][]
  zones?: readonly [ZoneKind, number, number, number][]
  blades?: readonly [number, number, number][]
}

interface StageScene {
  scene: SceneId
  /** Velo para aclarar (suelos oscuros) u oscurecer (la noche); 0 = nada. */
  lighten: number
  dim: number
  decor: Decor
}

// Etapas 1 a 6: vitrina de sándwiches, obrador, cafetera, vitrina de bollería, fiambrera y la noche en el local.
const STAGES: readonly StageScene[] = [
  {
    scene: 'vitrina',
    lighten: 0,
    dim: 0,
    decor: {
      solids: [
        ['jar', 36, 46, 30],
        ['tin', 322, 598, 34],
        ['miga', 324, 52, 26],
        ['miga', 38, 596, 26],
        ['miga', 330, 330, 20],
      ],
    },
  },
  {
    scene: 'obrador',
    lighten: 0,
    dim: 0,
    decor: {
      solids: [
        ['film', 38, 52, 28],
        ['film', 322, 60, 24],
        ['labels', 330, 590, 24],
        ['grill', 48, 590, 32],
      ],
      zones: [['water', 308, 330, 34]],
    },
  },
  {
    scene: 'cafetera',
    lighten: 0.5,
    dim: 0,
    decor: {
      solids: [
        ['grinder', 40, 50, 32],
        ['cups', 322, 54, 26],
        ['cups', 40, 596, 24],
        ['jug', 326, 592, 24],
      ],
      zones: [['coffee', 40, 330, 30]],
    },
  },
  {
    scene: 'boleria',
    lighten: 0,
    dim: 0,
    decor: {
      solids: [
        ['cinnamon', 40, 52, 32],
        ['croissant', 322, 56, 28],
        ['croissant', 40, 596, 28],
        ['cinnamon', 326, 592, 32],
      ],
      zones: [
        ['dulce', 320, 330, 32],
        ['dulce', 52, 330, 28],
      ],
    },
  },
  {
    scene: 'fiambrera',
    lighten: 0,
    dim: 0,
    decor: {
      solids: [
        ['cheese', 40, 52, 30],
        ['ham', 322, 56, 26],
        ['cheese', 330, 594, 28],
      ],
      blades: [[48, 592, 28]],
    },
  },
  {
    // La noche en el local: todo más oscuro, con una luz cálida que entra por la ventana.
    scene: 'vitrina',
    lighten: 0,
    dim: 0.42,
    decor: {
      solids: [
        ['jar', 36, 50, 30],
        ['miga', 324, 54, 26],
        ['tin', 322, 598, 34],
        ['cups', 40, 594, 26],
      ],
    },
  },
]

export function stageScene(stage: number): StageScene {
  return STAGES[Math.min(STAGES.length, Math.max(1, Math.floor(stage))) - 1]!
}

export function drawStageBackground(ctx: Ctx, stage: number) {
  const { scene, lighten, dim, decor } = stageScene(stage)
  const style = SCENES[scene]

  const tile = document.createElement('canvas')
  tile.width = tile.height = style.tileSize
  style.tile(tile.getContext('2d')!, style.tileSize)
  const pattern = ctx.createPattern(tile, 'repeat')
  ctx.save()
  pattern?.setTransform(new DOMMatrix().scale(0.5))
  ctx.fillStyle = pattern ?? '#f8edd8'
  ctx.fillRect(0, 0, ARENA_W, ARENA_H)
  ctx.restore()

  if (lighten > 0) {
    ctx.fillStyle = `rgba(255,255,255,${lighten})`
    ctx.fillRect(0, 0, ARENA_W, ARENA_H)
  }

  for (const [kind, x, y, r] of decor.zones ?? []) {
    ctx.save()
    ctx.translate(x, y)
    drawZone(ctx, kind, r)
    ctx.restore()
  }
  for (const [kind, x, y, r] of decor.solids) {
    ctx.save()
    ctx.translate(x, y)
    drawSolid(ctx, kind, r)
    ctx.restore()
  }
  for (const [x, y, r] of decor.blades ?? []) {
    ctx.save()
    ctx.translate(x, y)
    drawBlade(ctx, r, 0.6)
    ctx.restore()
  }

  if (dim > 0) {
    ctx.fillStyle = `rgba(18,16,40,${dim})`
    ctx.fillRect(0, 0, ARENA_W, ARENA_H)
    const glow = ctx.createRadialGradient(
      ARENA_W / 2,
      ARENA_H * 0.4,
      30,
      ARENA_W / 2,
      ARENA_H * 0.4,
      ARENA_H * 0.55,
    )
    glow.addColorStop(0, 'rgba(255,214,140,0.32)')
    glow.addColorStop(1, 'rgba(255,214,140,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, ARENA_W, ARENA_H)
  }

  const vignette = ctx.createRadialGradient(
    ARENA_W / 2,
    ARENA_H / 2,
    ARENA_H * 0.25,
    ARENA_W / 2,
    ARENA_H / 2,
    ARENA_H * 0.68,
  )
  vignette.addColorStop(0, 'rgba(42,26,20,0)')
  vignette.addColorStop(1, 'rgba(42,26,20,0.28)')
  ctx.fillStyle = vignette
  ctx.fillRect(0, 0, ARENA_W, ARENA_H)
}
