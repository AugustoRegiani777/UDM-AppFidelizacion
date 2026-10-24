# Informe final

La app de fidelización de Uno de Miga está construida de punta a punta y probada en local con el POS en modo mock. **No se publicó nada** y no se tocó el POS ni su base.

## 1. Qué quedó hecho

- Portada pública (sirve de entrada para el QR fijo y el sticker NFC), login con Google y bienvenida con consentimientos separados.
- Sumar compras: escáner dentro de la app (camino principal) y cámara nativa del celular (`/s/<uuid>`), con login en el medio sin perder la compra (también en iPhone).
- Casos raros resueltos: venta duplicada, anulada, de Glovo / Too Good To Go, vieja, que el POS todavía no conoce (queda pendiente y se acredita sola) y anulada después de sumada (se descuentan los puntos).
- Panel con saldo grande, premios con barra y "te faltan X", racha de semanas, últimas compras e historial completo.
- Canje: código `MIGA-XXXX` con cuenta regresiva real, validación desde la caja con firma HMAC, descuento de puntos al validar y protección contra doble uso simultáneo.
- **Puntos que no se gastan:** el saldo es un total que solo sube. Cada premio es un escalón repetible (café cada 150 puntos acumulados, sanguche cada 300…). Canjear no baja nada.
- **Cofre con juego:** para canjear un premio hay que pasar "Sobreviví a las migas" (arcade de 50 segundos: movés tu sanguche con el dedo, tira migas solo, juntás gemas, subís de nivel y elegís mejoras, hay oleadas y una Reina hormiga). El servidor **reproduce la partida** con la misma simulación para confirmar que se ganó. Intentos ilimitados y modo relajado tras 2 derrotas.
- **Segundo juego, Skate de Miga:** en horizontal, con los dos pulgares. Bajás rampas, saltás gaps, hacés trucos que cargan el turbo y llegás a la meta sin quedarte sin vidas. El cofre elige uno de los dos juegos.
- **Misiones de puntos extra:** seguir en Instagram (suma al instante) y reseña de Google Maps (la aprobás vos desde `/admin`).
- **Comunidad de recomendaciones:** lugares argentos de Valencia por categoría, con likes anónimos, comentarios, alias y puntos por participar; todo moderable desde `/admin`.
- Juegos de azar livianos: raspadita después de cada compra y ruleta diaria, con el resultado decidido en el servidor, límites, tope diario y las probabilidades visibles en "¿Cómo funciona?".
- Animaciones y celebraciones (check que se dibuja, confetti, regalo que se abre, código que se imprime), con respeto por "Reducir movimiento"; sonido apagado por defecto.
- Reconciliación automática cada 5 minutos, borrado de cuenta y datos, y todo preparado para publicar (`docs/DEPLOY.md`).
- Preparado para el Wallet de Apple/Google: cada cambio de saldo deja un evento (`balance_events`).

**Pruebas automáticas:** 172 de base de datos (incluye seguridad entre clientes), 67 unitarias (incluye los motores de los dos juegos y bots que prueban el balance), 39 de integración con las funciones reales y 11 de navegador de punta a punta. Las pruebas pueden fallar de forma intermitente justo después de reiniciar los servicios (las funciones tardan en arrancar); se repiten y pasan.

## 2. Cómo probarlo en tu celular (paso a paso)

**Usuario de prueba permanente (administrador):** `augusto@unodemiga.test` / `miga1234`. Ya pasó la bienvenida y se puede usar en el login por email.

**Preparación (una vez por sesión)**

1. Hacé doble clic en `Iniciar app.bat`. Prende Docker, la base de datos y la web, y abre el navegador en la compu.
2. Para usar la cámara del celular hace falta una dirección segura. Cerrá la ventana de la web y en una terminal de la carpeta corré `npm run dev:https`. Va a mostrar una dirección "Network", por ejemplo `https://192.168.1.20:5173`.
3. La compu y el celular tienen que estar en el mismo Wi-Fi. Si Windows pregunta por permisos de red, tocá "Permitir".
4. En la compu abrí `https://192.168.1.20:5173/dev` (tu dirección). Si el navegador avisa del certificado, tocá "Avanzado" → "Continuar". Esta pantalla simula la tablet del local y la caja.

**En el celular**

1. Abrí la misma dirección (sin `/dev`) y aceptá el aviso del certificado. Vas a ver la portada.
2. _Registro:_ en la parte "Solo desarrollo" escribí un email inventado y una contraseña de 6 letras o más → "Entrar con email". En la bienvenida dejá el nombre, tildá la primera casilla y tocá "Empezar a sumar". (El botón de Google funciona recién cuando cargues las credenciales: ver `PENDIENTES-AUGUSTO.md`.)
3. _Sumar con el escáner:_ en la compu, en `/dev`, tocá "Crear venta y mostrar QR". En el celular tocá "Escanear mi compra" → "Activar cámara" → apuntá al QR de la compu. Aparece "¡Sumaste X puntos!".
4. _Sumar con la cámara nativa:_ creá otra venta en `/dev` y escaneá el QR con la cámara normal del celular. Si no estás logueado te pide entrar y después suma sola.
5. _Casos raros:_ en `/dev` creá una venta con canal "Glovo" (explica que no suma), una con "Vendida hace 180 minutos" (pasó el tiempo), una con "Aparece en el POS en 60 segundos" (queda pendiente y se acredita sola) y una anulada.
6. _Premio y canje:_ creá una venta de 160 €. Se abre el regalo "un café va por la casa" → "Canjear". En la compu, en `/dev` sección "Caja", escribí el código que muestra el celular y tocá "Validar código": el celular pasa solo a "¡Listo!" y se descuentan los puntos.
7. _Juegos:_ después de una compra tocá "¡Raspá tu premio!" y raspá con el dedo. En el panel entrá a "Ruleta diaria" y girá. Probá "¿Cómo funciona?".
8. _Perfil:_ activá los sonidos, cerrá sesión, y probá "Borrar mi cuenta y mis datos".
9. _Instalar:_ en el menú del navegador elegí "Agregar a pantalla de inicio" (solo funciona bien con la versión publicada).

Para el rendimiento en Android: `docs/RENDIMIENTO.md`.

## 3. Decisiones tomadas por defecto (y dónde cambiarlas)

Todas se cambian en Supabase → Table editor, o en `docs/PROGRESO.md` (sección "Decisiones tomadas por defecto").

| Decisión                       | Valor                                                                        | Dónde                               |
| ------------------------------ | ---------------------------------------------------------------------------- | ----------------------------------- |
| Puntos por euro                | 1 (redondeo hacia abajo)                                                     | tabla `settings`, `points_per_euro` |
| Tiempo para reclamar una venta | 2 horas                                                                      | `claim_window_hours`                |
| Validez del código de canje    | 15 minutos                                                                   | `redeem_code_minutes`               |
| Canales que no suman           | Glovo, Too Good To Go                                                        | `excluded_channels`                 |
| Premios                        | café 150 pts, sanguche 300 pts, gorra 1000 pts, media docena cada 50 compras | tabla `rewards`                     |
| Premio por compras             | se repite cada 50 compras y no gasta puntos                                  | lógica en `create_redemption`       |
| Los puntos no vencen           | —                                                                            | no hay vencimiento                  |
| Juegos                         | raspadita y ruleta con premios chicos y tope diario de 1000 puntos           | `settings.games`                    |
| Revisión de anulaciones        | ventas de los últimos 7 días                                                 | `reversal_check_days`               |
| Marca                          | crema y rojo provisorios, Poppins y Bebas Neue                               | `src/styles/index.css`              |

## 4. Lo que queda pendiente de tu lado

Ver `docs/PENDIENTES-AUGUSTO.md` (con instrucciones paso a paso): brandbook y logo, credenciales de Google, textos legales con la gestoría, crear el proyecto de Supabase y Netlify, dominio, QR fijo y sticker NFC, y las pruebas en iPhone y Android reales.

## 5. Riesgos y deudas técnicas conocidas

- **No se probó en un celular real.** Todo se probó con navegador de escritorio emulando un Pixel 5. La raspadita con el dedo en celular real y el rendimiento en Android de gama media hay que verlos en mano (el test de raspado usa eventos de puntero sintéticos porque el mouse emulado no entregaba el "apretar").
- **Quien escanea primero se queda con la venta.** Si alguien le saca foto al QR de la tablet y lo escanea antes, se lleva los puntos. La ventana de 2 horas y el QR de 60 segundos limitan el riesgo; se puede endurecer (por ejemplo, QR de un solo uso con vencimiento corto del lado del POS).
- **Firma HMAC sin "nonce":** una llamada firmada podría repetirse dentro de los 5 minutos de validez. `validate-redemption` es idempotente (un código usado no se vuelve a usar), así que el impacto es bajo.
- **Juego:** un bot perfecto (programado con el mismo motor) podría ganar el cofre; solo se saltearía la ceremonia, porque el premio ya lo habilitan los puntos. La dificultad se calibró con un bot, no con personas: conviene probarla con clientes reales y ajustar `settings.chest_game.overrides`. Los íconos de las mejoras son emojis (se ven distinto según el celular).
- **Skate sin probar en un celular real:** los dos pulgares, la pantalla completa y el bloqueo de horizontal solo se probaron con teclado y navegador de escritorio. Hay que verificar que el joystick y el botón se sientan bien con los pulgares, y calibrar la dificultad con personas (el bot gana en ~26 s).
- **Comunidad:** al haber contenido de usuarios, hace falta moderar con regularidad y sumar reglas de convivencia a los textos legales (ver PENDIENTES, sección 9). Los comentarios se publican al instante y se ocultan solo al ser reportados.
- **Reseñas de Google con puntos:** riesgo asumido (política de Google).
- **Las Edge Functions (Deno) no pasan por el typecheck de TypeScript;** se validan al correrlas y con los tests de integración.
- **Animaciones con SVG en vez de Lottie:** pesan menos, pero si la marca quiere animaciones de diseño propias, hay que sumar archivos `.lottie`.
- **Bundle:** ~268 KB la pantalla inicial (80 KB comprimida); se podría bajar usando `LazyMotion`.
- **Sin mediciones aún del rendimiento del juego en celulares reales** (hay resolución adaptativa y se probó en navegador de escritorio).
- **Solo español.** Los textos están centralizados en `src/copy/es.ts`, listos para sumar inglés.
- **Texto de privacidad provisorio.**
- **Cofre de racha y álbum de sabores** (docs/04) no se hicieron. Sistema de puntuación y niveles: pendiente de definir (se evalúa a futuro).
- El saldo puede quedar negativo si se anula una venta cuyos puntos ya se gastaron.

## 6. Próximos pasos

1. **Conectar el POS real** (`docs/03-integracion-pos.md`): abrir el repo del POS y pasarle a Claude el prompt del final de ese documento (función `loyalty-sale`, QR en la tablet, botón "Canjear premio"). Probar en staging; después cambiar `POS_MODE=real` en la app. **No lanzar a clientes antes de esto.**
2. **Publicar** siguiendo `docs/DEPLOY.md` y `docs/CHECKLIST-LANZAMIENTO.md`.
3. **Fase del Wallet (Apple/Google):** ya existe la tabla `balance_events`. Falta elegir proveedor de pases (Cheerfy, Zerosix, Loyicard u otro), un proceso que lea los eventos sin procesar, actualice el pase y marque `processed_at`, y un botón "Agregar a Wallet" en el panel.
4. Cofre de racha y álbum de sabores, y mediciones de uso para ajustar premios.
