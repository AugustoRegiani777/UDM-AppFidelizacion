# PROGRESO · memoria del proyecto

> Si se corta la sesión: leer este archivo y seguir desde la primera tarea sin tildar.
> Una fase se cierra solo con lint + typecheck + tests en verde, este archivo actualizado y un commit.

## Plan maestro

### Fase 1 · Esqueleto del proyecto

- [x] 1.1 Git init, docs/01 con las decisiones nuevas, PENDIENTES-AUGUSTO.md. _Hecho cuando:_ primer commit con docs.
- [x] 1.2 Vite + React + TS strict, estructura de docs/02. _Hecho cuando:_ `npm run dev` levanta.
- [x] 1.3 Tailwind con tokens (crema y rojo provisorios) y fuentes Poppins/Bebas Neue. _Hecho cuando:_ tokens se ven en pantalla.
- [x] 1.4 Motion, Router, TanStack Query, PWA (manifest, íconos placeholder). _Hecho cuando:_ build genera manifest y service worker.
- [x] 1.5 ESLint, Prettier, Vitest, typecheck, `.env.example`, `.gitignore`. _Hecho cuando:_ los 3 scripts pasan.
- [x] 1.6 Pantalla de prueba (CountUp + Pressable) y sección Comandos de CLAUDE.md. _Hecho cuando:_ se ve saldo 179 animado.

### Fase 2 · Base de datos local

- [x] 2.1 Supabase CLI init + levantar local (requiere Docker). _Hecho cuando:_ `supabase start` responde.
- [x] 2.2 Migraciones: tablas, constraints, índices, funciones de saldo/dashboard. _Hecho cuando:_ `db reset` aplica sin errores.
- [x] 2.3 RLS en todas las tablas. _Hecho cuando:_ todas con RLS activo.
- [x] 2.4 Tests SQL de RLS (cliente A no ve/escribe datos de B). _Hecho cuando:_ pasan.
- [x] 2.5 seed.sql: settings, rewards, dev_mock_sales con casos. _Hecho cuando:_ seed carga.
- [x] 2.6 Tipos TS generados en src/lib. _Hecho cuando:_ typecheck verde con tipos.
- [x] 2.7 Hook/evento de cambio de saldo (preparación Wallet). _Hecho cuando:_ tabla/función de eventos documentada.

### Fase 3 · Login con Google y bienvenida

- [x] 3.1 Cliente Supabase, provider de sesión.
- [x] 3.2 Login Google + login email solo en dev (bandera).
- [x] 3.3 Portada sin login (punto de entrada NFC/QR fijo).
- [x] 3.4 Bienvenida con consentimientos separados y fechas.
- [x] 3.5 Rutas protegidas + `/s/:uuid` que sobrevive al login (también PWA iPhone).
- [x] 3.6 Perfil: cerrar sesión, borrar cuenta (Edge Function delete-account).

### Fase 4 · Sumar compras (POS mock)

- [x] 4.1 `_shared`: pos-adapter, hmac, cors, errors.
- [x] 4.2 `claim-sale` con todas las validaciones, transaccional, pending.
- [x] 4.3 Ruta `/s/:uuid` con resultado / pendiente / error amable.
- [x] 4.4 `/dev` simulador de tablet (crear venta mock + QR).
- [x] 4.5 Tests por caso: válida, duplicada, anulada, glovo, vieja, inexistente, pendiente.

### Fase 5 · Panel

- [ ] 5.1 Panel con `customer_dashboard` + TanStack Query.
- [ ] 5.2 Skeletons y estado vacío.
- [ ] 5.3 Historial de puntos.
- [ ] 5.4 Escáner interno (BarcodeDetector + fallback + permiso + código manual).

### Fase 6 · Canje

- [ ] 6.1 `create-redemption` + pantalla de código con cuenta regresiva.
- [ ] 6.2 `validate-redemption` con HMAC, atómica.
- [ ] 6.3 Simulador de caja en /dev.
- [ ] 6.4 Tests: válido, vencido, usado, no alcanzado, doble validación simultánea.

### Fase 7 · Motion y celebraciones

- [ ] 7.1 presets, CountUp, ProgressBar, Pressable, Sheet.
- [ ] 7.2 Celebration, PopupQueue, transiciones de pantalla.
- [ ] 7.3 Aplicar el catálogo de momentos de docs/04.
- [ ] 7.4 Reduced motion + guía de prueba de rendimiento.

### Fase 8 · Juegos

- [ ] 8.1 Tabla de premios/probabilidades (valores por defecto en settings).
- [ ] 8.2 `play-game` (servidor decide, límites diarios).
- [ ] 8.3 Raspadita post-compra.
- [ ] 8.4 Ruleta diaria.
- [ ] 8.5 "¿Cómo funciona?" con probabilidades.

### Fase 9 · Reconciliación y producción

- [ ] 9.1 `reconcile` + pg_cron.
- [ ] 9.2 Tests e2e Playwright.
- [ ] 9.3 Preparar deploy (netlify.toml, guía) sin ejecutarlo.
- [ ] 9.4 Checklist de lanzamiento + INFORME-FINAL.md.

## Decisiones tomadas por defecto

- Marca provisoria: crema + rojo, Poppins Bold / Bebas Neue (no hay brandbook en docs/marca/).
- Puntos por euro = 1 (redondeo abajo); ventana de reclamo 2 h; código de canje 15 min; canales excluidos glovo, togoo. Todo en `settings`.
- Canjear por puntos descuenta puntos al validar en caja (modelo de docs/01).
- Premios por compras: se ganan una vez por hito de 50 compras, repetible (50, 100…) y no consumen puntos. Configurable.
- Los puntos no vencen.

- Settings y rewards iniciales van en una migración (`..._seed_config.sql`) y no en `seed.sql`, porque deben existir también en producción. `seed.sql` solo tiene `dev_mock_sales`.
- Un premio por puntos reserva sus puntos mientras el código está vigente (no se puede generar otro código que supere el saldo); el descuento ocurre al validar en caja.
- Tras una anulación (reversal) el saldo puede quedar negativo; se permite.
- Perfil/consentimientos se editan solo vía funciones (`complete_onboarding`, `update_profile`), no con UPDATE directo, para que las fechas las ponga el servidor.

- Login con Google configurado en `supabase/config.toml` leyendo `GOOGLE_CLIENT_ID/SECRET` del entorno; hasta que Augusto cargue credenciales, se usa el login por email solo en dev (`VITE_DEV_TOOLS=true` y `import.meta.env.DEV`).
- La retoma de `/s/:uuid` usa dos vías: el uuid viaja en la URL de retorno del login y además queda en localStorage (cubre iPhone: Safari y PWA no comparten almacenamiento).
- Texto de privacidad provisorio (lo revisa la gestoría; está en `src/copy/es.ts`).

- Reglas de reclamo en SQL (`claim_sale_apply`), no en TypeScript: transaccional, con lock por venta y testeado con pgTAP. La Edge Function solo consulta al POS.
- Si el POS no responde (modo real) la venta queda `pending` en vez de dar error; `reconcile` (fase 9) la reintenta.
- Una pendiente que aparece tarde se evalúa contra la hora en que el cliente la reclamó, no contra "ahora" (para no castigar a la tablet offline).
- Límite de ritmo: 15 reclamos por minuto por cliente (`settings.rate_limits`).
- Primer cliente en escanear una venta se la queda (una venta, un dueño).
- Las Edge Functions (Deno) no pasan por `tsc`; se validan al servirlas y con los tests de integración.
- Cómo correr cada nivel de tests: `npm test` (unitarios), `npx supabase test db` (SQL), `npm run test:integration` y `npm run test:e2e` (requieren `npx supabase start` y `npm run functions` corriendo).

## Ideas para después

- (vacío)
