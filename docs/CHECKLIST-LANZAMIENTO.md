# Checklist de lanzamiento

Tildá cada punto antes de abrir la app a clientes. Lo que ya está resuelto en el código está marcado como hecho.

## Legal y marca

- [ ] Texto de privacidad y reglas del programa revisados por la gestoría (hoy es provisorio, en `src/copy/es.ts`, sección `privacy`).
- [ ] Reglas y probabilidades de los juegos revisadas (se muestran en "¿Cómo funciona?").
- [ ] Brandbook cargado en `docs/marca/` y colores/tipografías ajustados (`src/styles/index.css`).
- [ ] Íconos reales (hoy son provisorios en `public/`: `icon.svg`, `icon-*.png`, `apple-touch-icon.png`).
- [ ] Dominio definitivo elegido y conectado a Netlify.

## Seguridad y datos

- [x] RLS activa en todas las tablas, probada con tests (un cliente no lee ni escribe datos de otro).
- [x] Puntos, canjes y juegos decididos solo en el servidor.
- [x] HMAC con vencimiento de 5 minutos en las llamadas con el POS.
- [x] Herramientas de desarrollo (`/dev`, login por email, `dev-*`) ausentes del build de producción.
- [ ] Registro por email desactivado en el Supabase de producción.
- [ ] Secretos de producción generados (distintos de los de desarrollo) y guardados en un gestor de contraseñas.
- [ ] Copias de seguridad de la base activas en Supabase.

## Comunidad y misiones

- [ ] Links reales de Instagram y de reseña de Google cargados en `settings.missions`.
- [ ] Reglas de convivencia de la comunidad revisadas por la gestoría.
- [ ] Al menos 8-10 lugares cargados desde `/admin` antes de abrir la comunidad.
- [ ] Alguien sabe revisar `/admin` (lugares propuestos, reseñas por verificar, comentarios reportados).
- [ ] Administradores asignados por SQL (ver PENDIENTES, sección 8).

## Integración con el POS

- [ ] Funciones del POS listas en staging (`loyalty-sale`, `loyalty-redeem`, QR en la tablet): ver `docs/03-integracion-pos.md`.
- [ ] `POS_MODE=real` probado en staging con ventas reales de prueba.
- [ ] Prueba de punta a punta: venta en la tablet → QR → suma → canje en caja.

## Pruebas en celulares reales

- [ ] iPhone (Safari): portada, login con Google, escanear con la cámara de la app, escanear con la cámara nativa (`/s/<uuid>`), instalar en la pantalla de inicio, abrir la app instalada y sumar una compra.
- [ ] Android (Chrome): lo mismo, más "Instalar app".
- [ ] Android de gama media: animaciones fluidas (ver `docs/RENDIMIENTO.md`) y con "Quitar animaciones" activado.
- [ ] Sticker NFC del mostrador abre la portada.
- [ ] Skate en iPhone y Android: se gira a horizontal, los dos pulgares responden, la pantalla completa y el bloqueo de orientación funcionan (o aparece "Girá el celular") y se puede completar el circuito.
- [ ] Cámara denegada: se ve cómo habilitarla y se puede pegar el link a mano.

## Operación

- [ ] Alguien sabe cambiar premios y reglas (tablas `rewards` y `settings` en el panel de Supabase).
- [ ] Plan para el día 1: qué hace quien atiende si el POS no responde (la compra queda pendiente y se acredita sola).
