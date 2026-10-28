# Economía de puntos (propuesta para aprobar)

Estado: **implementado hasta el paso 8** (ver «Qué quedó hecho» al final). Pendiente: decisiones de negocio, el online y las apuestas. Reemplaza los números de `docs/01-producto.md` (1 punto por euro, café a 150, sanguche a 300) cuando se apruebe.

## Punto de partida: la tarjeta que hay hoy en el local

- 5 compras → 1 café. 10 compras → 1 sanguche.
- Ticket promedio: 8 €.

La app tiene que dar **lo mismo o un poco más** que la tarjeta de papel. Si da menos, nadie la usa.

## Regla de oro nueva

**El cliente nunca paga nada extra.** Solo compra lo que consumiría igual. A cambio suma puntos. No se venden puntos, mejoras ni pases con dinero. Nunca.

## Dos monedas que no se mezclan

| | Puntos de compra | Monedas de juego |
|---|---|---|
| Se ganan con | Comprar en el local | Jugar |
| Sirven para | Comida, merch, mejoras de personaje | Pases de desafío y cosméticos |
| Se convierten en comida | Sí (por escalones) | **Nunca** |
| Cuestan plata al local | Sí | No |

## Puntos de compra

- **10 puntos por cada euro** (hoy es 1). Un ticket de 8 € da 80 puntos.
- Se cuentan **euros y no compras**: así comprar una cosita de 1 € cinco veces no da un café gratis.
- Dos números por cliente:
  - **Total ganado:** solo sube. Es el que define los escalones de comida.
  - **Saldo gastable:** total ganado menos lo que gastó en mejoras y merch.

### Escalones de comida (repetibles, no consumen puntos)

| Premio | Cada cuántos puntos | Equivale a la tarjeta |
|---|---|---|
| ☕ Café | 400 | ~5 compras de 8 € |
| 🥪 Sanguche de miga | 800 | ~10 compras de 8 € |

Costo para el local (supuesto: café 0,40 €, sanguche 3 €): en 80 € de ventas se regalan 2 cafés + 1 sanguche = 3,80 € → **4,75 % de las ventas.** Igual que la tarjeta de hoy.

### Cosas que se pagan con saldo gastable

| Qué | Precio orientativo |
|---|---|
| Mejoras de personaje (nivel 1 → 3 por juego) | 100 / 250 / 500 |
| Cosméticos (colores, vehículos, estelas) | 50 a 300 |
| Merch (gorra, sticker, taza) | 800 a 2500 |
| Extras de comida (una salsa, un topping) | 150 |

Los precios son **orientativos** y van en la tabla `settings`/`rewards`, no en el código.

## Monedas de juego y pases

- Se ganan jugando (con tope diario). Las valida el servidor.
- **Pase de desafío:** si el cliente ya superó el desafío de un premio, se guarda un pase (**máximo 3 guardados**). Cuando el premio se abre, usa el pase y canjea al instante.
- Sin pase, juega el desafío en el momento. Intentos ilimitados. Después de 2 derrotas se ofrece el modo relajado (el premio es el mismo).
- Desafíos: café → "Sobreviví a las migas". Sanguche → "Entregas de Miga" (nivel a definir).

## Reglas de justicia

1. Todo desafío tiene que poder ganarse **sin mejoras**. Las mejoras solo lo hacen más cómodo.
2. Mejoras **sin azar**: pagás X, recibís Y. Nada de sobres misteriosos.
3. **Dos rankings:** "sin mejoras" y "con mejoras".
4. Las monedas de juego no se canjean por comida ni merch (evita abuso de bots).
5. El servidor decide todo: puntos, pases, resultados de partidas y mejoras equipadas.

## Plan por pasos (cada uno chico, con tests y un commit)

| Paso | Qué se hace | Cómo se prueba |
|---|---|---|
| 1 | Calibrar a la tarjeta: 10 pts/€, escalones 400 y 800, todo en `settings`. Ajustar tests y textos. | Una compra de 8 € suma 80; a los 400 se abre el café |
| 2 | Dos saldos: total ganado y saldo gastable. Función para gastar. | Gastar baja el gastable y no mueve los escalones |
| 3 | Monedas de juego y pases en el servidor (tabla, tope diario, tope de pases). | Test: no se pasan los topes |
| 4 | Desafío para canjear: usa pase o juega. Validar Entregas de Miga en el servidor repitiendo las teclas. | Ganar guarda el pase; sin pase hay que jugar |
| 5 | Tienda: mejoras, cosméticos, merch y extras con saldo gastable. | Comprar baja el saldo; canje de merch en caja |
| 6 | Mejoras aplicadas en los juegos (el servidor conoce el nivel de mejora al validar). | La misma partida valida igual en cliente y servidor |
| 7 | Rankings separados. | Dos listas, cada una con su regla |
| 8 | Panel admin: costo de premios sobre ventas, pases usados, mejoras más compradas. | El % de costo coincide con un cálculo manual |

Antes de lanzar al público: consulta legal sobre el desafío como condición de canje y confirmar que no se vende nada con dinero (ver `docs/PENDIENTES-AUGUSTO.md` §11).

## Decisiones que necesito de Augusto

1. **¿Los escalones de comida se mantienen aunque gaste puntos en mejoras?** Recomendado: sí (como la tarjeta de papel, el progreso no se pierde). Contra: las mejoras salen "gratis" para el cliente y hay que ponerles un precio que dure. Alternativa: que gastar sí atrase el escalón.
2. **Costo real** de un café y de un sanguche (usé 0,40 € y 3 €).
3. **Merch real** que querés ofrecer y su costo.
4. ¿Café y sanguche se repiten siempre (cada 5 y cada 10 compras)? Supuse que sí.

## Qué quedó hecho (octubre 2026)

| Paso | Estado | Dónde |
|---|---|---|
| 1. Escala de la tarjeta | Hecho | `20261029000001_economy_scale.sql` |
| 2. Saldo gastable | Hecho | `point_spends`, `spend_points`, `customer_spendable` |
| 3. Monedas y pases | Hecho | `coin_movements`, `challenge_passes`, tope diario de monedas y de pases en `settings.economy` |
| 4. Desafío con pase | Hecho | `start_chest` usa un pase si hay; `start-run` / `finish-run` dan los pases |
| 5. Tienda | Hecho | `shop_items`, `buy_item`, `buy_pass_with_coins`; la caja valida los códigos de la tienda en `validate-redemption` |
| 6. Mejoras en los juegos | Hecho (Sobreviví a las migas) | `customer_perks`, `game_runs.perks`, `Perks` en el motor |
| 7. Rankings | Hecho | `leaderboard` (por juego, nivel y con/sin mejoras), `leaderboard_points`, opción de ocultarse |
| 8. Panel del dueño | Hecho | `admin_economy_stats` y la tarjeta «Economía de puntos» en `/admin` |

Valores por defecto (todos editables en `settings`, sin tocar código):

- `economy`: 15 monedas por ganar, 2 por jugar, hasta 40 extra por puntaje, tope de 150 monedas por día, máximo 3 pases guardados y 3 por día, un pase cuesta 80 monedas.
- `reward_costs` (centavos): café 40, sanguche 300, gorra 600, chipá 30, alfajor 40, medialuna 80, dulce de leche 350. **Son supuestos**: hay que cargar los costos reales.
- Precios de la tienda: chipá 150, alfajor 130, medialuna 250, dulce de leche 1200, gorra 3000; mejoras 200 a 300 por nivel (el nivel N cuesta N veces el precio base).

Reglas que se mantienen: el servidor decide todo; no se vende nada con dinero; las mejoras no son imprescindibles (todos los desafíos se pueden pasar sin ellas); las partidas con mejoras tienen su propio ranking; las monedas no se convierten en comida.

## Próximo: comunidad en línea (no construido)

- **Partidas entre usuarios (carreras en línea):** hoy Miga Racers corre solo en el celular. Para jugar entre personas hace falta sincronizar las partidas (Supabase Realtime) y validar el resultado en el servidor repitiendo las entradas de ambos. Es un trabajo grande y va por separado.
- **Apostar para llevarse el pozo:** diseñado para usar **monedas de juego**, no puntos de compra. Las monedas no valen comida, así que el pozo no tiene valor en plata y el riesgo legal baja mucho. Con puntos de compra se apostaría algo que vale un café y hace falta consulta legal antes. Debe quedar apagado por defecto (`settings`), con un tope por apuesta y por día, y con protección contra cuentas que se pasan monedas entre sí.
- **Rankings «no oficiales»:** Miga Racers, Truco y Skate Spot corren en el celular y su resultado se podría falsear. Para sumarlos al ranking hay que repetir su partida en el servidor (la carrera ya es determinista con semilla; el Truco depende del azar y es el más difícil).
- **Entregas de Miga:** su motor es determinista y se puede repetir en el servidor para sumarlo a los rankings. Hay que moverlo a `supabase/functions/_shared`.

## Decisiones de negocio que siguen abiertas

1. Costo real de un café y de cada sanguche (hoy: supuestos).
2. Qué sanguche es el premio (o un tope de precio), porque en la carta van de 7 a 22 EUR.
3. Merch real que se quiere ofrecer y su costo.
4. Si los precios de la tienda se quedan como están o se ajustan con las primeras semanas de datos.
