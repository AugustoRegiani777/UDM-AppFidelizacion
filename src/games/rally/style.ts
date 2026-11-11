// Rally de Cocina: estilos de la demo del dueño, encerrados bajo `.rdc` para no chocar con Tailwind ni con el resto de la app.
// Las fuentes (Bungee, Chakra Petch, Rubik) se cargan desde los paquetes @fontsource en rallyEngine.ts: nada de internet.
import { TOUCH_CSS } from './touchLayer.ts'

export const RALLY_CSS = `
.rdc{
  --ink:#0d1330;--box:#1f49c9;--box-2:#2c5ae3;--sun:#ffd23f;--tomato:#ff4a3d;--paper:#ffffff;--kbd-edge:#9aa6c9;--glass:rgba(13,19,48,.62);
  --f-display:"Bungee","Arial Black",Impact,system-ui,sans-serif;
  --f-body:"Rubik","Segoe UI",system-ui,sans-serif;
  --f-data:"Chakra Petch",ui-monospace,Consolas,monospace;
  --rdc-btn:clamp(64px,19vh,78px);
  color-scheme:dark;
  position:absolute;inset:0;overflow:hidden;background:var(--ink);color:var(--paper);font-family:var(--f-body);font-size:15px;line-height:normal;-webkit-font-smoothing:antialiased;
  touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;
}
.rdc *,.rdc *::before,.rdc *::after{box-sizing:border-box}
.rdc [hidden]{display:none !important}
.rdc .stage{position:absolute;inset:0}
.rdc .stage canvas{display:block;width:100%;height:100%}
.rdc button{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}
.rdc :focus-visible{outline:3px solid var(--sun);outline-offset:2px}

/* ---------- HUD ---------- */
.rdc .hud{position:absolute;inset:0;pointer-events:none;font-family:var(--f-data);text-shadow:0 2px 0 rgba(13,19,48,.55)}
.rdc .hud-tl{position:absolute;top:calc(14px + env(safe-area-inset-top,0px));left:calc(16px + env(safe-area-inset-left,0px));display:grid;gap:8px;justify-items:start}
.rdc .pos-big{font-family:var(--f-display);font-size:clamp(44px,7vw,76px);line-height:.85;color:var(--sun);-webkit-text-stroke:3px var(--ink);paint-order:stroke fill;text-shadow:4px 4px 0 var(--ink)}
.rdc .pos-big small{font-size:.42em;color:var(--paper)}
.rdc .chip{background:var(--glass);border-radius:6px;padding:5px 10px;font-weight:700;letter-spacing:.1em;font-size:15px;font-variant-numeric:tabular-nums}
.rdc .hud-top{position:absolute;top:calc(12px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);display:flex;gap:8px;pointer-events:auto}
.rdc .icon-btn{width:40px;height:40px;border-radius:10px;border:2px solid var(--ink);background:var(--glass);display:grid;place-items:center;padding:0;touch-action:manipulation}
.rdc .icon-btn svg{width:20px;height:20px;display:block}
.rdc .hud-tr{position:absolute;top:calc(14px + env(safe-area-inset-top,0px));right:calc(16px + env(safe-area-inset-right,0px));display:grid;gap:8px;justify-items:end}
.rdc .times{margin:0;background:var(--glass);padding:8px 12px;border-radius:8px;display:grid;grid-template-columns:auto auto;gap:2px 16px;font-variant-numeric:tabular-nums}
.rdc .times dt{font-size:11px;letter-spacing:.14em;opacity:.75;align-self:center;margin:0}
.rdc .times dd{margin:0;text-align:right;font-weight:700;font-size:16px}
.rdc .minimap{width:190px;height:150px;background:var(--glass);border-radius:8px}
.rdc .hud-bl{position:absolute;left:calc(16px + env(safe-area-inset-left,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));display:grid;gap:6px}
.rdc .speed{font-family:var(--f-display);font-size:clamp(34px,5vw,54px);line-height:1;-webkit-text-stroke:2px var(--ink);paint-order:stroke fill;font-variant-numeric:tabular-nums}
.rdc .speed small{font-family:var(--f-data);font-size:14px;margin-left:6px;-webkit-text-stroke:0;letter-spacing:.1em}
.rdc .turbo-bar{width:180px;height:10px;border-radius:5px;background:var(--glass);overflow:hidden;border:2px solid var(--ink)}
.rdc .turbo-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--sun),var(--tomato))}
.rdc .hud-br{position:absolute;right:calc(16px + env(safe-area-inset-right,0px));bottom:calc(16px + env(safe-area-inset-bottom,0px));display:grid;gap:6px;justify-items:center}
.rdc .item-slot{width:86px;height:86px;border-radius:16px;border:4px solid var(--ink);background:var(--glass);box-shadow:inset 0 0 0 3px rgba(255,255,255,.18);display:grid;place-items:center}
.rdc .item-slot.full{background:rgba(255,210,63,.22);box-shadow:inset 0 0 0 3px var(--sun)}
.rdc .item-icon svg{width:56px;height:56px;display:block}
.rdc .item-label{font-size:12px;font-weight:700;letter-spacing:.12em;background:var(--glass);padding:3px 8px;border-radius:5px;white-space:nowrap}
.rdc .center-msg{position:absolute;left:0;right:0;top:28%;text-align:center;font-family:var(--f-display);font-size:clamp(48px,11vw,120px);color:var(--sun);-webkit-text-stroke:4px var(--ink);paint-order:stroke fill;text-shadow:6px 6px 0 var(--ink);opacity:0;padding-inline:16px}
.rdc .center-msg.long{font-size:clamp(30px,6vw,72px)}
.rdc .center-msg.pop{animation:rdc-pop 1.15s ease-out forwards}
@keyframes rdc-pop{0%{opacity:0;transform:scale(1.7)}15%{opacity:1;transform:scale(1)}75%{opacity:1}100%{opacity:0;transform:scale(.96)}}
.rdc .toast{position:absolute;left:0;right:0;top:calc(28% + clamp(64px,13vw,140px));text-align:center;font-family:var(--f-display);font-size:clamp(18px,3vw,28px);color:var(--paper);-webkit-text-stroke:2px var(--ink);paint-order:stroke fill;opacity:0;padding-inline:16px}
.rdc .toast.show{animation:rdc-toast 1.9s ease-out forwards}
@keyframes rdc-toast{0%{opacity:0;transform:translateY(10px)}12%{opacity:1;transform:none}80%{opacity:1}100%{opacity:0}}
.rdc .wrongway{position:absolute;left:50%;top:17%;transform:translateX(-50%);background:var(--tomato);color:var(--paper);font-family:var(--f-display);font-size:clamp(18px,3vw,30px);padding:8px 18px;border:3px solid var(--ink);border-radius:10px;animation:rdc-blink .6s steps(2) infinite;white-space:nowrap}
@keyframes rdc-blink{50%{opacity:.35}}
@keyframes rdc-fade{0%{opacity:0}10%{opacity:1}80%{opacity:1}100%{opacity:0}}
@media (prefers-reduced-motion: reduce){
  .rdc .center-msg.pop,.rdc .toast.show{animation-name:rdc-fade}
  .rdc .wrongway{animation:none}
}
@media (max-width:640px){ .rdc .minimap{display:none} }

/* ---------- Overlays ---------- */
.rdc .overlay{position:absolute;inset:0;z-index:10;overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;display:flex;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:calc(20px + env(safe-area-inset-top,0px)) calc(20px + env(safe-area-inset-bottom,0px));background:radial-gradient(ellipse at 50% 40%,rgba(13,19,48,.05),rgba(13,19,48,.62));-webkit-user-select:none;user-select:none}
.rdc .panel{margin:auto;width:min(1080px,100%);min-width:0;background-color:var(--box);background-image:radial-gradient(rgba(255,255,255,.09) 1.2px,transparent 1.5px);background-size:14px 14px;border:4px solid var(--ink);border-radius:20px;box-shadow:10px 10px 0 var(--ink);padding:clamp(18px,3vw,32px);display:grid;gap:22px}
.rdc .panel.narrow{width:min(660px,100%)}
.rdc .menu-grid{display:grid;gap:24px;grid-template-columns:minmax(0,1fr)}
@media (min-width:980px){ .rdc .menu-grid{grid-template-columns:minmax(0,.95fr) minmax(0,1.1fr)} }
.rdc .col{display:grid;gap:20px;align-content:start;min-width:0}
.rdc .eyebrow{margin:0;font-family:var(--f-data);font-weight:700;letter-spacing:.16em;text-transform:uppercase;font-size:13px;color:var(--sun)}
.rdc .logo{margin:6px 0 0;font-family:var(--f-display);font-weight:400;font-size:clamp(46px,8vw,92px);line-height:.88;color:var(--sun);-webkit-text-stroke:3px var(--ink);paint-order:stroke fill;text-shadow:6px 6px 0 var(--ink);text-wrap:balance}
.rdc .tagline{margin:10px 0 0;max-width:46ch;font-size:17px;line-height:1.45}
.rdc .sec-title,.rdc .seg legend{margin:0 0 10px;padding:0;font-family:var(--f-data);font-size:13px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;color:var(--sun)}
.rdc .cars{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(230px,100%),1fr));gap:12px}
.rdc .car-card{display:grid;grid-template-columns:44px minmax(0,1fr);gap:12px;align-items:center;text-align:left;background:var(--box-2);border:3px solid var(--ink);border-radius:14px;padding:10px 12px;box-shadow:4px 4px 0 var(--ink);transition:transform .08s;touch-action:manipulation}
.rdc .car-card:hover{transform:translate(-1px,-1px)}
.rdc .car-card[aria-checked="true"]{background:var(--ink);border-color:var(--sun);box-shadow:4px 4px 0 var(--sun)}
.rdc .car-card svg{width:44px;height:72px;display:block}
.rdc .car-name{font-family:var(--f-display);font-size:19px;line-height:1}
.rdc .car-motor{font-family:var(--f-data);font-size:12px;opacity:.8;letter-spacing:.04em;margin-top:3px}
.rdc .stats{display:grid;grid-template-columns:auto 1fr;gap:4px 8px;margin-top:8px;font-family:var(--f-data);font-size:10.5px;letter-spacing:.08em;align-items:center}
.rdc .bar{height:8px;background:rgba(255,255,255,.16);border-radius:2px;overflow:hidden}
.rdc .bar i{display:block;height:100%;width:calc(var(--v) * 100%);background:repeating-linear-gradient(90deg,var(--sun) 0 7px,transparent 7px 9px)}
.rdc .opts{display:flex;flex-wrap:wrap;gap:14px 24px}
.rdc .seg{border:0;margin:0;padding:0;min-width:0}
.rdc .seg-row{display:flex;flex-wrap:wrap;gap:6px}
.rdc .seg input{position:absolute;opacity:0;pointer-events:none}
.rdc .seg label{padding:7px 13px;border:3px solid var(--ink);border-radius:10px;background:var(--box-2);font-weight:700;cursor:pointer;box-shadow:3px 3px 0 var(--ink);font-family:var(--f-data);font-size:15px;touch-action:manipulation}
.rdc .seg input:checked + label{background:var(--sun);color:var(--ink)}
.rdc .seg input:focus-visible + label{outline:3px solid var(--paper);outline-offset:2px}
.rdc .go-row{display:flex;flex-wrap:wrap;align-items:center;gap:14px 22px}
.rdc .btn-go{font-family:var(--f-display);font-size:clamp(24px,4vw,34px);background:var(--tomato);color:var(--paper);border:4px solid var(--ink);border-radius:16px;padding:12px 32px;box-shadow:6px 6px 0 var(--ink);-webkit-text-stroke:1.5px var(--ink);paint-order:stroke fill;touch-action:manipulation}
.rdc .btn-go:active,.rdc .btn:active{transform:translate(4px,4px);box-shadow:2px 2px 0 var(--ink)}
.rdc .btn{font-family:var(--f-display);font-size:18px;background:var(--box-2);border:3px solid var(--ink);border-radius:12px;padding:10px 20px;box-shadow:4px 4px 0 var(--ink);touch-action:manipulation;min-height:48px}
.rdc .btn.primary{background:var(--tomato)}
.rdc .btn.ghost{background:transparent;box-shadow:none;border-color:rgba(255,255,255,.45);font-size:15px}
.rdc .record{margin:0;font-family:var(--f-data);font-size:14px;opacity:.92;max-width:34ch}
.rdc .practice{margin:0;font-family:var(--f-data);font-size:12px;letter-spacing:.04em;opacity:.8;max-width:46ch}
.rdc .info{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:20px;border-top:3px solid var(--ink);padding-top:18px}
.rdc .keys,.rdc .items{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.rdc .keys li{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.rdc kbd{font-family:var(--f-data);font-weight:700;font-size:13px;min-width:26px;text-align:center;padding:3px 7px;background:var(--paper);color:var(--ink);border-radius:6px;border-bottom:3px solid var(--kbd-edge)}
.rdc .keys span{margin-left:4px}
.rdc .items li{display:grid;grid-template-columns:30px minmax(0,1fr);gap:10px;align-items:center;line-height:1.35}
.rdc .items svg{width:30px;height:30px;display:block}
.rdc .items b{font-family:var(--f-display);font-weight:400;font-size:15px;margin-right:6px}
.rdc .title{margin:0;font-family:var(--f-display);font-weight:400;font-size:clamp(34px,6vw,56px);line-height:1;color:var(--sun);-webkit-text-stroke:2px var(--ink);paint-order:stroke fill;text-shadow:4px 4px 0 var(--ink)}
.rdc .sub{margin:0;font-size:16px;line-height:1.45}
.rdc .table-wrap{overflow-x:auto}
.rdc .res-table{width:100%;border-collapse:collapse;font-family:var(--f-data);font-variant-numeric:tabular-nums}
.rdc .res-table th{text-align:left;font-size:11px;letter-spacing:.14em;color:var(--sun);padding:6px 8px;border-bottom:3px solid var(--ink);white-space:nowrap;font-weight:700}
.rdc .res-table td{padding:9px 8px;border-bottom:2px solid rgba(13,19,48,.45);font-size:16px;white-space:nowrap}
.rdc .res-table tr.me td{background:rgba(255,210,63,.2)}
.rdc .dot{display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid var(--ink);margin-right:8px;vertical-align:-1px}
.rdc .btn-row{display:flex;flex-wrap:wrap;gap:12px}
.rdc .res-head{display:grid;gap:10px;align-content:start}
.rdc .panel.results{grid-template-columns:minmax(0,1fr)}
.rdc .loading{position:absolute;inset:0;display:grid;place-items:center;background:var(--ink);font-family:var(--f-display);font-size:clamp(22px,5vw,36px);color:var(--sun)}

/* ---------- celular en horizontal: paneles compactos con scroll interno ---------- */
@media (orientation:landscape) and (max-height:520px){
  .rdc .overlay{padding-top:calc(8px + env(safe-area-inset-top,0px));padding-bottom:calc(8px + env(safe-area-inset-bottom,0px));padding-left:max(10px,env(safe-area-inset-left,0px));padding-right:max(10px,env(safe-area-inset-right,0px))}
  .rdc .panel{padding:14px 16px;gap:12px;border-width:3px;border-radius:16px;box-shadow:6px 6px 0 var(--ink)}
  .rdc .menu-grid{grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:16px}
  .rdc .col{gap:12px}
  .rdc .col > header{order:-2}
  .rdc .col > .go-row{order:-1}
  .rdc .logo{font-size:clamp(34px,10vh,52px);-webkit-text-stroke-width:2px;text-shadow:4px 4px 0 var(--ink)}
  .rdc .tagline{font-size:14px;margin-top:6px}
  .rdc .eyebrow{font-size:11px}
  .rdc .cars{grid-template-columns:repeat(auto-fill,minmax(min(148px,100%),1fr));gap:8px}
  .rdc .car-card{grid-template-columns:30px minmax(0,1fr);gap:8px;padding:7px 8px;min-height:64px}
  .rdc .car-card svg{width:30px;height:50px}
  .rdc .car-name{font-size:15px}
  .rdc .car-motor{font-size:10px}
  .rdc .stats{font-size:9px;margin-top:5px;gap:3px 6px}
  .rdc .bar{height:6px}
  .rdc .seg label{padding:6px 12px;min-height:40px;display:grid;place-items:center}
  .rdc .btn-go{padding:8px 24px;font-size:24px;min-height:56px}
  .rdc .info{gap:12px;padding-top:12px}
  .rdc .title{font-size:clamp(28px,9vh,40px)}
  .rdc .sub{font-size:14px}
  .rdc .res-table td{padding:5px 8px;font-size:14px}
  .rdc .res-table th{padding:4px 8px}
  .rdc .panel.results{width:min(860px,100%);grid-template-columns:minmax(0,.8fr) minmax(0,1.2fr);grid-template-areas:"head table" "btns table";align-content:center}
  .rdc .panel.results .res-head{grid-area:head}
  .rdc .panel.results .table-wrap{grid-area:table}
  .rdc .panel.results .btn-row{grid-area:btns;align-self:end}
  .rdc.is-touch .minimap{width:128px;height:101px}
}
.rdc.is-touch .hud-br{display:none}
.rdc.is-touch .hud-tl{gap:4px}
.rdc.is-touch .icon-btn{width:46px;height:46px}
@media (orientation:landscape) and (max-height:520px){
  .rdc.is-touch .pos-big{font-size:clamp(34px,10vh,48px);-webkit-text-stroke-width:2px;text-shadow:3px 3px 0 var(--ink)}
  .rdc.is-touch .chip{font-size:12px;padding:3px 8px}
  .rdc.is-touch .times{padding:5px 9px;gap:1px 12px}
  .rdc.is-touch .times dt{font-size:9.5px}
  .rdc.is-touch .times dd{font-size:13px}
  .rdc.is-touch .hud-bl{left:50%;transform:translateX(-50%);justify-items:center;bottom:calc(10px + env(safe-area-inset-bottom,0px))}
  .rdc.is-touch .speed{font-size:clamp(26px,8vh,36px)}
  .rdc.is-touch .speed small{font-size:11px}
  .rdc.is-touch .turbo-bar{width:110px;height:8px}
  .rdc.is-touch .center-msg{top:18%;font-size:clamp(44px,18vh,84px)}
  .rdc.is-touch .center-msg.long{font-size:clamp(28px,11vh,52px)}
  .rdc.is-touch .toast{top:calc(18% + clamp(48px,20vh,90px));font-size:clamp(16px,5vh,22px)}
  .rdc.is-touch .wrongway{top:13%;font-size:clamp(16px,5vh,22px);padding:5px 12px}
}
@media (orientation:landscape) and (max-height:340px){ .rdc.is-touch .minimap{display:none} }
${TOUCH_CSS}
`
