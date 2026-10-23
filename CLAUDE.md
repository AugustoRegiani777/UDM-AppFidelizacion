# Uno de Miga · App de fidelización

App web (PWA) de fidelización para **Uno de Miga**, sandwichería artesanal argentina en Valencia (Carrer Llop 1). El cliente escanea un QR, entra con Google, suma puntos por cada compra en el local, desbloquea premios y juega minijuegos. Debe sentirse viva, divertida y llena de animaciones (inspiración Temu en la mecánica), pero con la estética limpia de la marca.

Idioma de la UI: **español rioplatense** (vos, tenés, sumá). Código, nombres de variables y commits en inglés; comentarios en español si ayudan.

## Documentación (leer antes de tocar un área)

- `docs/01-producto.md` — qué hace la app, flujos, reglas de negocio, decisiones abiertas.
- `docs/02-arquitectura.md` — stack, estructura de carpetas, modelo de datos, funciones, seguridad.
- `docs/03-integracion-pos.md` — contrato con el sistema del local (POS) y el modo mock.
- `docs/04-diseno-y-animaciones.md` — tokens de diseño, sistema de animación, juegos y límites éticos.
- `docs/05-negocio-y-mercado.md` — la tienda, los clientes, la voz de marca y el mercado. Leer antes de escribir textos o diseñar.
- `docs/marca/` — brandbook oficial (si está). Sus colores y tipografías mandan sobre los tokens de docs/04.
- `PROMPTS.md` — el plan de trabajo por fases. Trabajamos una fase por vez.

## Stack

React + TypeScript + Vite · Tailwind CSS · Motion (`motion/react`) · React Router · TanStack Query · Supabase (Auth con Google, Postgres, Edge Functions, pg_cron) · vite-plugin-pwa · dotLottie + canvas-confetti · Vitest + Playwright · Hosting en Netlify.

## Reglas de oro (no negociables)

1. **El cliente nunca decide puntos ni premios.** Todo cálculo de puntos, canjes y resultados de juegos ocurre en el servidor (Edge Functions / funciones SQL). El frontend solo muestra.
2. **El QR de venta solo lleva el uuid de la venta.** Importe, fecha y estado se leen del POS desde el servidor.
3. **Los puntos son un libro de movimientos** (`point_movements`). El saldo se calcula, nunca se guarda como número editable.
4. **RLS activado en todas las tablas.** El cliente solo lee lo suyo. Las escrituras sensibles van por funciones con `security definer` o Edge Functions con service role.
5. **Esta app NO comparte base de datos con el POS.** Se comunica solo por el contrato de `docs/03-integracion-pos.md`. Mientras el POS no esté listo, se usa el adaptador en modo `mock`.
6. **Nunca se toca la base real del local.** Desarrollo contra Supabase local (CLI + Docker).
7. **Animaciones solo con `transform` y `opacity`**, respetando `prefers-reduced-motion`. Tiene que ir a 60 fps en un Android de gama media.
8. **Sin patrones engañosos:** nada de cuentas regresivas falsas, escasez inventada ni popups imposibles de cerrar (ver docs/04).
9. **Secretos solo en variables de entorno.** Nunca en el código ni en el repo. Mantener `.env.example` actualizado.

## Cómo trabajamos

- Antes de escribir código en una fase nueva: proponer un plan corto y esperar mi OK.
- Cambios chicos y verificables. Al terminar cada paso: correr lint, typecheck y tests, y decirme cómo probarlo a mano.
- Un commit por paso terminado, con mensaje claro.
- Si una decisión de negocio no está definida (ver "Decisiones abiertas" en docs/01), preguntar en vez de inventar. Si hay que avanzar, dejarla configurable en la tabla `settings`.
- Si algo del plan parece mal, decirlo antes de hacerlo.

## Comandos

- `npm run dev` — frontend local (accesible desde el celular en la red local)
- `npm run build` / `npm run preview` — build de producción (con PWA) y vista previa
- `npm run lint` / `npm run typecheck` / `npm test` — chequeos (los tres deben quedar en verde antes de cada commit)
- `npm run format` — Prettier
- `npx supabase start` — Supabase local (requiere Docker Desktop encendido)
- `npm run check` — lint + typecheck + tests unitarios
- `npm run test:integration` / `npm run test:e2e` — requieren Supabase local y `npm run functions` corriendo
- `npm run db:test` / `npm run db:reset` / `npm run db:types` — base de datos local
- `npm run dev:https` — web con HTTPS local (necesario para la cámara en el celular)
