# Rally de Cocina: pistas como datos

Cada pista del Rally es una definición de datos (`TrackDef`): un JSON plano, sin funciones ni referencias, que se
puede guardar, mandar y volver a leer sin perder nada. Todo el juego (física, IA, cámara, minimapa, vueltas,
cajas, rampas, zonas y decorado) funciona con **cualquier** `TrackDef` válida. Esta es la base sobre la que se
va a construir el editor de pistas.

## Dónde está cada cosa

| Archivo | Qué hace |
| --- | --- |
| `src/games/rally/tracks/types.ts` | Los tipos: `TrackDef`, `ControlPoint`, `RampDef`, `PickupDef`, `ZoneDef`, `GridDef`, `AiDef`, `TrackIssue`, `ValidationResult`. |
| `src/games/rally/tracks/defs/*.ts` | Una pista por archivo (`cocina`, `terraza`, `obrador`, `barra`, `vitrina`, `harina`, `fallas`). |
| `src/games/rally/tracks/index.ts` | `TRACKS` (el orden del menú y de los desbloqueos), `getTrackDef(id)`, `getTrack(id)` (calculada y en caché), `OPEN_TRACKS`. |
| `src/games/rally/tracks/runtime.ts` | `buildRuntime(def)`: de los datos a lo que usa el juego (puntos del eje, tangentes, normales, alturas, pendientes, rampas, cajas, zonas, `groundAt`). Matemática pura. |
| `src/games/rally/tracks/validate.ts` | `validateTrack(x)`, `parseTrackDef(x)`, `checkStructure(x)`, `computeMetrics(rt)` y `TRACK_LIMITS`. Funciones puras. |
| `src/games/rally/tracks/decor/` | El decorado por ambiente (`THEME_IDS`), la luz (`style.ts`) y las mallas de la pista (`trackMeshes.ts`). |
| `src/games/rally/records.ts` | Récords por pista y auto, migración y desbloqueos (claves `rdc:`). |
| `src/games/rally/trackMenu.ts` | El dibujo del trazado para las tarjetas del menú (`trackThumbSVG(rt)`) y sus estilos. |
| `src/games/rally/track.ts` | Compatibilidad: los valores sueltos de La Cocina (`TP`, `ramps`, `groundAt`...) que usaban los tests viejos. |

## Convenciones

- **Unidades**: metros del mundo en miniatura (escala 1:32). Un auto mide unos 2 m de largo; el cuarto va de
  x = -112 a 112 y de z = -88 a 88 (el decorado de cada ambiente llena ese cuarto).
- **Ejes**: `x` este-oeste, `z` norte-sur, `y` altura sobre el piso (0 = a ras). En el minimapa `z` crece hacia abajo.
- **El eje de la pista** es una curva Catmull-Rom *centripeta y cerrada* que pasa por todos los `controlPoints`
  en el orden dado (ese es el sentido de la carrera). Se muestrea en `n` puntos equiespaciados (~0,7 m, o `samples`).
- **`s`** es una fracción de la vuelta, de 0 a 1, medida desde la meta en el sentido de marcha.
- **`lat`** es un desplazamiento lateral del eje en metros: positivo = izquierda del sentido de marcha.
- **Pendiente** = altura / distancia recorrida (0,10 = 10 %). Positiva = sube en el sentido de marcha.
- Los colores son enteros `0xRRGGBB`.

## Campos de `TrackDef`

| Campo | Tipo | Significado |
| --- | --- | --- |
| `version` | `1` | Versión del formato. |
| `id` | texto | Estable: minúsculas, números y guiones. Es parte de las claves guardadas (`rdc:best:<id>:<auto>`). |
| `name` | texto (2 a 40) | Nombre visible (HUD, resultados, tarjeta). |
| `description` | texto (≤ 140) | Una frase para la tarjeta del menú. |
| `theme` | `ThemeId` | Qué decorado y qué luz se construyen: `cocina`, `obrador`, `barra`, `vitrina`, `harina`, `terraza`, `fallas`. |
| `difficulty` | 1 a 5 | Estrellas de la tarjeta. |
| `halfWidth` | m | Mitad del ancho del asfalto (3,6 a 8). |
| `laps` | entero 1 a 9 | Vueltas propuestas (se usa si la persona no eligió otra cantidad). |
| `samples` | entero, opcional | Cantidad de puntos del eje. Si falta: largo / 0,7 m. |
| `start` | `{ x, z }` | La meta: se ajusta al punto del eje más cercano. Punto 0 del eje = la línea de meta. |
| `controlPoints` | `{ x, z, y }[]` | 6 a 80 puntos. `y` es la altura del asfalto en ese punto. |
| `grid` | `{ firstRow, rowGap, lateral }` | Parrilla de largada: filas de dos autos hacia atrás de la meta (`firstRow` m detrás, `rowGap` m entre filas, `lateral` m a cada lado del eje). |
| `ramps` | `RampDef[]` | Rampas tipo libro: `{ s, lat, length, width, height, color }`. Suben de 0 a `height` a lo largo de `length`. |
| `pickups` | `{ s, lat }[]` | Cajas sorpresa. |
| `zones` | `ZoneDef[]` | Zonas pegadas al asfalto: `{ kind, s, lat, length, width }`. `s`/`lat` es el centro; `length` va a lo largo de la pista y `width` a lo ancho. |
| `ai` | `{ speed, cornerBrake, lookahead, slopeCare }` | Ajustes de los rivales (abajo). |

### Zonas especiales (`kind`)

- `slick`: mancha resbaladiza (dulce de leche, café). El agarre lateral baja a un 20 %: el auto patina. La IA la esquiva por el lado con más lugar.
- `sand`: harina o arena. Baja la velocidad máxima al 62 %, la aceleración al 70 % y frena de a poco.

### Parámetros de IA por pista (`ai`)

| Campo | La Cocina | Rango | Efecto |
| --- | --- | --- | --- |
| `speed` | 1 | 0,6 a 1,3 | Multiplica la velocidad objetivo de los rivales. |
| `cornerBrake` | 0,45 | 0 a 0,9 | Cuánto frenan en las curvas (más = frenan más). |
| `lookahead` | 8 | 4 a 30 | Cuántos puntos del eje mira adelante para elegir la trayectoria. |
| `slopeCare` | 1 | 0 a 2 | Atención al relieve: levantan el pie antes de una cresta y de una bajada que termina en curva. 0 = ignoran el relieve. |

## Relieve (altura)

Las alturas `y` de los puntos de control se interpolan con la misma curva del trazado. El auto sigue el suelo
(`groundAt` = asfalto + rampas); la pendiente suma o resta aceleración por gravedad de forma moderada
(`SLOPE_ACC = 30` m/s² por unidad de pendiente, solo a lo largo del eje); en una cresta despega **solo** si el
suelo se aleja más rápido de lo que cae el auto (con velocidad alta o turbo; en la Montaña de Harina son saltitos
de menos de medio metro). La cámara sigue la altura del asfalto y nunca queda bajo el suelo; cuando la pista está
elevada se dibuja una ladera a los costados que baja hasta el piso. No hay puentes: la pista no puede cruzarse.

## Qué valida el validador

`validateTrack(valor)` acepta cualquier valor (por ejemplo, un JSON leído) y devuelve
`{ ok, errors, warnings, metrics }`. Cada problema es `{ code, severity, message, at? }`: `code` es estable (para
el editor), `message` está en español y `at` es el lugar del mundo donde pasa (para marcarlo en el mapa).

| `code` | Qué comprueba |
| --- | --- |
| `schema`, `version`, `json`, `points-min`, `points-max` | Estructura del JSON, tipos, rangos de `ai`, al menos 6 puntos de control. |
| `width` | `halfWidth` entre 3,6 y 8 m. |
| `closed`, `duplicate-points` | El circuito cierra (el último punto empalma con la meta, también en altura) y no hay puntos de control encimados (no repetir el primero al final). |
| `bounds` | Todo el eje (más el ancho y un margen de 4 m) cabe dentro del cuarto. |
| `self-intersection` | Sin cruces ni autointersección. |
| `separation` | Entre tramos lejanos (a más de 35 m de pista) hay al menos `2 × halfWidth + 5` m entre ejes. |
| `radius` | Radio mínimo de curva ≥ `1,5 × halfWidth`. |
| `below-floor`, `too-high`, `slope`, `steep` | Altura entre 0 y 14 m; pendiente máxima 22 % (error) y aviso desde 18 %. |
| `grid-shape`, `grid-curve`, `grid-obstacle` | La parrilla entra en el ancho, está en un tramo recto y libre: ninguna rampa, caja ni zona entre el último auto (+5 m) y 10 m después de la meta. |
| `ramp-size`, `ramp-off-track`, `ramp-curve`, `ramp-slope`, `ramp-overlap`, `ramps-max` | Rampa de 4 a 14 m de largo, 0,4 a 3,2 m de alto, ancho entre 2,5 m y el de la pista; dentro del asfalto; en recta; pendiente bajo la rampa ≤ 12 %; separadas entre sí. |
| `pickup-off-track`, `pickup-on-ramp`, `pickup-overlap`, `pickups-max` | Cajas dentro del asfalto (a 1,2 m del borde), no sobre una rampa, no encimadas (≥ 2,5 m). |
| `zone-size`, `zone-off-track`, `zone-overlap`, `zone-on-ramp`, `zones-max` | Zona de 3 a 40 m de largo y de 1,5 m al 75 % del ancho; dentro del asfalto; sin superponerse ni pegarse a una rampa. |
| avisos: `short`, `long`, `few-pickups` | Pista de menos de 250 m o más de 900 m; menos de 6 cajas. |

Los límites numéricos están en `TRACK_LIMITS` (el editor los puede mostrar y respetar). `metrics` trae `length`,
`samples`, `minSep`, `minRadius`, `maxSlope`, `minY`, `maxY` y `climb`.

## Cómo agregar una pista

1. Crear `tracks/defs/<id>.ts` con un `TrackDef` (copiar `terraza.ts` y cambiar los datos). `pts([[x, z, y], ...])`
   y `pickupRows(ss, lats)` (en `defs/helpers.ts`) ayudan a escribirlo.
2. Comprobar el trazado: `validateTrack(def)` tiene que dar `ok: true` (los tests lo comprueban para todas las pistas).
3. Registrarla en `TRACKS` (`tracks/index.ts`). El orden es el del menú: de la tercera en adelante se abre al subir
   al podio en la anterior.
4. Elegir un `theme`. Si el ambiente es nuevo: agregar su id en `THEME_IDS` (`types.ts`), su luz en `decor/style.ts`
   y su decorado en `decor/<tema>.ts` (registrarlo en `decor/index.ts`). El decorado se arma con las herramientas de
   `decor/builder.ts` (`ctx.add`, `ctx.instanced`, `furniture(...)`): usar `instanced` para todo lo repetido y
   `ctx.check(nombre, x, z, radio)` para que ningún objeto pise la pista.
5. Correr `npm run check` y probarla en el juego (la elige en el menú; para saltear el candado en desarrollo:
   `localStorage.setItem('rdc:podiums', JSON.stringify(['cocina','terraza', ...]))`).

Los tests (`tracks/tracks.test.ts`) recorren `TRACKS` solos: validan cada pista, comprueban que la IA complete 2
vueltas con 3 y con 5 rivales (con semilla), el presupuesto de dibujo y la liberación de recursos.

## Presupuesto de dibujo

El decorado de cada pista (sin contar autos ni partículas) debe quedar bajo: **90 llamadas de dibujo y 80 mallas**
para las pistas nuevas (hoy 32 a 58), y 270 / 170 para La Cocina (el decorado original, 258). Lo repetido va
instanciado (`ctx.instanced`/`furniture`). El perfil táctil sigue igual: sombras de 1024 (o apagadas si el
aparato no da abasto), sin antialias.

## Récords y desbloqueos (claves `rdc:`)

- `rdc:best:<pista>:<auto>`: mejor vuelta (segundos).
- `rdc:race:<pista>:<auto>:<vueltas>`: mejor tiempo de carrera con esa cantidad de vueltas.
- `rdc:podiums`: ids de las pistas donde se subió al podio (entre los 3 primeros, nunca último).
- `rdc:track`: la última pista elegida.
- Los récords viejos `rdc:best:<auto>` (cuando había una sola pista) se copian a `rdc:best:cocina:<auto>` al abrir el
  juego (`migrateRecords`); los viejos no se borran.

## Para el editor de pistas

Lo que ya sirve tal cual:

- `validateTrack(def)` en cada edición (rápido: ~10 ms). `errors[i].at` marca dónde está el problema; `TRACK_LIMITS`
  da los topes. `parseTrackDef(texto)` para abrir/pegar un JSON.
- `buildRuntime(def)` da `TP/TAN/NRM/Y/SLOPE`, `ramps`, `pickupSpots`, `zones` y `groundAt` para dibujar el mapa o
  calcular cosas; `trackThumbSVG(rt)` dibuja el trazado.
- Para probar una pista en vivo: `new RallySim(hooks, settings, buildRuntime(def))` y `world.setTrack(rt)`
  (reconstruye el decorado entero y libera el anterior).

Lo que falta y hay que sumar:

- `TRACKS` es una lista estática: hace falta guardar las pistas de la persona (por ejemplo `rdc:custom-tracks`, o la
  base de datos si se quieren compartir) y una función `registerTrack(def)` que las agregue a la lista y limpie el
  caché de `getTrack`. Hoy el menú solo ofrece las pistas de `TRACKS`.
- Los ids de pistas propias deberían llevar un prefijo (`mi-`) para no pisar los del juego; y decidir si se abren
  solas (el desbloqueo por podio solo está definido para las del juego).
- El `theme` solo cambia el decorado y la luz: el editor elige entre los siete que hay. Los objetos del decorado
  son fijos por ambiente (no se editan).
- La IA y la parrilla se editan con los campos `ai` y `grid`; conviene que el editor corra una carrera de prueba con
  IA (como hace `tracks.test.ts`) y muestre el tiempo por vuelta para avisar si la pista es injugable.
