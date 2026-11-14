// Rally de Cocina: el HTML del HUD, el menú, la pausa, los resultados y el aviso de error.
// Es el de la demo; solo cambia que los ids pasan a `data-r` para no chocar con la app.
import { copy } from '@/copy'
import { ICONS, ITEM_DESC, ITEM_KEYS, ITEM_NAMES, hex, type CarDef } from './data.ts'
import { touchHelpHtml, touchOptionsHtml } from './touchLayer.ts'

export function carSVG(def: CarDef) {
  const c = hex(def.color)
  const a = hex(def.accent)
  const truck = def.style === 'truck'
  const buggy = def.style === 'buggy'
  const bw = truck ? 44 : buggy ? 32 : 40
  const bx = (60 - bw) / 2
  const wx = truck ? 1 : 3
  const wwid = buggy || truck ? 14 : 12
  return `<svg viewBox="0 0 60 100" aria-hidden="true">
    <rect x="${wx}" y="14" width="${wwid}" height="22" rx="4" fill="#16171a"/><rect x="${60 - wx - wwid}" y="14" width="${wwid}" height="22" rx="4" fill="#16171a"/>
    <rect x="${wx}" y="66" width="${wwid}" height="22" rx="4" fill="#16171a"/><rect x="${60 - wx - wwid}" y="66" width="${wwid}" height="22" rx="4" fill="#16171a"/>
    <rect x="${bx}" y="6" width="${bw}" height="88" rx="${truck ? 7 : 13}" fill="${c}" stroke="#0d1330" stroke-width="3"/>
    <rect x="${bx + 6}" y="${truck ? 30 : 36}" width="${bw - 12}" height="${truck ? 26 : 22}" rx="5" fill="#1b2a3a"/>
    ${buggy ? `<path d="M${bx + 4} 34h${bw - 8}M${bx + 4} 62h${bw - 8}M${bx + 6} 34v28M${60 - bx - 6} 34v28" stroke="${a}" stroke-width="3" fill="none"/>` : `<rect x="27" y="8" width="6" height="${truck ? 20 : 26}" fill="${a}"/>`}
    ${def.style === 'sport' ? `<rect x="5" y="86" width="50" height="8" rx="2" fill="${a}" stroke="#0d1330" stroke-width="2"/>` : ''}
    <circle cx="${60 - bx - 8}" cy="80" r="2.5" fill="#0d1330"/>
  </svg>`
}

const radioRow = (name: string, values: [string, string][]) =>
  values
    .map(
      ([v, label]) =>
        `<input type="radio" name="rdc-${name}" id="rdc-${name}-${v}" value="${v}"><label for="rdc-${name}-${v}">${label}</label>`,
    )
    .join('')

const PAUSE_ICON =
  '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="3" width="4" height="14" rx="1" fill="#fff"/><rect x="12" y="3" width="4" height="14" rx="1" fill="#fff"/></svg>'

const controlsDesktop = `
        <ul class="keys">
          <li><kbd>↑</kbd><kbd>W</kbd><span>Acelerar</span></li>
          <li><kbd>↓</kbd><kbd>S</kbd><span>Frenar y marcha atrás</span></li>
          <li><kbd>←</kbd><kbd>→</kbd><kbd>A</kbd><kbd>D</kbd><span>Doblar</span></li>
          <li><kbd>Shift</kbd><span>Freno de mano para derrapar</span></li>
          <li><kbd>Espacio</kbd><span>Usar el ítem</span></li>
          <li><kbd>R</kbd><span>Volver a la pista</span> <kbd>C</kbd><span>Cámara</span> <kbd>P</kbd><span>Pausa</span> <kbd>M</kbd><span>Sonido</span></li>
        </ul>`

const controlsTouch = () => `<div data-r="touch-help">${touchHelpHtml()}</div>`

export function buildTemplate(touch: boolean): string {
  const r = copy.rally
  return `
<div class="stage" data-r="stage" aria-hidden="true"></div>

<div class="hud" data-r="hud" hidden>
  <div class="hud-tl">
    <div class="pos-big"><span data-r="hud-pos" data-testid="rally-pos">1</span><small>/<span data-r="hud-total">4</span></small></div>
    <div class="chip">VUELTA <span data-r="hud-lap" data-testid="rally-lap">1/3</span></div>
    <div class="chip hud-track" data-r="hud-track" data-testid="rally-hud-track"></div>
  </div>
  <div class="hud-top">
    <button class="icon-btn" data-r="btn-pause" type="button" aria-label="${r.pause}">${PAUSE_ICON}</button>
    <button class="icon-btn" data-r="btn-mute" type="button" aria-label="${r.mute}"></button>
    <button class="icon-btn" data-r="btn-cam" type="button" aria-label="${r.camera}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 6.5h3l1.2-2h6.6l1.2 2h3v9h-15z" fill="none" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/><circle cx="10" cy="10.8" r="2.9" fill="none" stroke="#fff" stroke-width="1.7"/></svg></button>
  </div>
  <div class="hud-tr">
    <dl class="times">
      <dt>TOTAL</dt><dd data-r="hud-time" data-testid="rally-time">0:00.00</dd>
      <dt>VUELTA</dt><dd data-r="hud-laptime">0:00.00</dd>
      <dt>MEJOR</dt><dd data-r="hud-best">--:--.--</dd>
    </dl>
    <canvas class="minimap" data-r="minimap" width="190" height="150" aria-label="${r.minimap}"></canvas>
  </div>
  <div class="hud-bl">
    <div class="speed"><span data-r="hud-speed" data-testid="rally-speed">0</span><small>km/h</small></div>
    <div class="turbo-bar"><i data-r="hud-turbo"></i></div>
  </div>
  <div class="hud-br">
    <div class="item-slot" data-r="item-slot"><div class="item-icon" data-r="item-icon"></div></div>
    <div class="item-label" data-r="item-label">SIN ÍTEM</div>
  </div>
  <div class="center-msg" data-r="center-msg" aria-live="polite"></div>
  <div class="toast" data-r="toast" aria-live="polite"></div>
  <div class="wrongway" data-r="wrongway" hidden>SENTIDO CONTRARIO</div>
</div>

<div class="overlay" data-r="menu" role="dialog" aria-modal="true" aria-label="${r.title}">
  <div class="panel">
    <div class="menu-grid">
      <div class="col">
        <header>
          <p class="eyebrow" data-r="eyebrow" data-testid="rally-eyebrow"></p>
          <h1 class="logo">Rally de Cocina</h1>
          <p class="tagline">Autitos a radiocontrol entre las patas de la mesa. Juntá cajas sorpresa, saltá las rampas y llegá primero a la meta.</p>
        </header>
        <div class="opts">
          <fieldset class="seg">
            <legend>Vueltas</legend>
            <div class="seg-row">${radioRow('laps', [
              ['3', '3'],
              ['5', '5'],
              ['7', '7'],
            ])}</div>
          </fieldset>
          <fieldset class="seg">
            <legend>Rivales</legend>
            <div class="seg-row">${radioRow('rivals', [
              ['1', '1'],
              ['2', '2'],
              ['3', '3'],
              ['4', '4'],
              ['5', '5'],
            ])}</div>
          </fieldset>
          <fieldset class="seg">
            <legend>Dificultad</legend>
            <div class="seg-row">${radioRow('diff', [
              ['easy', 'Fácil'],
              ['normal', 'Normal'],
              ['hard', 'Difícil'],
            ])}</div>
          </fieldset>${touch ? touchOptionsHtml() : ''}
        </div>
        <div class="go-row">
          <button data-r="btn-start" data-testid="rally-start" class="btn-go" type="button">¡A correr!</button>
          <p class="record" data-r="record-line"></p>
        </div>
        <p class="practice">${r.practice}</p>
        <div><button class="btn ghost" data-r="btn-exit" data-testid="rally-exit" type="button">${r.exit}</button></div>
      </div>
      <div class="col">
        <section aria-labelledby="rdc-h-tracks">
          <h2 id="rdc-h-tracks" class="sec-title">${r.tracks.title}</h2>
          <div class="tracks" data-r="track-grid" data-testid="rally-tracks" role="radiogroup" aria-labelledby="rdc-h-tracks"></div>
          <p class="track-hint" data-r="track-hint" aria-live="polite"></p>
        </section>
        <section aria-labelledby="rdc-h-cars">
          <h2 id="rdc-h-cars" class="sec-title">Elegí tu auto</h2>
          <div class="cars" data-r="car-grid" role="radiogroup" aria-labelledby="rdc-h-cars"></div>
        </section>
      </div>
    </div>
    <div class="info">
      <section aria-labelledby="rdc-h-keys">
        <h2 id="rdc-h-keys" class="sec-title">${touch ? r.controlsTouchTitle : 'Controles'}</h2>
        ${touch ? controlsTouch() : controlsDesktop}
      </section>
      <section aria-labelledby="rdc-h-items">
        <h2 id="rdc-h-items" class="sec-title">Cajas sorpresa</h2>
        <ul class="items">${ITEM_KEYS.map((k) => `<li>${ICONS[k]}<span><b>${ITEM_NAMES[k]}</b>${ITEM_DESC[k]}</span></li>`).join('')}</ul>
      </section>
    </div>
  </div>
</div>

<div class="overlay" data-r="pause" role="dialog" aria-modal="true" aria-label="${r.pauseTitle}" hidden>
  <div class="panel narrow">
    <h2 class="title">Pausa</h2>
    <p class="sub">${touch ? r.pauseTouch : 'La carrera está detenida. Tocá <kbd>P</kbd> para seguir.'}</p>
    <div class="btn-row">
      <button class="btn primary" data-r="btn-resume" data-testid="rally-resume" type="button">Seguir</button>
      <button class="btn" data-r="btn-restart" type="button">Reiniciar carrera</button>
      <button class="btn" data-r="btn-menu" type="button">Volver al menú</button>
      <button class="btn ghost" data-r="btn-exit-pause" data-testid="rally-exit-pause" type="button">${r.exit}</button>
    </div>
  </div>
</div>

<div class="overlay" data-r="results" role="dialog" aria-modal="true" aria-label="${r.resultsTitle}" hidden>
  <div class="panel narrow results">
    <div class="res-head">
      <p class="eyebrow" data-r="res-eyebrow" data-testid="rally-results-track"></p>
      <h2 class="title" data-r="res-title">¡Meta!</h2>
      <p class="sub" data-r="res-sub"></p>
    </div>
    <div class="table-wrap">
      <table class="res-table">
        <thead><tr><th>POS</th><th>AUTO</th><th>TIEMPO</th><th>MEJOR VUELTA</th></tr></thead>
        <tbody data-r="res-body"></tbody>
      </table>
    </div>
    <div class="btn-row">
      <button class="btn primary" data-r="btn-again" data-testid="rally-again" type="button">Revancha</button>
      <button class="btn" data-r="btn-res-menu" type="button">Menú</button>
    </div>
  </div>
</div>

<div class="overlay" data-r="fatal" role="alertdialog" aria-modal="true" aria-label="${r.noWebglTitle}" hidden>
  <div class="panel narrow">
    <h2 class="title">${r.noWebglTitle}</h2>
    <p class="sub">${r.noWebglBody}</p>
    <div class="btn-row"><button class="btn primary" data-r="btn-exit-fatal" type="button">${r.exit}</button></div>
  </div>
</div>
`
}
