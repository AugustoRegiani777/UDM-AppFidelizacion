// Rally de Cocina: el selector de pistas del menú (tarjetas con el dibujo del trazado) y sus estilos.
// Los estilos se suman a los del juego desde rallyEngine.ts (no se toca style.ts).
import type { TrackRuntime } from './tracks/runtime.ts'

/** El trazado de la pista como un SVG chico (el mismo dibujo que el minimapa). */
export function trackThumbSVG(rt: TrackRuntime, w = 100, h = 72): string {
  let x0 = Infinity
  let x1 = -Infinity
  let z0 = Infinity
  let z1 = -Infinity
  for (const p of rt.TP) {
    x0 = Math.min(x0, p.x)
    x1 = Math.max(x1, p.x)
    z0 = Math.min(z0, p.z)
    z1 = Math.max(z1, p.z)
  }
  const pad = 9
  const sc = Math.min((w - pad * 2) / (x1 - x0), (h - pad * 2) / (z1 - z0))
  const ox = w / 2 - ((x0 + x1) / 2) * sc
  const oz = h / 2 - ((z0 + z1) / 2) * sc
  const step = Math.max(1, Math.round(rt.n / 140))
  let d = ''
  for (let i = 0; i < rt.n; i += step) {
    const p = rt.TP[i]!
    d += (i ? 'L' : 'M') + (ox + p.x * sc).toFixed(1) + ' ' + (oz + p.z * sc).toFixed(1)
  }
  d += 'Z'
  const s = rt.TP[0]!
  const nr = rt.NRM[0]!
  const a = [ox + (s.x + nr.x * rt.hw) * sc, oz + (s.z + nr.z * rt.hw) * sc]
  const b = [ox + (s.x - nr.x * rt.hw) * sc, oz + (s.z - nr.z * rt.hw) * sc]
  const road = (rt.hw * 2 * sc).toFixed(1)
  return `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false"><path d="${d}" fill="none" stroke="rgba(255,255,255,.28)" stroke-width="${road}" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/><path d="M${a[0]!.toFixed(1)} ${a[1]!.toFixed(1)}L${b[0]!.toFixed(1)} ${b[1]!.toFixed(1)}" stroke="#ffd23f" stroke-width="3"/></svg>`
}

export const TRACK_CSS = `
.rdc .tracks{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(128px,100%),1fr));gap:10px}
.rdc .track-card{display:grid;gap:4px;align-content:start;text-align:left;background:var(--box-2);border:3px solid var(--ink);border-radius:14px;padding:8px 9px 9px;box-shadow:4px 4px 0 var(--ink);min-height:112px;touch-action:manipulation;position:relative;min-width:0}
.rdc .track-card:hover:not(:disabled){transform:translate(-1px,-1px)}
.rdc .track-card[aria-checked="true"]{background:var(--ink);border-color:var(--sun);box-shadow:4px 4px 0 var(--sun)}
.rdc .track-card:disabled{opacity:.62;cursor:not-allowed;box-shadow:none;background:rgba(13,19,48,.55)}
.rdc .track-card svg{width:100%;height:auto;aspect-ratio:100/72;display:block;background:rgba(13,19,48,.4);border-radius:8px}
.rdc .track-name{font-family:var(--f-display);font-size:15px;line-height:1.05;overflow-wrap:anywhere}
.rdc .track-meta{font-family:var(--f-data);font-size:11px;letter-spacing:.06em;opacity:.9;display:flex;flex-wrap:wrap;gap:2px 8px;align-items:center}
.rdc .track-stars{color:var(--sun);letter-spacing:.12em}
.rdc .track-lock{position:absolute;top:8px;right:8px;width:30px;height:30px;border-radius:50%;background:var(--ink);display:grid;place-items:center;border:2px solid var(--sun)}
.rdc .track-lock svg{width:16px;height:16px;aspect-ratio:auto;background:none;border-radius:0}
.rdc .track-hint{margin:6px 0 0;font-family:var(--f-data);font-size:12px;line-height:1.35;opacity:.92;min-height:1.35em}
.rdc .hud-track{max-width:42vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@media (orientation:landscape) and (max-height:520px){
  .rdc .tracks{grid-template-columns:repeat(auto-fill,minmax(min(112px,100%),1fr));gap:8px}
  .rdc .track-card{padding:6px 7px 7px;min-height:96px;border-radius:12px}
  .rdc .track-name{font-size:13px}
  .rdc .track-meta{font-size:10px}
}
`

export const LOCK_SVG =
  '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="9" width="12" height="9" rx="2" fill="#ffd23f"/><path d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9" fill="none" stroke="#ffd23f" stroke-width="2"/></svg>'
