# 02 · Arquitectura

## Visión general

```
[Celular del cliente]                 [Supabase: proyecto FIDELIZACIÓN]          [POS del local]
 PWA React  ──── auth Google ───────▶  Auth
            ──── lecturas (RLS) ────▶  Postgres (tablas propias)
            ──── acciones ──────────▶  Edge Functions ── HMAC ──────────────▶  Netlify Function del POS
                                        (claim, redeem, play, reconcile)  ◀──  (consulta venta / valida canje)
```

- Dos proyectos Supabase **separados**: el del POS (existente, no se toca) y el de fidelización (nuevo).
- El navegador del cliente **nunca** habla con el POS.
- El servidor de fidelización habla con el POS solo por las funciones del contrato (docs/03), firmadas con HMAC.

## Stack y por qué

| Pieza              | Elección                                                       | Motivo                                                            |
| ------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------- |
| Framework          | React + TypeScript + Vite                                      | Ecosistema de animación más rico; tipado para no romper nada      |
| Estilos            | Tailwind CSS                                                   | Rápido, consistente con tokens                                    |
| Animación          | Motion (`motion/react`)                                        | Springs, gestos, layout animations, `AnimatePresence` para popups |
| Celebraciones      | dotLottie (`@lottiefiles/dotlottie-react`) + `canvas-confetti` | Animaciones ricas y livianas                                      |
| Juegos             | Canvas 2D / SVG + Motion                                       | Ruleta y raspadita sin librerías pesadas                          |
| Ruteo              | React Router                                                   | Rutas como `/s/:uuid`                                             |
| Datos              | TanStack Query + supabase-js                                   | Caché, reintentos, estados de carga                               |
| Estado UI          | Zustand (solo si hace falta)                                   | Colas de popups, sonido on/off                                    |
| PWA                | vite-plugin-pwa                                                | Instalable, ícono, actualizaciones                                |
| QR en app          | API `BarcodeDetector` con fallback a una librería liviana      | Escáner interno opcional                                          |
| Backend            | Supabase Edge Functions (Deno) + funciones SQL                 | Lógica junto a la base                                            |
| Tareas programadas | pg_cron                                                        | Reintentar pendientes, vencer códigos                             |
| Tests              | Vitest (unidad), Playwright (flujos)                           |                                                                   |
| Hosting            | Netlify                                                        | Ya se usa para el POS                                             |

Usar las últimas versiones estables y verificar la API actual de cada librería antes de usarla.

## Estructura de carpetas

```
/
├─ CLAUDE.md · PROMPTS.md · docs/
├─ src/
│  ├─ app/            # router, providers, layout
│  ├─ screens/        # una carpeta por pantalla
│  ├─ components/     # UI reutilizable (Button, Card, ProgressBar, Sheet…)
│  ├─ motion/         # presets de animación, Celebration, PopupQueue, CountUp
│  ├─ games/          # ruleta, raspadita…
│  ├─ features/       # lógica por dominio: auth, points, rewards, claims
│  ├─ lib/            # supabase client, query client, utils
│  ├─ assets/         # lottie, sonidos, ilustraciones
│  └─ styles/         # tokens y Tailwind
├─ supabase/
│  ├─ migrations/     # SQL versionado
│  ├─ functions/      # Edge Functions + _shared/ (pos-adapter, hmac, cors)
│  └─ seed.sql
├─ tests/ (e2e)
├─ public/            # íconos PWA, manifest
└─ .env.example
```

## Modelo de datos (Postgres, schema `public`)

- **profiles** — `id` (= auth.users.id), `display_name`, `avatar_url`, `program_consent_at`, `promo_consent` (bool), `promo_consent_at`, `created_at`.
- **settings** — `key` (pk), `value` (jsonb). Reglas de negocio configurables.
- **rewards** — `id`, `name`, `description`, `kind` (`points` | `purchases`), `threshold`, `active`, `sort_order`, `image_url`.
- **claims** — una venta reclamada: `id`, `customer_id`, `sale_uuid` (**unique**), `status` (`pending` | `confirmed` | `rejected` | `reversed`), `reject_reason`, `sale_total_cents`, `sale_at`, `points`, `created_at`, `updated_at`.
- **point_movements** — libro: `id`, `customer_id`, `kind` (`purchase` | `redeem` | `game` | `adjustment` | `reversal`), `points` (+/−), `ref_table`, `ref_id`, `created_at`. Solo inserciones.
- **redemptions** — `id`, `customer_id`, `reward_id`, `code` (**unique**), `status` (`active` | `used` | `expired`), `expires_at`, `used_at`, `created_at`.
- **game_plays** — `id`, `customer_id`, `game`, `result` (jsonb), `points`, `created_at`.

Vistas o funciones:

- `customer_balance(customer_id)` = suma de `point_movements`.
- `customer_purchase_count(customer_id)` = claims `confirmed`.
- `customer_dashboard()` — devuelve en una llamada saldo, compras, premios con progreso y "te falta", últimas compras.

### RLS

- El cliente puede `select` solo filas con `customer_id = auth.uid()` (y su propio `profiles`).
- `rewards` y `settings` públicos de solo lectura (settings: solo claves no sensibles).
- Ninguna tabla permite `insert`/`update`/`delete` directo al cliente, salvo actualizar sus consentimientos y nombre en `profiles`.
- Todo lo demás pasa por Edge Functions o funciones `security definer`.

## Edge Functions

| Función               | Quién la llama              | Qué hace                                                                                                                                                                                                                         |
| --------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `claim-sale`          | Cliente logueado            | Recibe `sale_uuid`. Consulta la venta vía adaptador POS. Valida (docs/01). En una transacción crea el claim y el movimiento. Si la venta no aparece, deja claim `pending`. Devuelve puntos, nuevo saldo y premios desbloqueados. |
| `create-redemption`   | Cliente logueado            | Verifica que el premio esté alcanzado y genera un código único con vencimiento.                                                                                                                                                  |
| `validate-redemption` | **Servidor del POS** (HMAC) | Recibe el código. Si es válido: lo marca `used`, descuenta puntos (si el premio es por puntos) y devuelve el premio.                                                                                                             |
| `play-game`           | Cliente logueado            | Resultado aleatorio decidido en el servidor, con límites diarios.                                                                                                                                                                |
| `reconcile`           | pg_cron cada 5 min          | Reintenta claims `pending`; vence los que superan la ventana; detecta ventas anuladas y crea `reversal`; vence códigos.                                                                                                          |
| `delete-account`      | Cliente logueado            | Borra sus datos y su usuario.                                                                                                                                                                                                    |

Todo en `supabase/functions/_shared/`: `pos-adapter.ts` (mock y real), `hmac.ts`, `cors.ts`, `errors.ts`.

## Seguridad

- HMAC-SHA256 con timestamp en todas las llamadas entre servidores; rechazar firmas de más de 5 minutos.
- Rate limit básico por usuario en `claim-sale` y `play-game`.
- Generación de códigos con caracteres sin ambigüedad (sin 0/O, 1/I).
- Logs sin datos personales.

## Entornos

- **Local:** Supabase CLI con Docker + `POS_MODE=mock`.
- **Producción:** proyecto Supabase nuevo + Netlify. `POS_MODE=real` solo cuando el POS tenga sus funciones listas.

## Variables de entorno (nombres)

Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`.
Edge Functions: `POS_MODE` (`mock` | `real`), `POS_BASE_URL`, `POS_HMAC_SECRET`, `POS_INBOUND_HMAC_SECRET`.
