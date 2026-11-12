# Rally de Cocina: controles táctiles

Archivos: `src/games/rally/touchModel.ts` (modelo puro, sin DOM), `touchLayer.ts` (DOM, dibujo y eventos), `touchLegacy.ts`
(la cruceta anterior, solo como referencia de pruebas), `touchPlayability.test.ts` (el conductor táctil simulado).

## Qué estaba mal en la cruceta anterior

La cruceta eran 4 botones separados (arriba, abajo, izquierda, derecha) y dos botones a la derecha. El dueño la probó en el celular y
dijo que no era jugable. Lo que se verificó (con el código, una captura en 667x375 y la simulación):

| Hipótesis | Resultado |
|---|---|
| 1. Un pulgar no puede acelerar y doblar a la vez | **Confirmada.** Un puntero = un botón (`TouchModel`): con un dedo no existe "arriba + izquierda". El simulador con un pulgar y la cruceta vieja tarda **112,6 s** las 2 vueltas contra **45,5 s** con el control nuevo (2,5 veces más). Para ir más rápido hay que "picar" los botones 4 veces por segundo saltando ~120 px entre ellos (el "experto" de la tabla: 55,4 s, igual más lento). |
| 2. Dirección todo-o-nada | **Confirmada.** Con dos dedos en la cruceta (cota optimista, un dedo fijo en "arriba") el giro digital va al tope y la simulación raspa el muro el **20,9 %** del tiempo con **34 choques**, contra 4 % y 3-4 choques del control nuevo. |
| 3. Botones chicos y que tapan | **Confirmada.** Botones de 64-78 px; la cruceta 3x3 ocupaba 222x222 px (el 59 % de la altura en 667x375 y un tercio del ancho): tapaba justo la pista cercana. Fondo casi transparente (.34). Ver `shots/old-*` (capturas de antes). |
| 4. El dedo se "cae" al salir del botón | **Confirmada en el código.** `move()` volvía a calcular el botón por posición: al salir de todos los botones (con el ruido de ±12 px, en el hueco de 6 px) el dedo pasaba a "nada" y soltaba el control. Ahora cada dedo se queda con su botón/superficie hasta que se levanta. |
| 5. Freno de mano e ítem pegados | **Parcial.** Estaban lado a lado a 14 px; ahora están en diagonal / en columnas separadas (≥ 22 px entre bordes). |
| 6. Solapamiento con el HUD | **No era el problema principal**, pero el mapa y los tiempos arriba a la derecha chocan con cualquier botón alto en el borde derecho: en el perfil táctil el mapa pasó arriba a la izquierda. |
| 7. Retroalimentación | Había resaltado al apretar; faltaba la vibración (ahora `navigator.vibrate(14)` en los botones). |

Límite de lo verificado: la **sensación real** en un celular no se puede medir sin tocarlo. La simulación demuestra qué se puede hacer
con cada control y con qué precisión, no cuán cómodo es.

## Decisión del dueño: dos esquemas seleccionables (menú, "Controles")

Guardado en `rdc:scheme` (`one` | `two`); por defecto **Un pulgar**. Sensibilidad en `rdc:sens`.

### A. Un pulgar
* **La mitad izquierda es UNA superficie.** Pedales por posición **vertical absoluta**: el 60 % de arriba acelera, el 40 % de abajo frena
  (y marcha atrás si está detenido). La línea es `PEDAL_SPLIT = 0.6` (`touchModel.ts`), dibujada como guía tenue con las etiquetas
  ACELERAR / FRENAR; la zona activa se resalta (verde / rojo).
* **Dirección**: mientras el pulgar está apoyado, deslizar horizontalmente respecto del punto donde apoyó (origen flotante). Zona
  muerta chica (16 % del radio, 11 % para salir: histéresis), proporcional (llega al giro total con 85 % del radio), con rampa
  (sube a 9 u/s, vuelve a 14 u/s). Si el pulgar se aleja más de 1,25 radios el origen lo sigue. Una barrita con perilla muestra el giro.
* **Sin tocar = punto muerto**: no acelera y frena suave (`TUNING.idleBrake`, solo si el auto avanza; parado no mete reversa).
* **Derecha**: ítem y freno de mano, ≥ 84 px (`clamp(84px, 24vh, 100px)`), en diagonal: el freno de mano en la esquina (donde descansa el
  pulgar, porque se mantiene apretado) y el ítem arriba a la izquierda de él (toque corto).

### B. Dos pulgares
* **Mitad izquierda: solo dirección** (igual que arriba). **Mitad derecha: pedales** en una superficie con la misma línea.
* **Ítem y freno de mano en una columna sobre el borde derecho**, fuera de la superficie de pedales: el pulgar derecho no pierde los
  pedales por un toque accidental. El ítem (≥ 84 px) queda a la altura de "acelerar" (el pulgar solo rueda hacia la derecha y toca); el
  freno de mano es **chico (80 % = ~72 px) y de abajo**: en B el derrape ya sale de frenar + doblar, así que el botón sobra para casi
  todo uso y se deja como apoyo para quien lo quiera.

### Derrape (ambos): frenar + doblar
Deslizar a un lado frenando (giro > 0,3) derrapa hacia ese lado: el freno baja a 0,2 y el freno de mano del auto se **pulsa** al 25 % del
tiempo a 10 Hz. Es un agarre lateral reducido "asistido": como el motor (`sim.ts`) solo conoce `handbrake` sí/no, el modulado se hace con
pulsos; el contravolante sale solo de la rampa y de que el pulgar vuelve hacia el origen. Valores afinados con la simulación (ver el
barrido abajo): sin derrape 52,6 s; con 0,25 de duty y 0,2 de freno 43,5 s y 2,0 % fuera de pista.

## Verificación objetiva: el conductor táctil simulado

`touchPlayability.test.ts`: un conductor (persecución de la línea de la pista, frena antes de las curvas) da **2 vueltas con 3 rivales de IA**,
12 corridas con semillas fijas, pero solo produce **posiciones de pulgares**: el modelo táctil las traduce a controles. Mismo "error
humano" para todos: ruido de posición ±12 px (uniforme, a 30 Hz), retraso de 80 ms, pulgar a 1600 px/s máx. "Fuera" = % del tiempo rozando el
muro; "choques" = golpes fuertes (muro o autos).

| Control (±12 px, 80 ms) | Terminó | Tiempo | Fuera | Choques |
|---|---|---|---|---|
| **A. Un pulgar** | 12/12 | **45,5 s** | 4,3 % | 4,3 |
| **B. Dos pulgares** | 12/12 | **45,3 s** | 3,5 % | 3,2 |
| Anterior, 1 pulgar, aprieta y suelta el botón de giro (lo normal) | 12/12 | 112,6 s | 1,1 % | 5,1 |
| Anterior, 1 pulgar, experto que "pica" a 4 Hz | 12/12 | 55,4 s | 3,7 % | 1,1 |
| Anterior, 2 dedos (cota optimista) | 12/12 | 50,2 s | 20,9 % | 34,3 |

Con más error (±20 px, 120 ms, pulgar a 1400 px/s): A 46,1 s / 4,7 % / 5,4; B 46,8 s / 6,1 % / 6,4; anterior (normal) 205,4 s / 1,2 % / 12,8;
anterior (experto) 73,5 s / 5,0 % / 2,1.

Lectura honesta:
* Los controles nuevos son **2,5 veces más rápidos** que la cruceta con un pulgar (y 20 % más que el experto imposible), y **5-6 veces más
  precisos** que la versión de dos dedos (donde el giro digital choca 34 veces).
* La cruceta vieja "normal" raspa menos el muro (1,1 %) **porque casi no corre**: no puede acelerar y doblar a la vez. Los controles
  nuevos van al ritmo del conductor y rozan el muro lo mismo que el experto (4 % vs 3,7 %) pero con un esfuerzo humano mucho menor.
* **A y B salen casi iguales** en la simulación (B apenas mejor: 3,5 % vs 4,3 % fuera, porque el pulgar que dobla no se mueve para cambiar
  de pedal). La simulación no mide la comodidad de ocupar los dos pulgares; por eso A queda como predeterminado (lo pidió el dueño) y B
  como alternativa. Si en el celular A cansa o se cruzan el giro y el pedal, B es la salida.
* Con más ruido ambos siguen terminando 12/12; B sube un poco más el rozar el muro (6,1 %).

Cómo correrlo: `node node_modules/vitest/vitest.mjs run src/games/rally/touchPlayability.test.ts --silent=false --reporter=verbose`
(imprime la tabla). El barrido de constantes: `RALLY_SWEEP=1` con la misma orden. Una traza cuadro a cuadro: `RALLY_TRACE=A|B|legacy1`.

### Barrido del derrape (Un pulgar, ±12 px, 80 ms; antes de fijar los valores finales)
sin derrape 52,6 s · duty 0,25 / freno 0,2: 43,5 s, 2,0 % fuera · duty 0,5 / freno 0,35: 46,8 s · duty 1 / freno 1 (equivalente al freno de
mano entero): 46,8 s, 3,3 % · freno entero sin pulsos: hasta 50,9 s. Las diferencias entre configuraciones cercanas están dentro del ruido
de 12 corridas; lo claro es que el derrape suave gana a "sin derrape" y a frenar a fondo.

## Cómo ajustar

* **PEDAL_SPLIT** (`touchModel.ts`, 0,6): fracción desde arriba donde empieza el freno. Subirlo agranda la zona de acelerar. La guía visual
  se regenera sola (el CSS usa la misma constante).
* **Sensibilidad** (menú: Suave 0,75 / Normal 1 / Rápido 1,3; valores en `SENSITIVITIES`, `touchLayer.ts`): multiplica el desplazamiento
  del pulgar. Más alta = menos recorrido para el mismo giro.
* **`TUNING`** (`touchModel.ts`): `steerDeadEnter/Exit` (zona muerta), `steerFull` (desplazamiento del giro total), `steerCurve` (1 =
  lineal), `rise`/`fall` (rampa), `follow` (el origen sigue al pulgar), `pedalHyst` (px de histéresis de la línea), `idleBrake`,
  `driftMin/Brake/Duty/Hz`. El radio de referencia sale de la pantalla (`radius` ≈ 8,5 % del ancho, entre 46 y 70 px).
* Después de cambiar algo: correr el simulador y mirar la tabla.

## Probar a mano en el celular

1. `npm run dev` y abrir desde el celular en la red local (o `npm run dev:https`). Entrar al Rally, girar a horizontal.
2. En el menú, "Controles": Un pulgar / Dos pulgares, y "Giro": Suave / Normal / Rápido. El cartel muestra el dibujo del esquema elegido.
3. Un pulgar: apoyar arriba (acelera), deslizar a los lados (dobla), bajar bajo la línea (frena; con giro, derrapa), levantar (punto muerto).
4. Verificar la vibración al tocar ítem / freno de mano (Android con Chrome; iOS no vibra).

## Capturas

`pw` con 844x390 y 667x375 para ambos esquemas, en una carrera: ver el reporte de la tarea (las imágenes viven en la carpeta temporal de la
sesión; el e2e `tests/e2e/rally-flow.spec.ts` comprueba tamaños ≥ 84 px, separación y ubicación de cada control).
