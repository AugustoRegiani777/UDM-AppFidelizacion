# Miga Skate: núcleo técnico (física, control táctil, cámara y game feel)

Este documento acompaña el rehacer del núcleo de `src/games/migaskate/`. La especificación original está pensada
para Unity/C# (`SkatePhysics`, `SkateTouchController`, `SkateCamera`, `SkateJuice`); acá se traduce, punto por
punto, a TypeScript + three.js conservando los nombres y los conceptos.

Reglas que no cambian (ver `CLAUDE.md`): el cliente nunca decide puntos ni premios (Miga Skate es práctica sin
premio y su puntaje es solo de juego); animaciones solo con `transform` y `opacity` en la UI; `prefers-reduced-motion`
respetado; nada de patrones engañosos (las caídas son siempre amables: "¡Casi!").

## (a) Archivos

Todos en `src/games/migaskate/` salvo que se indique otra ruta.

**Nuevos (motor, sin three.js ni DOM, testeable en Vitest)**

| Archivo | Qué es |
| --- | --- |
| `vec.ts` | Vectores y cuaterniones mínimos (mano derecha, Y arriba, frente de la tabla = +Z como three.js). |
| `world.ts` | El mundo: superficies, rieles, `raycastDown` con normales exactas, `wallPush` (paredes), `closestOnRail`. Absorbe lo que estaba en `physics.ts`. |
| `rigidbody.ts` | `RigidBody`: cuerpo rígido propio (equivalente al `Rigidbody` de Unity), centro de masa desplazado, inercia, drag, impulsos, interpolación. |
| `stateMachine.ts` | `SkateStateMachine`: Grounded, Popping, Airborne, Grinding (+ Bailed), con tabla de transiciones. |
| `skatePhysics.ts` | `SkatePhysics`: suspensión por raycast, fricción anisotrópica, ollie/flips/catch/auto-leveling, rieles, caídas, eventos y paso fijo con acumulador. |
| `touchController.ts` | `SkateTouchController`: multi-touch, `TouchHitbox` +40 %, zonas Nose/Center/Tail, clasificación de gestos, zurdos. |
| `skateCamera.ts` | `SkateCamera`: SmoothDamp propio, solo yaw hacia la velocidad, límite de velocidad angular. |
| `juice.ts` | `SkateJuice`: audio, partículas, squash/stretch, háptica, hit-stop y desgaste de rieles, todo desde los hooks de la física. |
| `tutorial.ts` | Tutorial corto e interactivo (ollie → flip → catch) que avanza con eventos reales. |
| `*.test.ts` | `skatePhysics`, `rigidbody`, `stateMachine`, `world`, `touchController`, `skateCamera`, `juice`, `tutorial` (más los de `session` y `tricks`, ya existentes). |
| `docs/MIGASKATE-FISICA.md` | Este documento. |

**Modificados**

| Archivo | Cambio |
| --- | --- |
| `gestures.ts` | Pasó de ser el reconocedor a ser solo el vocabulario (`Gesture`, `GrabName`, medidas de la tabla). El reconocedor vive en `touchController.ts`. |
| `session.ts` | Usa `SkatePhysics`; ignora `grindStay` en la cola de carteles. |
| `tricks.ts` | `LandedTrick` trae `quality`; el aterrizaje torpe paga el 60 %. |
| `spots.ts` | Importa de `world.ts`; la piscina (`bowl`) suma un riel de 18 m. |
| `controller.ts` | Paso fijo + interpolación, hit-stop, juice, tutorial, zurdos, marcas de tiempo reales de los toques. |
| `renderer.ts` | Pose física directa, `SkateCamera`, partículas en anillo (chispas, polvo, estela), un material por riel para el desgaste. |
| `mascot.ts` | La tabla es un objeto suelto con la pose física; el jinete tiene su marco (normal del suelo + rumbo) y los pies se quedan quietos mientras la tabla gira; squash/stretch. |
| `audio.ts` | Sonidos nuevos (pop según potencia, aterrizaje según impacto, raspado del riel, catch). |
| `MigaSkateGame.tsx` | Pad nuevo (hitbox, zonas, zona del segundo dedo), banner del tutorial, modo zurdo, `data-skate-state` para las pruebas. |
| `src/copy/es.ts` | `copy.migaskate`: guía, tutorial, zurdos, textos nuevos. |
| `tests/e2e/migaskate-flow.spec.ts` | Tutorial, zurdos y ollie con reintento (el navegador de pruebas no tiene GPU). |

**Eliminados**: `physics.ts` (mapa de alturas + física anterior), `physics.test.ts` y `gestures.test.ts` (reemplazados).

## (b) Stack confirmado y traducción de conceptos

Stack del repositorio (confirmado en `package.json` y `CLAUDE.md`): React 19 + Vite + TypeScript estricto + Tailwind +
three.js 0.170.0 (carga dinámica: el paquete inicial no cambia) + Vitest + Playwright. No se agregó ninguna dependencia.

**Por qué no rapier ni cannon-es.** El problema es chico y muy específico: un cuerpo (la tabla), 4 resortes de
suspensión, fricción anisotrópica y un mundo hecho de rampas, cajones, escaleras, cuartos de pipa y rieles que ya
tienen fórmulas exactas. Rapier (WASM, ~1.5 MB) y cannon-es (~150 KB) traen un solver de contactos general, que acá
no hace falta y que complica lo que sí importa (el control fino de la suspensión y del giro de los trucks). Además
el motor propio es determinista bit a bit (mismas entradas ⇒ misma trayectoria; hay un test), corre un paso de 120 Hz
en microsegundos (30 simulaciones de 40 s de fuzzing en ~2 s en Node) y se prueba sin three.js ni DOM. Si en el
futuro hiciera falta colisión entre objetos dinámicos, rapier con `import()` dinámico sería el camino.

| Concepto de Unity | Equivalente en TypeScript / three.js | Dónde |
| --- | --- | --- |
| `Rigidbody` | `RigidBody` propio: posición del centro de masa, cuaternión, velocidad lineal y angular (mundo), tensor de inercia diagonal local, `integrate(dt)` semi-implícito. | `rigidbody.ts` |
| Interpolación (`Interpolate`) | Paso fijo de 120 Hz con acumulador (`advance`) y pose interpolada (`view(alpha)`: lerp de posición + slerp de rotación entre el paso anterior y el actual). El renderer nunca lee el estado crudo. | `RigidBody.interpolated`, `SkatePhysics.view` |
| Continuous Dynamic | Subpasos adaptativos: ningún subpaso mueve la tabla más de ~5 cm (menos que su ancho) y la rotación se integra en tramos de ≤0.03 rad. Rieles con ventana de captura (0.65 m de alto, 0.42 m de ancho) mayor que el desplazamiento por subpaso. Paredes con sonda y empuje por subpaso. | `SkatePhysics.step`, `resolveWalls`, `tryCatchRail` |
| `centerOfMass = (0, -0.05, 0)` | `comLocal`: el cuerpo integra el centro de masa; el origen del modelo sale de `com - R·comLocal`. Toda fuerza fuera del centro genera torque (`addForceAtPoint`). | `RigidBody` |
| `Physics.Raycast` (4 rayos) | `raycastDown(world, x, y, z, maxDist)` en las 4 esquinas de los trucks: devuelve el primer techo bajo el origen y su normal analítica (rampa, cuarto de pipa, escalón, cajón). Resorte de Hooke y amortiguación asimétrica. | `world.ts`, `SkatePhysics.applyForces` |
| `AddRelativeTorque` | `body.addRelativeTorque` (N·m locales) y `addRelativeAngularImpulse` (equivalente a `ForceMode.Impulse`: `Δω = I⁻¹·L`). El shove-it usa la vertical del mundo (igual al Y local con la tabla de pie) para no mezclarse con el flip. | `RigidBody`, `SkatePhysics.addRotation` |
| `angularDrag` | `body.angularDrag` (`ω /= 1 + drag·dt`): suelo 2.5, aire 0.4, **catch 20**. | `applyForces` |
| `Vector3.SmoothDamp` | `smoothDamp` / `smoothDampAngle` (fórmula crítica de Unity, con `maxSpeed`). | `skateCamera.ts` |
| `InverseTransformDirection` | `body.toLocalDirection` (rota por el conjugado del cuaternión). La fricción se calcula con la velocidad local de cada rueda: X = deslizamiento lateral, Z = avance. | `RigidBody`, `applyForces` |
| Eventos / `UnityEvent` | `physics.on(tipo, fn)` (devuelve el desuscriptor) y alias `onPop`, `onLand`, `onGrindStart`, `onGrindStay`; más `grindEnd`, `bail`, `bump`, `flip`, `catch`, `grabStart`, `push`, `manualStart/End`. Los consumen `SkateJuice` y la sesión. | `SkatePhysics.on` |
| `TouchHitbox` + raycast táctil | Pad 2D con la silueta de la tabla proyectada (2 unidades de pad = 1 m). `inHitbox(x, z)` en coordenadas locales de la tabla; ancho = `1.4 × 0.11 m`. | `touchController.ts` |
| Pointer / touch multi-dedo | Pointer Events con `setPointerCapture` (el dedo no se pierde al salir de la tabla) y `event.timeStamp` real (si el celular se traba dibujando, el swipe conserva su velocidad). | `MigaSkateGame.tsx`, `controller.ts` |

### Máquina de estados

Los cuatro estados de la especificación más `bailed`, un estado de recuperación (caída amable y rápida) que evita
dejar la tabla tirada mientras se muestra el cartel de ánimo. Las transiciones están en `stateMachine.ts` y las
prohibidas se rechazan (hay un test que recorre las 25 combinaciones).

```
grounded  -> popping | airborne | bailed
popping   -> airborne
airborne  -> grounded | popping (ollie tardío, 0.1 s) | grinding | bailed
grinding  -> airborne | popping (ollie para salir) | bailed
bailed    -> grounded (a los 0.9 s)
```

### Cómo se juzga el aterrizaje (orientación real vs normal del suelo)

Al tocar con ≥ 2 ruedas (o con el casco de la tabla) se mide, contra la normal real de la superficie (rampa, piscina,
suelo plano):

* `upDot`: coseno entre el arriba de la tabla y la normal (limpio ≥ 0.9 ≈ 25°; torpe ≥ 0.62 ≈ 52°; si no, caída).
* `align`: alineación del frente de la tabla con la velocidad, módulo 180° (limpio ≥ 0.85; torpe ≥ 0.45). Aterrizar de
  costado a velocidad es caída.
* Giro residual de flip/shove-it justo antes de tocar (< 6 rad/s para limpio), trucos completos (dentro de 1 rad de lo
  pedido) y giro del cuerpo (≤ 0.35 rad limpio, ≤ 0.9 torpe).

Limpio paga todo; torpe paga el 60 % y pierde 20 % de velocidad (cartel "¡Aterrizaje justo!"); caída pierde el combo
pero nunca resta del puntaje cobrado, dura 0.9 s y la tabla vuelve sola al suelo.

### Rotaciones tipo Euler (flip + shove-it a la vez)

Un 360 flip combina un volteo de 360° (eje largo de la tabla) con un shove-it de 360° (vertical). Si la velocidad
angular quedara fija en el mundo, el shove-it desarmaría el volteo y la tabla no volvería a quedar plana. Por eso,
mientras está en el aire, la velocidad angular se expresa en la base (vertical, eje del cabeceo, eje largo) y se
re-expresa en cada tramo de integración. Los giros acumulados (`rollAcc`, `yawAcc`) se miden sobre la orientación
real (volteo = `atan2(x.y, up.y)`, rumbo = `atan2(f.x, f.z)`), así que no dependen del orden en que se combinaron.
El pie "ataja" el flip cuando se acerca al objetivo (resorte-amortiguador crítico dentro de 0.9 rad): es lo que hace
que un flip completo termine plano; si no alcanza el tiempo, la tabla aterriza girada y es caída.

### Control táctil: roles de los dedos

* **board** (dentro del hitbox): ollie (cola + swipe arriba, o centro + swipe rápido hacia la cola), nollie (nariz
  + swipe abajo, o centro hacia la nariz), pop shove-it (diagonal), manual (mantener cola/nariz), en el aire flips y
  shove-its, y **catch** (mantener).
* **drive** (fuera del hitbox, en el suelo): arrastre lateral = doblar; swipe hacia arriba = empujar; sobre un riel,
  el mismo dedo equilibra.
* **flick** (fuera del hitbox, apoyado en el aire): tirada de kickflip / heelflip / shove-it desde el costado.
* En el aire, un dedo mantenido fuera de la tabla **agarra** (indy/melon/nose/tail según dónde esté).
* En el aire, el swipe se proyecta: pantalla → plano de la cámara → ejes de la tabla (`projectToBoard`), de modo que si
  la tabla giró respecto de la cámara, "de lado" sigue significando lo que corresponde.
* **Zurdos**: `leftHanded` espeja el pad (u → −u) y, en horizontal, pasa el pad al otro lado de la pantalla. Se
  recuerda en `localStorage`.

## (c) Parámetros iniciales y justificación

Los valores finales están en `DEFAULT_PARAMS` (`skatePhysics.ts`). Las unidades son del juego: 1 m ≈ 1 m del jinete
(la mascota mide ~0.9 m) y la tabla mide 0.82 × 0.22 m.

| Parámetro | Valor | Unidad | Justificación |
| --- | --- | --- | --- |
| Masa (`mass`) | 4 | kg | Tabla (~2.5) + carga efectiva del jinete sobre los trucks. Solo importa la relación fuerza/masa. |
| Gravedad (`gravity`) | 17 | m/s² | 1.7 × la terrestre: mantiene la calibración de salto del juego anterior (un ollie máximo de 1.26 m dura 0.74 s) y se siente ágil con pantalla chica. |
| Inercia (`inertia`) | (0.28, 0.30, 0.05) | kg·m² | Caja de 0.82 × 0.22 con el jinete cargado. Ix ≈ Iy da un cabeceo y un giro parejos; Iz chico (el eje largo) deja que el flip arranque rápido con poco torque. |
| Centro de masa (`comLocal`) | (0, −0.05, 0) | m | Pedido por la especificación: baja el centro de masa y estabiliza el aterrizaje (la caída se endereza en vez de volcar). |
| Ruedas (`wheelX/Z/Y`) | ±0.10, ±0.27, −0.045 | m | Esquinas de los trucks, a la altura de los ejes (radio de rueda 0.05). |
| Suspensión: largo del rayo | 0.07 | m | Más allá no hay contacto. El resorte solo empuja (no "pega" la tabla al piso en un salto). |
| Suspensión: rigidez `k` | 850 | N/m por rueda | Hundimiento en reposo `m g / (4k) = 0.02 m` → la altura de reposo del origen es 0.095 m, la misma de la mascota. ω de la suspensión ≈ 29 rad/s: estable a 120 Hz (ω·dt = 0.24). |
| Suspensión: amortiguación | 120 (compresión), 40 (rebote), +40·\|v\| (cuadrática) | N·s/m | Asimétrica: absorbe el impacto sin rebotar (el jinete flexiona las piernas) y deja salir la tabla en un ollie. Tope: nunca invierte la velocidad en un paso. La cuadrática frena impactos de 20–35 m/s dentro del recorrido (sin tunneling). |
| Tope de recorrido | 5000 N/m desde 0.015 m | N/m | Último recurso contra el piso. |
| Fricción lateral | 30 | 1/s (aceleración 45 m/s² máx.) | Constante de tiempo de 33 ms: el deslizamiento lateral muere en ~0.1 s. El tope deja una pequeña zona de patinazo al pivotear violento. |
| Fricción de avance | 0.05 | 1/s | Rodar casi sin resistencia: la relación lateral/avance es de 600 a 1. |
| Giro de los trucks | ±0.34 rad, trasero −0.35×, caída 1/(1+0.06·v²) | rad | Doblar = girar los ejes de las ruedas (bicicleta): radio de giro ≈ 1.7 m a 3.2 m/s y ≈ 3.4 m a 8 m/s, sin mareos ni vuelcos a velocidad. |
| Velocidad de crucero | 3.2 | m/s | El "pedaleo" del jinete: sobre plano la velocidad se acerca sola a 3.2 (como antes). Tope 10 m/s con empuje. |
| Ollie: impulso vertical | 3.8 + 2.6·potencia | m/s | Potencia 0 → 0.5 m de altura; potencia 1 → 1.26 m. Depende de la velocidad del swipe. |
| Ollie: torque de cabeceo | −(5 + 3·potencia) | rad/s (impulso angular `I·Δω` sobre X local) | Nariz arriba (nollie: al revés). Cabecea ~17° y se nivela solo en 0.3 s. Pop de 0.10 s con la suspensión apagada para que el impulso no se la coma. |
| Flip (Z local) | 13 + 7·potencia (doble: 24) | rad/s | Un kickflip tarda 0.35–0.5 s: completa con cualquier ollie decente y deja ~0.25 s de margen para tirarlo; el doble exige un ollie fuerte. |
| Shove-it (Y) | 9 + 5·potencia (360: 18) | rad/s | 180° en 0.25–0.35 s. |
| Ataje del flip | kp 196, kd 28 (crítico), zona 0.9 rad | 1/s², 1/s | El pie frena el giro justo en el objetivo; sin pasarse. |
| Estabilizador de cabeceo (aire) | kp 100, kd 14 | 1/s², 1/s | El jinete nivela la nariz (ζ ≈ 0.7). Actúa sobre el ángulo de cabeceo, así sigue valiendo aunque la tabla esté volteada. |
| `angularDrag` | suelo 2.5 · aire 0.4 · **catch 20** | 1/s | Pedido por la especificación para el catch. |
| Catch | nivelar Z a 0° o 180° con kp 160, kd 20; se activa con 110 ms de dedo quieto | — | En ~0.15 s la tabla queda quieta y plana (o boca abajo si el flip estaba a medias: eso es caída, a propósito). |
| Auto-leveling | < 0.4 m del suelo, kp 90, kd 14, solo si el arriba está a < 70° de la normal | m | Alinea el Up con la normal de la superficie (rampas incluidas) y le va quitando peso al estabilizador de horizonte cuanto más cerca del suelo. No "arregla" flips a medias. |
| Aterrizaje | limpio `upDot ≥ 0.9`, torpe `≥ 0.62` | cos | Ver arriba. |
| Umbrales de swipe | distancia ≥ 0.3 y (≥ 0.5 o ≥ 1.2 u/s); automático a 0.85; potencia `(v − 1.2) / 3.2` | unidades de pad | 1 unidad = medio lado corto del pad (~140 px en un celular). Se dispara sin esperar a que levantes el dedo. |
| Mantener | 110 ms (catch) · 160 ms (agarre) · 220 ms (manual) | ms | Lo bastante rápido para sentirse inmediato y lo bastante lento para no confundirse con un swipe. |
| Zonas | Nose z > 0.3 · Center −0.3 ≤ z ≤ 0.3 · Tail z < −0.3 | m locales | Según la especificación. |
| TouchHitbox | 1.4 × el ancho de la tabla (0.154 m de semiancho) | m | Dedos gordos sobre una tabla de 0.22 m. |
| Paso fijo / subpasos | 120 Hz · hasta 8 subpasos de ≤ 5 cm · rotación en tramos de ≤ 0.03 rad | — | Nunca atraviesa geometría (testeado hasta 35 m/s). |
| Cámara | SmoothDamp 0.14 s (xz) / 0.28 s (y) · yaw 0.4 s con tope 2.4 rad/s (0.9 con movimiento reducido) | s | Sigue la tabla con anticipación (0.18 s de velocidad) y gira solo hacia la velocidad. |
| Caída | 0.9 s | s | Rápida y amable. |

Cosas que son de afinación (no de arquitectura) y que conviene ajustar con el juego en la mano en un Android real:
`flip.omega*`, `ollie.*`, `settle.*`, `steer.*`, `land.*`. Todas están agrupadas en `DEFAULT_PARAMS`.

## (d) Cómo se verifica el "feel" sin GPU

El navegador de pruebas no tiene GPU y el 3D corre lento, así que la sensación se valida en tres capas:

1. **Simulaciones headless** con el propio motor (Node con `--experimental-strip-types`, sin three.js): barridos de
   potencia de ollie × potencia y demora del flip, velocidad de entrada × rampas/cuartos/cajones/escaleras/rieles,
   caídas desde 0.3 a 8 m con la tabla torcida, fuzzing de gestos aleatorios en los cinco spots (30 corridas de 40 s:
   sin NaN, sin salirse del mapa, sin quedar pegada en caída o riel, sin energía que se acumule).
2. **Gráficos de trayectorias** (SVG → PNG, en el scratchpad de la sesión): altura del ollie por potencia, giros
   acumulados de kickflip/heelflip/shove-it/360 flip, trayectorias sobre la rampa, curvas de giro vistas desde arriba,
   la caída amortiguada de la suspensión, el decaimiento lateral vs avance de la fricción y el efecto del catch. Se
   revisan a ojo contra lo esperado (p. ej. un ollie máximo de ~1.26 m y 0.74 s; sin rebote al aterrizar; el lateral
   se va en ~0.1 s mientras el avance casi no cambia).
3. **Tests** (`npm test`): suspensión, fricción, centro de masa, ollie, flips, catch, auto-leveling, máquina de
   estados, continuidad de colisiones, determinismo, hooks, zonas, hitbox, multi-touch, cámara y juice. Más el e2e de
   Playwright (`tests/e2e/migaskate-flow.spec.ts`), con esperas por condición (nunca por tiempo fijo) y capturas
   revisadas a mano.

Lo que **no** se puede verificar acá: cómo se siente el swipe real en un Android de gama media (latencia del toque,
tamaño real de los dedos, 60 fps con el 3D). Cómo probarlo: `npm run dev:https` y abrir la URL desde el celular.
