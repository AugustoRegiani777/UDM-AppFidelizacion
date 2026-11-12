// Rally de Cocina: arma el decorado completo de una pista (ambiente + pista) y da su look de luz.
import type { ThemeId } from '../types.ts'
import { createDecor, type DecorCtx, type DecorOptions } from './builder.ts'
import { buildBarra } from './barra.ts'
import { buildCocina } from './cocina.ts'
import { buildFallas } from './fallas.ts'
import { buildHarina } from './harina.ts'
import { buildObrador } from './obrador.ts'
import { buildTerraza } from './terraza.ts'
import { buildVitrina } from './vitrina.ts'
import { STYLES, type ThemeStyle } from './style.ts'
import { buildTrackMeshes } from './trackMeshes.ts'

const BUILDERS: Record<ThemeId, (ctx: DecorCtx) => void> = {
  cocina: buildCocina,
  obrador: buildObrador,
  barra: buildBarra,
  vitrina: buildVitrina,
  harina: buildHarina,
  terraza: buildTerraza,
  fallas: buildFallas,
}

export interface BuiltDecor {
  ctx: DecorCtx
  style: ThemeStyle
}

/** Construye el decorado de la pista de `opts.rt`. Liberarlo: `built.ctx.dispose()`. */
export function buildDecor(opts: DecorOptions): BuiltDecor {
  const ctx = createDecor(opts)
  const theme = opts.rt.def.theme
  const style = STYLES[theme]
  BUILDERS[theme](ctx)
  buildTrackMeshes(ctx, style)
  return { ctx, style }
}

export { STYLES, type ThemeStyle }
