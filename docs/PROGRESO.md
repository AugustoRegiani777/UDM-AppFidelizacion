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

- [x] 5.1 Panel con `customer_dashboard` + TanStack Query.
- [x] 5.2 Skeletons y estado vacío.
- [x] 5.3 Historial de puntos.
- [x] 5.4 Escáner interno (BarcodeDetector + fallback + permiso + código manual).

### Fase 6 · Canje

- [x] 6.1 `create-redemption` + pantalla de código con cuenta regresiva.
- [x] 6.2 `validate-redemption` con HMAC, atómica.
- [x] 6.3 Simulador de caja en /dev.
- [x] 6.4 Tests: válido, vencido, usado, no alcanzado, doble validación simultánea.

### Fase 7 · Motion y celebraciones

- [x] 7.1 presets, CountUp, ProgressBar, Pressable, Sheet.
- [x] 7.2 Celebration, PopupQueue, transiciones de pantalla.
- [x] 7.3 Aplicar el catálogo de momentos de docs/04.
- [x] 7.4 Reduced motion + guía de prueba de rendimiento.

### Fase 8 · Juegos

- [x] 8.1 Tabla de premios/probabilidades (valores por defecto en settings).
- [x] 8.2 `play-game` (servidor decide, límites diarios).
- [x] 8.3 Raspadita post-compra.
- [x] 8.4 Ruleta diaria.
- [x] 8.5 "¿Cómo funciona?" con probabilidades.

### Fase 9 · Reconciliación y producción

- [x] 9.1 `reconcile` + pg_cron.
- [x] 9.2 Tests e2e Playwright.
- [x] 9.3 Preparar deploy (netlify.toml, guía) sin ejecutarlo.
- [x] 9.4 Checklist de lanzamiento + INFORME-FINAL.md.

### Fase 10 · Puntos que no se gastan + cofre con juego (nuevo alcance, oct 2026)

- [x] 10.1 Los puntos nunca se descuentan: premio por escalón repetible (`floor(total/umbral) - canjes`). _Hecho cuando:_ canjear no mueve el saldo y los tests SQL lo prueban.
- [x] 10.2 Cofre: `start_chest` / `finish_chest` / `renew_redemption`; el código solo se emite al ganar el juego (tiempo mínimo validado en el servidor, intentos ilimitados, modo relajado tras 2 derrotas).
- [x] 10.3 Juego "Sobreviví a las migas" (canvas, táctil, motor puro testeado).
- [x] 10.4 Pantallas: cofre, juego, resultado; panel y copy actualizados.
- [x] 10.5 Tests de integración y e2e del flujo completo.

### Fase 11 · Misiones de puntos extra + administración

- [x] 11.1 Misiones únicas: seguir en Instagram (sin verificar, puntos chicos) y reseña en Google Maps (pendiente de aprobación manual).
- [x] 11.2 Panel de administración (`/admin`, solo admins) para aprobar misiones.
- [x] 11.3 Tests (RLS, un solo cobro por misión, admin).

### Fase 12 · Comunidad de recomendaciones

- [x] 12.1 Lugares (pizzerías argentinas, medialunas, cafés, helados…), alta con nombre o link de Google Maps, aprobación del admin.
- [x] 12.2 Comentarios y likes anónimos (solo se ve el conteo), con puntos y tope diario.
- [x] 12.3 Moderación en `/admin` (lugares, comentarios, reportes).
- [x] 12.4 Tests (RLS, anonimato, topes, moderación).

### Fase 13 · Segundo juego del cofre: Skate de Miga

- [x] 13.1 Motor determinista de skate compartido con el servidor (física de rampas, trucos con dos pulgares, turbo, caídas, checkpoints) y circuito de ~11 800 unidades en 6 actos.
- [x] 13.2 Cofre multi-juego: el servidor elige el juego (se mantiene mientras el cliente pierde) y valida cada uno con su propio replay.
- [x] 13.3 Cliente: dibujo vectorial en horizontal, controles de dos pulgares (y teclado), HUD, guía, pantalla completa y aviso de "girá el celular".
- [x] 13.4 Tests: motor + bot, integración del cofre con skate y e2e en horizontal.

### Fase 14 · Migas con niveles y poderes + Sala de juegos
- [x] 6 niveles (`STAGES` en el motor): más largos, más enemigos y más rápidos; el nivel 1 es el juego original.
- [x] 3 poderes automáticos nuevos (se activan solos con cooldown, no cambian las entradas del jugador ni el replay): Soldados miga (5 s tirando condimentos), Lluvia de chipás, Medialuna de cebo (atrae y explota).
- [x] Dibujo y sonido de los poderes; tests de cada poder y de los niveles; bot calibrado (nivel 1 ganable, nivel 6 modo experto).
- [x] Sala de juegos `/juegos`: práctica sin premio, niveles que se abren al ganar el anterior (avance local en el dispositivo).
- [x] Sala de juegos con selector: Sobreviví a las migas (6 niveles), Skate de Miga y Miga Racers, todos ilimitados y sin premio.
- [x] Miga Racers (estilo Micro Machines): 3 pistas sobre la mesa de la sandwichería, 3 vueltas contra 3 rivales con IA, derrape, turbo, choques; sube al podio (1º o 2º) para abrir la pista siguiente. Es práctica local, sin validación del servidor (no da premios). Controles: mitad izquierda/derecha de la pantalla para doblar, botón Derrapar; teclado con flechas/AD/espacio.
- [x] Truco argentino (1 contra 1, a 15, sin flor) con envido/real/falta, retruco y vale cuatro; 3 rivales con IA (El Pibe, Doña Rosa, El Maestro). Mate en la mesa: cada sorbo suma suerte para el próximo reparto (mejora visible: se reparten 1 + suerte manos y te toca la mejor); reloj de turno de 25 s y chipá (3 monedas, +15 s). Monedas locales de la sala de juegos.
- [ ] Skate de trucos (rediseño). Básquet tipo NBA Jam y retos online: quedan para después (pedido de Augusto).

### Pendiente de definir (Augusto)

- Sistema de puntuación y niveles (se evalúa después de la Fase 12).

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

- En desarrollo la app habla con Supabase por un proxy de Vite (`/supabase`), así funciona desde el celular y con HTTPS (`npm run dev:https`, necesario para la cámara en el celular).
- Escáner: `BarcodeDetector` si el navegador lo trae; si no, `jsqr` (se descarga bajo demanda). Un QR que no sea de una venta se ignora y sigue buscando.
- "Escribir el código a mano" = pegar el link (o uuid) de la compra: el uuid de una venta es demasiado largo para tipearlo.
- Tests e2e usan una cámara falsa de Chromium con un video de un QR generado al vuelo.

- Códigos de canje: formato MIGA-XXXX sin caracteres ambiguos; un solo código vigente por cliente y premio; premios por compras repetibles cada N compras.
- Pendiente de verificar a mano en navegador: pantalla /canje/:id y el simulador de caja de /dev (la lógica ya está probada por SQL e integración).

- Celebraciones con SVG animado (check que se dibuja, regalo que se abre) en vez de archivos Lottie: pesa menos y no depende de assets externos. `canvas-confetti` se carga bajo demanda. Si más adelante hay un Lottie de marca, se agrega en `src/motion/Celebration.tsx`.
- Sonido: sintetizado con Web Audio (sin archivos), apagado por defecto, toggle en el perfil.
- Los popups viven en la raíz del router (`RootLayout`) porque necesitan navegar. El popup de premio desbloqueado aparece tras una acción del cliente, por eso no cuenta como "espontáneo".
- Pantallas secundarias cargadas bajo demanda (code splitting) para bajar el peso inicial.
- Guía de prueba de rendimiento: `docs/RENDIMIENTO.md`.

- Juegos (tabla de premios aprobada por defecto, editable en `settings.games`): **raspadita** (60 % sin premio, 25 % +5, 10 % +10, 5 % +25; una por compra confirmada, válida 24 h) y **ruleta diaria** (1 giro por día; +5 30 %, +10 18 %, +20 8 %, +50 4 %, sin premio 40 %). Valor esperado ≈ 3,5 puntos por raspadita y 6,9 por giro.
- Tope diario global de puntos regalados por juegos: 1000 (`daily_points_budget`). Agotado, se juega igual pero sin premio; esto se explica en "¿Cómo funciona?".
- Cofre de racha y álbum de sabores quedan para después (ver Ideas).
- La raspadita se acredita al abrirla (el servidor ya decidió); si el cliente sale sin raspar, el premio igual queda en su saldo.

- Reconciliación: `reconcile_maintenance()` (SQL) y la función `reconcile` corren cada 5 min con pg_cron; `schedule_reconcile()` se ejecuta una vez por entorno (local: en seed.sql).
- Deploy preparado, no ejecutado: `netlify.toml`, `docs/DEPLOY.md`, `docs/CHECKLIST-LANZAMIENTO.md`, pasos para Augusto en PENDIENTES (sección 5).
- Íconos PNG provisorios generados desde los SVG (iPhone los necesita); reemplazar con los de marca.
- `Iniciar app.bat` levanta todo el entorno local con doble clic.

- (oct 2026) Puntos que nunca se gastan: el saldo es un total que solo sube; los premios son escalones repetibles. El juego es la ceremonia de desbloqueo: gana el premio quien llega al escalón y pasa el juego; si el cliente hace trampa solo se salta el juego, no gana nada extra.
- (oct 2026) Reseñas de Google Maps dan puntos con aprobación manual (riesgo asumido por Augusto: la política de Google prohíbe reseñas incentivadas). El texto aclara que el puntaje no depende de que la reseña sea positiva.

- (Fase 10) El juego "Sobreviví a las migas" corre sobre una simulación determinista compartida con el servidor (`supabase/functions/_shared/survivors/`, importada en la web con el alias `@engine`). El celular graba las entradas (semilla del servidor + cambios de dirección + mejoras elegidas) y `finish-chest` **reproduce la partida** para decidir si se ganó; el servidor además exige el tiempo real mínimo (85 % de la duración). Quien programe un bot perfecto solo se salta la ceremonia: el premio ya lo habilitan los puntos.
- (Fase 10) La simulación evita sin/cos/pow (solo + − × ÷ y sqrt) y usa un RNG entero (mulberry32), para dar resultados idénticos en Chrome, Safari y Deno.
- (Fase 10) Balance verificado con un bot: quieto nunca gana, un jugador atento gana ~70 %, el modo relajado (tras 2 derrotas) es más fácil. Configurable por `settings.chest_game.overrides` (ej. duración, vidas).
- (Fase 10) Dibujo vectorial a la resolución real (DPR hasta 3) con resolución adaptativa si baja de ~48 fps; efectos solo de render (partículas, vibración); sonidos sintetizados; háptica en golpes y subidas de nivel.
- (Fase 10) El proxy de desarrollo de Supabase pasó de `/supabase` a `/_sb` (chocaba con la carpeta `supabase/` que sirve el motor del juego).

- (Fase 11) Misiones: Instagram (15 puntos, sin verificar, una vez) y reseña de Google Maps (50 puntos, pendiente hasta que el admin la apruebe; se guarda el nombre del cliente en Google para encontrarla). Puntos y links en `settings.missions` (público). Si el admin rechaza, el cliente puede volver a intentar.
- (Fase 11) Rol `profiles.is_admin` (se asigna por SQL, el cliente no puede modificarlo) y `/admin` con las funciones `admin_pending_missions` / `admin_review_mission`, que vuelven a chequear el rol en el servidor.

- (Fase 12) Comunidad: lugares moderados (los aprueba el admin y el autor suma 30 puntos), comentarios que se publican al instante (con botón "Reportar", que los oculta hasta que el admin decida) y likes anónimos (solo se ve el conteo; los comentarios muestran un alias tipo "Miguero 3F9A"). Puntos: +1 por like, +3 por comentario, tope diario de 12 puntos por cliente, máximo 5 comentarios y 3 lugares por día. Dar like por primera vez a un contenido suma una sola vez (quitar y poner no vuelve a sumar). No se puede dar like a lo propio.
- (Fase 12) Todo el acceso a la comunidad es por funciones del servidor: las tablas no tienen permisos para el cliente (RLS sin políticas), así el anonimato de los likes no depende del frontend. Los links de lugares solo aceptan Google Maps.
- (Fase 12) `seed.sql` crea un usuario de prueba permanente (augusto@unodemiga.test / miga1234, administrador). `npm run db:test` reinicia la base antes de correr los tests SQL (asumen base limpia).

- (Fase 13) Skate: meta = completar el circuito sin quedarse sin vidas (3, o 5 en modo relajado). Pulgar izquierdo = 8 direcciones (girar en el aire, turbo ↑ en el suelo, encogerse ↓); pulgar derecho = botón (mantener y soltar = saltar; en el aire, toque = kickflip/heelflip/shove-it según ↑/↓, mantenido = agarre indy/superman/japan; vueltas completas = flips). Los trucos se cobran al aterrizar bien y cargan el turbo, que hace falta para los saltos grandes (diseñado y verificado con un bot: quieto pierde, rodar sin trucos pierde en el final, con trucos y turbo gana en ~26 s; una persona tardará 40-60 s).
- (Fase 13) El cofre elige el juego al azar entre `settings.chest_game.games` (`survivors`, `skate`) y lo mantiene mientras el cliente siga perdiendo, para que pueda practicar. Reglas por juego en `settings.chest_game.overrides.<juego>`.
- (Fase 13) Si el patinador se queda trabado rodando (menos de 35 u/s durante 2,5 s), vuelve al último punto de control sin perder vida.
- (Fase 13) Pantalla completa y bloqueo horizontal se piden al tocar "¡A rodar!" (no todos los navegadores lo permiten; si no, aparece "Girá el celular").

- (Google) Verificación de reseñas: `sync-google-reviews` (pg_cron cada 30 min o botón en `/admin`) trae las reseñas con la API v4 de Google Business Profile y `match_google_reviews()` las cruza con las misiones pendientes. Aprobación automática solo si el nombre de la reseña coincide con el nombre de la cuenta de Google del cliente (`profiles.google_name`, no editable); si solo coincide el nombre escrito, se sugiere al admin. Cada reseña cuenta una vez. Funciona sin credenciales (queda manual). Requiere perfil verificado 60+ días con sitio web y aprobación de Google (PENDIENTES, sección 10).

- (Fase 14) Los poderes nuevos son automáticos (cooldown) para no sumar botones y mantener el replay del servidor igual. El cofre usa el nivel 1 salvo que se configure `stage` en `settings.chest_game.overrides.survivors`; los demás niveles se juegan en la Sala de juegos (práctica, sin premio).
- (Fase 14) Apuestas de puntos entre clientes: Augusto pidió poder apostar puntos; NO está construido. Los puntos se canjean por productos, así que podría ser un juego de azar regulado. Queda en PENDIENTES-AUGUSTO (consulta legal) y, cuando exista lo online, entra apagado por defecto en `settings`.

- (Fase 14) Miga Racers se juega solo en la sala de juegos (sin premio): por eso no hay replay en el servidor. Si algún día da premios, hay que portar la simulación a `_shared` (ya es pura y con semilla) y validar con un registro de entradas como en las migas y el skate.

## Ideas para después

- Más juegos para la misma ceremonia del cofre (tres en línea, reflejos), elegidos al azar por premio.
- Música de fondo y arte de marca para los íconos de las mejoras (hoy son emojis).

- Cofre de racha (se abre al cumplir X semanas seguidas) y álbum de sabores (docs/04): requieren definir premios y datos de variedades.

- (vacío)
- Skate de trucos: flicks con el pulgar, manuals, grinds sobre barandas, combos con multiplicador, niveles tipo parque con puntaje objetivo (2D/2.5D; 3D real descartado por costo y rendimiento).
- Truco (con IA rival) y mate: animación de cebar y tomar; el mate da "suerte +1" visible (parámetro del servidor); un chipá suma segundos al reloj de turno. Se compran con monedas del juego, nunca con puntos de fidelidad.
- Básquet 2 vs 2 tipo NBA Jam: avatar a medida, estrella compañera con IA simple por estados (tirador, pasador, defensor). Online después: primero partidas grabadas (retos asincrónicos, "El Dueño" como bot), luego tiempo real con Supabase Realtime y revalidación en el servidor.
- Miga Racers: objetos para tirar (chorro de ketchup, aceite), más pistas, contrarreloj con fantasma, elegir el autito y retar a otro cliente en partidas grabadas.
