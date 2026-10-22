# Prompt único · construir la app completa

Sos el desarrollador principal de la app de fidelización de Uno de Miga. Tu misión es construirla completa, de punta a punta, con la mejor calidad posible, trabajando de forma autónoma.

## 1. Contexto obligatorio

Antes de hacer nada, leé completos: `CLAUDE.md`, `docs/01-producto.md`, `docs/02-arquitectura.md`, `docs/03-integracion-pos.md`, `docs/04-diseno-y-animaciones.md`, `docs/05-negocio-y-mercado.md` y `PROMPTS.md`, más el brandbook de `docs/marca/` si existe. Son la fuente de verdad.

**Marca:** los colores y tipografías oficiales (crema y rojo, Poppins Bold y Bebas Neue, valores exactos en el brandbook) mandan sobre los tokens provisorios de docs/04. Si el brandbook no está en `docs/marca/`, anotalo en PENDIENTES-AUGUSTO.md y usá provisoriamente crema y rojo hasta tenerlo. Todos los textos de la app siguen la voz y los ejemplos de docs/05. Las reglas de oro de CLAUDE.md no se rompen nunca.

## 2. Decisiones nuevas (sumalas a docs/01 en tu primer commit)

- **Escáner dentro de la app = camino principal.** El botón "Escanear mi compra" abre la cámara (pedir permiso con un mensaje previo que explique para qué). Usar `BarcodeDetector` con fallback a una librería liviana. Si el permiso se niega, mostrar cómo habilitarlo y ofrecer escribir el código a mano.
- **El QR de venta es un link** `{APP_URL}/s/{venta_uuid}`. Escanearlo con la cámara nativa también debe funcionar: la ruta guarda el uuid, pide login si hace falta y lo procesa después.
- **iPhone:** una PWA instalada no comparte sesión con Safari. Contemplarlo: el flujo de `/s/:uuid` tiene que sobrevivir a un login nuevo sin perder el uuid.
- **NFC:** en el mostrador habrá un sticker NFC con el link a la portada de la app. No requiere código, solo que la portada funcione perfecto como punto de entrada.
- **Wallet de Apple/Google:** fuera de alcance por ahora. Dejá la arquitectura preparada (un evento o función cuando cambia el saldo) para sumarlo después.

## 3. Cómo trabajás

1. **Primero, el plan maestro.** Creá `docs/PROGRESO.md` con un checklist de todas las fases de PROMPTS.md (1 a 9), cada una dividida en tareas concretas con su criterio de "terminado". Ese archivo es tu memoria: actualizalo al cerrar cada tarea.
2. **Ejecutá las fases en orden**, de la 1 a la 9. No saltees ni adelantes fases.
3. **Al cerrar cada fase:** lint, typecheck y tests en verde; actualizar PROGRESO.md; un commit con mensaje claro (`fase 3: login con Google y bienvenida`). Recién ahí pasás a la siguiente.
4. **No te frenes a preguntarme por decisiones de negocio abiertas.** Usá los valores de docs/01, dejalos configurables en `settings` y anotalos en PROGRESO.md, en una sección "Decisiones tomadas por defecto".
5. **Si algo solo lo puedo hacer yo** (crear credenciales de Google, levantar Docker, crear cuentas, poner secretos), anotalo en `docs/PENDIENTES-AUGUSTO.md` con instrucciones paso a paso para alguien no técnico, y **seguí con todo lo que no dependa de eso.** Por ejemplo: mientras no haya credenciales de Google, usá en desarrollo el login por email que trae Supabase local, detrás de una bandera que solo exista en modo dev.
6. **Verificá antes de usar.** Revisá la documentación actual de cada librería y del CLI de Supabase en vez de suponer su API.
7. **Si te interrumpen o se corta la sesión,** al retomar leé PROGRESO.md y seguí desde la primera tarea sin terminar.

## 4. Vara de calidad

- **Funciona de verdad:** cada flujo de docs/01 probado de punta a punta en local con el POS en modo mock, incluidos los casos raros (venta duplicada, anulada, de Glovo, vieja, pendiente que aparece después, código vencido, doble canje simultáneo).
- **Seguro:** RLS probada con tests (un cliente no puede leer ni escribir datos de otro); puntos, canjes y juegos decididos solo en el servidor; HMAC en todas las llamadas con el POS.
- **Se siente increíble:** sistema de animación completo de docs/04, celebraciones en cada logro, transiciones suaves, 60 fps en un Android de gama media, respeto por `prefers-reduced-motion`. Estética limpia, tipografía grande, tokens de docs/04. Tomá como referencia el boceto (panel con saldo grande, premios con barra y "te faltan X", pantalla de compra sumada, código de canje).
- **Honesto:** ninguno de los patrones prohibidos de docs/04. Nada de urgencia o escasez falsas.
- **Mantenible:** TypeScript estricto, componentes chicos, nada duplicado, sin código muerto, nombres claros.

## 5. Límites

- No toques el repo ni la base del POS. Solo se integra por el contrato de docs/03, en modo mock.
- No hagas deploy a producción ni uses secretos reales. En la fase 9, dejá todo listo y documentado para que yo lo publique, con los pasos en PENDIENTES-AUGUSTO.md.
- No agregues funcionalidades fuera de los docs. Si se te ocurre una mejora valiosa, anotala en PROGRESO.md, en "Ideas para después".

## 6. Al terminar

Escribí en `docs/INFORME-FINAL.md`:
- Qué quedó hecho y cómo probar cada flujo en mi celular (paso a paso, en lenguaje simple).
- Las decisiones que tomaste por defecto y dónde cambiarlas.
- Lo que queda pendiente de mi lado.
- Riesgos o deudas técnicas conocidas.
- Los próximos pasos: conectar el POS real (docs/03) y la Fase del Wallet.

Arrancá leyendo los docs y creando `docs/PROGRESO.md`. Después mostrame el plan maestro en un resumen corto y, sin esperar mi respuesta, empezá la Fase 1.
