# Plan de trabajo · prompts para Claude Code

Cómo usarlo:

- **Una fase por sesión.** Al terminar una fase, empezá una conversación nueva para la siguiente (el contexto queda en CLAUDE.md y docs/, así que no se pierde nada).
- Pedile siempre que **planifique primero** y aprobá el plan antes de que escriba código.
- Probá vos lo que hizo antes de pasar a la siguiente fase.
- Si algo no te gusta, decíselo en la misma fase. No avances con dudas.

---

## Fase 0 · Preparación (la hacés vos, una sola vez)

1. Instalar **Node.js LTS**, **Git** y **Docker Desktop** (lo necesita Supabase local).
2. Copiar todos estos archivos dentro de la carpeta `Proyecto tarjeta fidelizacion`.
3. Crear un repo en GitHub y conectarlo a la carpeta.
4. Crear una cuenta o proyecto nuevo en **Supabase** llamado `unodemiga-fidelizacion` (separado del POS). Se usa recién en la fase 9; antes trabajamos local.
5. En **Google Cloud Console**, crear credenciales OAuth para "Entrar con Google" (Claude te guía en la fase 3, cuando haga falta).

---

## Fase 1 · Esqueleto del proyecto

```
Leé CLAUDE.md y todos los archivos de docs/. Estamos en la Fase 1 de PROMPTS.md: crear el esqueleto del proyecto.

Objetivo:
- Proyecto Vite + React + TypeScript (strict) con la estructura de carpetas de docs/02.
- Tailwind configurado con los tokens de docs/04 y las fuentes Bricolage Grotesque e Inter.
- Motion, React Router, TanStack Query y vite-plugin-pwa instalados y configurados (manifest con nombre "Uno de Miga", colores de marca, íconos placeholder).
- ESLint, Prettier, Vitest y un script de typecheck.
- .env.example con las variables de docs/02. .gitignore correcto.
- Una pantalla de prueba con el saldo "179" usando <CountUp> y un botón con <Pressable>, para comprobar que fuentes, tokens y animaciones funcionan.
- Completar la sección "Comandos" de CLAUDE.md.

Antes de escribir código, mostrame el plan y las versiones que vas a usar. Verificá la API actual de cada librería.
```

## Fase 2 · Base de datos local

```
Fase 2 de PROMPTS.md: Supabase local y modelo de datos.

- Inicializar Supabase CLI en el proyecto y levantarlo local.
- Migraciones SQL para todo el modelo de docs/02: tablas, constraints (sale_uuid y code únicos), índices, funciones customer_balance, customer_purchase_count y customer_dashboard.
- RLS en todas las tablas según docs/02. Escribí tests SQL o scripts que demuestren que un cliente NO puede leer datos de otro ni insertar movimientos.
- seed.sql con settings y rewards de docs/01, más la tabla dev_mock_sales con casos de prueba (válida, anulada, glovo, vieja, inexistente).
- Generar los tipos TypeScript de la base en src/lib.

Mostrame el plan y el esquema antes de escribir las migraciones.
```

## Fase 3 · Login con Google y bienvenida

```
Fase 3 de PROMPTS.md: autenticación.

- Login con Google vía Supabase Auth (local primero). Guiame paso a paso con lo que tengo que configurar en Google Cloud y en Supabase.
- Portada sin login que explica el programa (simple por ahora).
- Pantalla de bienvenida la primera vez: nombre editable, consentimiento obligatorio del programa y opcional de promos, por separado, guardando fechas en profiles.
- Rutas protegidas. La ruta /s/:uuid debe recordar el uuid si el usuario no está logueado y retomarlo después del login.
- Perfil con cerrar sesión y "borrar mi cuenta" (Edge Function delete-account).
```

## Fase 4 · Sumar compras (con el POS en modo mock)

```
Fase 4 de PROMPTS.md: reclamar ventas.

- supabase/functions/_shared: pos-adapter.ts (mock y real según docs/03), hmac.ts, cors.ts, errors.ts.
- Edge Function claim-sale con todas las validaciones de docs/01, transaccional, con estado pending si la venta no aparece.
- Ruta /s/:uuid que llama a claim-sale y muestra: resultado, pendiente o error amable.
- Pantalla /dev (solo en desarrollo) que simula la tablet: crear una venta mock y mostrar su QR, para poder escanearlo con el celular en la red local.
- Tests de la función para cada caso: válida, duplicada, anulada, glovo, vieja, inexistente, pendiente.
```

## Fase 5 · El panel

```
Fase 5 de PROMPTS.md: panel del cliente.

Construí el panel según docs/01 y docs/04, tomando como referencia el boceto (saldo grande, botón "Escanear mi compra", premios con barra y "te faltan X", últimas compras).
- Datos reales vía customer_dashboard con TanStack Query.
- Estados de carga con skeletons animados, estado vacío para clientes nuevos ("Tu primera compra suma puntos").
- Historial completo de puntos.
- Escáner interno con BarcodeDetector y fallback.
Todavía sin celebraciones complejas: priorizá que se vea limpio y funcione.
```

## Fase 6 · Canje de premios

```
Fase 6 de PROMPTS.md: canjes.

- Edge Function create-redemption y pantalla del código con cuenta regresiva real.
- Edge Function validate-redemption con verificación HMAC (la llamará el POS), atómica, que descuenta puntos al validar.
- En /dev, un simulador de caja para validar un código como lo haría el POS.
- Tests de canje: válido, vencido, usado, premio no alcanzado, doble validación simultánea.
```

## Fase 7 · Sistema de animación y celebraciones

```
Fase 7 de PROMPTS.md: motion.

Implementá src/motion/ completo según docs/04: presets, CountUp, ProgressBar con brillo, Celebration (confetti + Lottie + vibración + sonido opcional), PopupQueue, Sheet, transiciones de pantalla.
Aplicalo a todos los momentos del catálogo de docs/04.
Respetá prefers-reduced-motion y las reglas técnicas. Al final, decime cómo probar el rendimiento en mi Android.
```

## Fase 8 · Juegos

```
Fase 8 de PROMPTS.md: juegos.

Empezá por la raspadita post-compra y la ruleta diaria (docs/04).
- Edge Function play-game: el servidor decide el resultado antes de la animación; límites diarios y presupuesto configurables en settings.
- La animación solo "actúa" el resultado.
- Sección "¿Cómo funciona?" con las probabilidades.
Antes de programar, proponeme la tabla de premios y probabilidades para que la apruebe.
```

## Fase 9 · Reconciliación y producción

```
Fase 9 de PROMPTS.md: robustez y deploy.

- Edge Function reconcile programada con pg_cron (pendientes, vencidos, anulaciones con reversal, códigos vencidos).
- Tests end-to-end con Playwright de los flujos principales.
- Deploy: migrar al proyecto Supabase de producción, configurar Google OAuth de producción y publicar en Netlify. POS_MODE sigue en mock hasta que el POS esté listo.
- Checklist de lanzamiento: textos legales, íconos reales, dominio, prueba en iPhone y Android.
```

## Fase 10 · Conectar el POS real

Se hace en el **repo del POS**, con el prompt que está al final de `docs/03-integracion-pos.md`. Cuando esté probado en staging, en esta app se cambia `POS_MODE=real`.
