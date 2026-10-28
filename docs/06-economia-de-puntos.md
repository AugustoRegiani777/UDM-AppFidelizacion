# Economía de puntos (propuesta para aprobar)

Estado: **propuesta, sin código todavía.** Reemplaza los números de `docs/01-producto.md` (1 punto por euro, café a 150, sanguche a 300) cuando se apruebe.

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
