# 01 · Producto

## Contexto del negocio

- Uno de Miga: sandwichería artesanal argentina en Valencia. Unos 113 sandwiches por día, 8 variedades, más bollería y cafetería. Catálogo de unos 40 productos.
- Una sola persona maneja caja, producción y stock desde una tablet Android con el sistema propio del local (el "POS").
- Medios de pago: efectivo, tarjeta, Bizum (pedidos) y plataformas (Glovo, Too Good To Go).

## Alcance de esta versión

**Solo fidelización.** Sin pedidos online (eso viene después, ya está pensado en la arquitectura).

## Flujos

### 1. Registro (una vez)

1. El cliente escanea el QR fijo del mostrador → abre la app.
2. Puede ver una portada atractiva de cómo funciona el programa sin estar logueado.
3. Toca "Entrar con Google".
4. Primera vez: pantalla de bienvenida con su nombre (de Google, editable), check obligatorio de aceptación del programa y check opcional y separado para recibir promos.
5. Entra a su panel. La sesión queda guardada.
6. Se le sugiere "Agregar a la pantalla de inicio".

### 2. Sumar una compra

1. El cliente compra en el local; la venta se cobra en el POS como siempre.
2. Al confirmar la venta, la tablet muestra un QR con la URL `https://<app>/s/<venta_uuid>`.
3. El cliente lo escanea con el **escáner dentro de la app** (camino principal) o con la cámara nativa del celular (también funciona).
4. La ruta `/s/:uuid` abre la app. Si no está logueado, primero login y después sigue.
5. El servidor consulta la venta al POS, valida y suma los puntos.
6. Pantalla de celebración: "+62 puntos", premio desbloqueado si corresponde, cuánto falta para el próximo.

**Validaciones del servidor:**

- La venta existe y no está anulada.
- Es reciente (ventana configurable, por defecto 2 horas).
- No fue reclamada antes (una venta, un solo dueño).
- No viene de Glovo ni de Too Good To Go (no suman puntos).
- Si la venta aún no sincronizó al POS en la nube (la tablet es offline-first), queda **pendiente** y se acredita sola cuando aparezca. Nunca mostrar un error seco.
- Si una venta ya acreditada se anula después, se descuentan sus puntos con un movimiento inverso.

### 3. Canjear un premio

1. Cuando el cliente alcanza un premio, se desbloquea en su panel.
2. Toca "Canjear" → el servidor genera un código único (ej. `MIGA-7K3P`) con vencimiento (por defecto 15 minutos).
3. Lo muestra en caja. En la tablet del POS se carga el código.
4. El POS valida el código contra esta app (ver docs/03), lo marca como usado y registra el producto a 0 € o el descuento.
5. Los puntos se descuentan **al validar el código en caja**, no al generarlo. Si el código vence, no se pierde nada.

### 4. Juegos (fase posterior del plan)

Ver docs/04. Resultados siempre decididos por el servidor, con límites diarios.

## Decisiones de producto (octubre 2026)

- **Escáner dentro de la app = camino principal.** "Escanear mi compra" abre la cámara, con un mensaje previo que explica para qué se pide el permiso. `BarcodeDetector` con fallback a una librería liviana. Si el permiso se niega: instrucciones para habilitarlo y opción de escribir el código a mano.
- **El QR de venta es un link** `{APP_URL}/s/{venta_uuid}`. Con la cámara nativa también funciona: la ruta guarda el uuid, pide login si hace falta y lo procesa después.
- **iPhone:** una PWA instalada no comparte sesión con Safari. El flujo de `/s/:uuid` sobrevive a un login nuevo sin perder el uuid.
- **NFC:** sticker en el mostrador con el link a la portada. La portada es un punto de entrada perfecto, sin código especial.
- **Wallet Apple/Google:** fuera de alcance. La arquitectura emite un evento cuando cambia el saldo para sumarlo después.

## Pantallas

1. Portada / cómo funciona (sin login)
2. Login y bienvenida (consentimientos)
3. **Panel**: saldo grande, botón "Escanear mi compra", premios con barra de progreso y "te faltan X", últimas compras
4. Escáner (cámara)
5. Resultado de compra (celebración)
6. Compra pendiente de confirmar
7. Detalle de premio y código de canje con cuenta regresiva
8. Historial completo de puntos
9. Perfil: datos, consentimientos, cerrar sesión, **borrar mi cuenta y mis datos**
10. Juegos (ruleta, raspadita, etc.)

Hay un boceto de referencia de Panel, Resultado y Canje (diseño limpio, tipografía grande, crema y negro con dorado).

## Reglas de negocio (valores iniciales, todos configurables en `settings`)

| Clave                 | Valor inicial | Nota                                                   |
| --------------------- | ------------- | ------------------------------------------------------ |
| `points_per_euro`     | 10            | Puntos por cada euro de la venta, redondeo hacia abajo |
| `claim_window_hours`  | 2             | Tiempo para reclamar una venta                         |
| `redeem_code_minutes` | 15            | Validez del código de canje                            |
| `excluded_channels`   | glovo, togoo  | Ventas que no suman                                    |

### Premios iniciales (tabla `rewards`)

| Premio                | Tipo    | Umbral     |
| --------------------- | ------- | ---------- |
| Un café               | puntos  | 400        |
| Un sanguche de miga   | puntos  | 800        |
| Gorra Uno de Miga     | puntos  | 2500       |
| Media docena de migas | compras | 50 compras |

Los premios por **compras** cuentan compras confirmadas y no consumen puntos.

## Decisiones abiertas (preguntar antes de cerrar)

- ¿Canjear un premio por puntos descuenta los puntos (modelo actual) o son hitos acumulativos?
- Regla definitiva de puntos (¿por euro o por compra/sello?).
- ¿Los premios por compras se pueden ganar más de una vez (compra 50, 100…)?
- ¿Los puntos vencen?
- Premios y límites de los juegos.
- Dominio definitivo de la app.

## Privacidad (RGPD)

- Datos mínimos: nombre, email y foto de Google; nada más es obligatorio.
- Consentimiento del programa y de promos por separado, con fecha guardada.
- Texto legal corto y claro (lo revisa la gestoría antes del lanzamiento).
- El cliente puede borrar su cuenta y todos sus datos desde el perfil.

## Nuevo alcance (octubre 2026)

- **Puntos que no se gastan.** El saldo es un total acumulado que solo sube. Cada premio es un escalón repetible: el café se desbloquea cada 150 puntos acumulados, el sanguche cada 300 (reemplaza la regla anterior de "descontar al validar"). Canjear no mueve el saldo.
- **Cofre con juego.** Para canjear un premio desbloqueado hay que pasar un juego corto ("Sobreviví a las migas"). Intentos ilimitados; tras 2 derrotas se ofrece un modo relajado. El juego es la ceremonia: el premio lo habilitan los puntos.
- **Misiones de puntos extra:** seguir a Uno de Miga en Instagram (una vez, sin verificar) y reseña en Google Maps (una vez, aprobación manual).
- **Comunidad:** recomendaciones de lugares de Valencia (pizzerías argentinas, medialunas, cafés, helados). Se suman puntos por proponer un lugar, comentar y dar like; los likes son anónimos; todo se modera desde un panel de administración.
- Pendiente de definir: sistema de puntuación y niveles.

- **Juegos del cofre (octubre 2026):** además de "Sobreviví a las migas", hay "Skate de Miga" (2D en horizontal, dos pulgares, trucos que cargan turbo). El servidor elige uno al azar al abrir el cofre y lo mantiene mientras el cliente siga perdiendo.

## Actualización: economía de puntos (octubre 2026)

La escala se calibró con la tarjeta de papel del local (5 compras = 1 café, 10 compras = 1 sanguche, ticket de 8 EUR): **10 puntos por euro**, café cada 400 puntos y sanguche cada 800. Las reglas completas, los topes y el plan están en `docs/06-economia-de-puntos.md`. Resumen de lo que cambió respecto de lo de arriba:

- Hay dos monedas separadas: **puntos de compra** (total ganado que define los escalones de comida + saldo gastable) y **monedas de juego** (se ganan jugando, nunca se canjean por comida).
- **Sobreviví a las migas**: un minuto de hormigas y después la Reina; se gana matándola y cuanto más rápido, más puntaje. Los poderes se juntan en burbujas (hasta 3 de cada uno) y se sueltan a mano.
- **Partidas oficiales** (Sobreviví y Skate de Miga): las valida el servidor repitiendo la partida. Dan puntaje para el ranking, monedas (con tope diario) y un pase de desafío (con tope de pases guardados). Un pase abre el cofre de un premio sin volver a jugar.
- **Tienda**: con puntos de compra se compran mejoras de personaje y premios del local con código para la caja; con monedas, pases. Gastar no atrasa los escalones.
- **Rankings** por juego (y nivel) y general por puntos acumulados; cada cliente puede ocultarse. Las partidas con mejoras tienen su propio ranking.
- Panel de administración: cuánto cuestan los premios sobre las ventas (costos supuestos en `settings.reward_costs`).
