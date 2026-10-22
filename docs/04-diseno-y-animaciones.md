# 04 · Diseño y animaciones

## La idea

**Temu en la mecánica, Uno de Miga en la estética.** Todo se mueve, todo responde, cada logro se celebra. Pero visualmente es limpio: mucho aire, tipografía grande, pocos colores. Lo divertido sale del movimiento, no del amontonamiento.

## Tokens

**Provisorios.** La marca oficial de Uno de Miga es **crema y rojo, con tipografías bold (Poppins Bold, Bebas Neue)**. Si el brandbook está en `docs/marca/`, sus valores reemplazan a esta tabla: el rojo de marca pasa a ser el acento principal y las tipografías se ajustan. La estructura de tokens (bg, surface, ink, muted, track, acento, éxito) se mantiene.

| Token       | Valor     | Uso                                              |
| ----------- | --------- | ------------------------------------------------ |
| `bg`        | `#FAF6EF` | Fondo crema                                      |
| `surface`   | `#FFFFFF` | Tarjetas                                         |
| `ink`       | `#1E1B16` | Texto y botones principales                      |
| `muted`     | `#5F584E` | Texto secundario                                 |
| `track`     | `#EFE6D6` | Fondo de barras y separadores                    |
| `gold`      | `#D9962B` | Progreso, brillos, acentos (no para texto chico) |
| `gold-soft` | `#FBEFD9` | Fondos de avisos                                 |
| `green`     | `#3F7A26` | Desbloqueado, éxito                              |
| `green-ink` | `#2B5419` | Texto sobre verde claro, "+puntos"               |

- Tipografías: **Bricolage Grotesque** (títulos y números grandes) e **Inter** (texto).
- El saldo de puntos es el protagonista: 88–96 px.
- Bordes redondeados generosos (14–24 px). Botones de al menos 48 px de alto.
- Contraste mínimo 4.5:1 en texto.

## Sistema de animación

Todo vive en `src/motion/`:

- `presets.ts` — springs y duraciones compartidas (`snappy`, `bouncy`, `gentle`).
- `<CountUp>` — números que suben con spring (saldo, "+62").
- `<ProgressBar>` — se llena con spring y brilla al completarse.
- `<Celebration>` — confetti + Lottie + vibración corta + sonido opcional.
- `<PopupQueue>` — cola de popups: nunca dos a la vez, máximo uno espontáneo por sesión.
- `<Sheet>` — bottom sheets con arrastre para cerrar.
- `<Pressable>` — feedback táctil en todo lo tocable (escala 0.97).
- Transiciones de pantalla con `AnimatePresence`.

### Catálogo de momentos

| Momento                   | Animación                                                                  |
| ------------------------- | -------------------------------------------------------------------------- |
| Entrar al panel           | Tarjetas entran en cascada; el saldo cuenta desde 0                        |
| Compra sumada             | Check que se dibuja, "+62" que salta, confetti, el saldo sube              |
| Premio desbloqueado       | Popup de regalo que se abre, brillo dorado, botón "Canjear" que late suave |
| Cerca de un premio (≥80%) | La barra brilla y aparece "¡Te falta poquito!"                             |
| Código de canje           | El código se "imprime" letra por letra; cuenta regresiva real              |
| Racha de visitas          | Llamita que crece por semana seguida                                       |
| Error o pendiente         | Animación calma, nunca roja ni alarmante                                   |

### Reglas técnicas

- Solo `transform` y `opacity`. Nada de animar `width`, `top` o sombras pesadas.
- `prefers-reduced-motion`: todo pasa a fundidos simples, sin confetti.
- Lotties chicos (.lottie), cargados bajo demanda.
- Sonido apagado por defecto, con toggle en el perfil. Vibración con `navigator.vibrate` (Android; en iOS simplemente no vibra).
- Probar en un Android de gama media real.

## Juegos (fase posterior)

| Juego                 | Cómo funciona                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------ |
| Raspadita post-compra | Después de sumar una compra, raspás con el dedo (canvas). Premio chico: puntos extra o "seguí participando". |
| Ruleta diaria         | Un giro por día. Física con Motion, desacelera y rebota.                                                     |
| Cofre de racha        | Se abre al cumplir X semanas seguidas viniendo.                                                              |
| Álbum de sabores      | Cada sabor de miga que probás desbloquea una figurita.                                                       |

**El resultado de cada juego lo decide el servidor** (`play-game`) antes de que empiece la animación. La animación solo "actúa" el resultado. Límites diarios y presupuesto de premios configurables.

## Límites éticos y legales (obligatorios)

Lo estimulante sí; lo engañoso no. En la UE las prácticas comerciales engañosas están reguladas, y además se nota y espanta clientes.

- **Nada de urgencia falsa:** las cuentas regresivas solo existen si el vencimiento es real (como el código de canje).
- **Nada de escasez inventada:** no "¡quedan 2!" si no es verdad.
- **Todo popup se cierra fácil**, con una X visible y tocando afuera.
- **Sin culpa al decir que no:** nada de "No, no quiero sanguches gratis".
- **Probabilidades claras** en los juegos, visibles en un "¿Cómo funciona?".
- **Sin notificaciones insistentes:** pocas y con permiso explícito.
