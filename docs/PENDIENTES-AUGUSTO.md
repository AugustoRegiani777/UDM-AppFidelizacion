# Pendientes de Augusto

Cosas que solo vos podés hacer. Se van sumando a medida que el desarrollo las necesita.

## 1. Brandbook (antes del diseño final)

Pasame el PDF del brandbook y el logo, y copialos en la carpeta `docs/marca/`. Mientras tanto la app usa crema y rojo provisorios y las fuentes Poppins Bold y Bebas Neue.

## 2. Docker Desktop encendido

Supabase local necesita Docker. Abrí "Docker Desktop" desde el menú inicio y esperá a que diga "Engine running" (ícono de ballena fija abajo a la derecha). Hay que hacerlo cada vez que prendas la compu y quieras probar la app.

## 3. Credenciales de Google para "Entrar con Google"

Mientras no estén, la app local usa un login por email (solo en desarrollo). Para activar Google:

1. Entrá a https://console.cloud.google.com con tu cuenta de Google y creá un proyecto nuevo llamado "Uno de Miga".
2. Menú ☰ → "APIs y servicios" → "Pantalla de consentimiento de OAuth". Elegí "Externo", poné el nombre "Uno de Miga", tu email de contacto y guardá.
3. Menú ☰ → "APIs y servicios" → "Credenciales" → "Crear credenciales" → "ID de cliente de OAuth". Tipo: "Aplicación web".
4. En "URI de redirección autorizados" agregá:
   - Para probar en tu compu: `http://127.0.0.1:55321/auth/v1/callback` (si antes cargaste la del puerto 54321, agregá también esta: los puertos cambiaron, ver la sección 12)
   - Para producción (más adelante): `https://TU-PROYECTO.supabase.co/auth/v1/callback` (la dirección exacta te la doy en la fase de publicación).
5. Google te muestra un "ID de cliente" y un "Secreto". Creá el archivo `supabase/.env` (copiá `.env.example` como guía) con:
   ```
   GOOGLE_CLIENT_ID=el-id-que-te-dio-google
   GOOGLE_CLIENT_SECRET=el-secreto-que-te-dio-google
   ```
6. Reiniciá Supabase: en la terminal, `npx supabase stop` y después `npx supabase start`.
   Nunca le pases el secreto a nadie ni lo subas a GitHub.

## 4. Probar desde tu celular en la red local

- La compu y el celular tienen que estar en el mismo Wi-Fi.
- Cuando Windows pregunte si permitir "Node.js" y "Docker" en redes privadas, tocá **Permitir**.
- En el celular abrí `http://IP-DE-TU-COMPU:5173` (la IP la muestra `npm run dev` en "Network"). El login con Google no funciona con IP; usá el login por email de desarrollo.

## 5. Publicar la app (cuando quieras lanzarla)

No hagas esto antes de que el POS real esté conectado (ver INFORME-FINAL.md): sin el POS, nadie podría sumar compras. Detalle técnico en `docs/DEPLOY.md`.

1. **Supabase (la base de datos):**
   - Entrá a https://supabase.com, creá una cuenta y tocá "New project". Nombre: `unodemiga-fidelizacion`. Elegí una región de Europa (Frankfurt o París) y una contraseña de base de datos larga (guardala en un gestor de contraseñas).
   - Cuando termine de crearse, andá a Project Settings → API y anotá: **Project URL**, la clave **anon public** y el **Project ref** (las letras de la URL antes de `.supabase.co`).
2. **Pasarle la base a la app:** en la terminal, dentro de la carpeta del proyecto, corré uno por uno (reemplazando REF por tu Project ref):
   - `npx supabase login` (se abre el navegador, aceptá)
   - `npx supabase link --project-ref REF`
   - `npx supabase db push` (crea las tablas y los premios)
3. **Secretos:** generá 3 claves largas al azar (podés usar https://bitwarden.com/password-generator/, 40 caracteres) y corré:
   `npx supabase secrets set POS_MODE=mock POS_HMAC_SECRET=CLAVE1 POS_INBOUND_HMAC_SECRET=CLAVE2 RECONCILE_SECRET=CLAVE3`
   Guardá las 3 claves: CLAVE1 y CLAVE2 también se cargan después del lado del POS.
4. **Funciones:** `npx supabase functions deploy claim-sale start-chest finish-chest renew-redemption validate-redemption play-game delete-account reconcile sync-google-reviews`
5. **Tarea automática cada 5 minutos:** en Supabase → SQL Editor, pegá y ejecutá (con tu REF y CLAVE3):
   `select public.schedule_reconcile('https://REF.supabase.co/functions/v1/reconcile', 'CLAVE3');`
6. **Login con Google de producción:** repetí el punto 3 de este archivo, pero en la pantalla de Google agregá la dirección `https://REF.supabase.co/auth/v1/callback`; después en Supabase → Authentication → Providers → Google pegá el ID y el secreto. En Providers → Email, **desactivalo**. En Authentication → URL Configuration poné tu dominio real como "Site URL" y `https://TU-DOMINIO/**` en "Redirect URLs".
7. **Netlify (la web):** en https://app.netlify.com → "Add new site" → "Import from Git" y elegí el repo. En Site settings → Environment variables cargá `VITE_SUPABASE_URL` (Project URL), `VITE_SUPABASE_ANON_KEY` (clave anon) y `VITE_APP_URL` (tu dominio con https://). Tocá "Deploy".
8. **Dominio:** en Netlify → Domain management, agregá tu dominio y seguí los pasos que muestra.
9. **QR fijo y NFC del mostrador:** generá un QR y un sticker NFC que abran la dirección de tu dominio (la portada). Cualquier app gratuita de "QR generator" / "NFC Tools" sirve.
10. **Pruebas en celulares:** seguí `docs/CHECKLIST-LANZAMIENTO.md`.

## 6. Textos legales

Llevale a la gestoría el texto de privacidad (está en `src/copy/es.ts`, sección `privacy`) y las reglas de los juegos (pantalla "¿Cómo funciona?"). Pedile que te devuelva el texto final y pasámelo para cargarlo.

## 7. Conectar el POS real

Es el último paso antes de lanzar. Abrí el repo del POS en VS Code y pasale a Claude el prompt del final de `docs/03-integracion-pos.md`. Cuando esté probado en staging, cambiá `POS_MODE=real` (paso 3 de arriba).

## 8. Misiones de puntos extra y administración

- **Links reales:** hoy las misiones apuntan a páginas genéricas. Pasame la dirección de tu Instagram (ej. `https://www.instagram.com/unodemiga`) y el link directo para dejar una reseña en Google Maps (en Google Maps, tu local → "Escribir una reseña" → copiar el enlace). Después se cargan en Supabase → Table editor → `settings` → fila `missions` (campo `url` de cada misión). También ahí se cambian los puntos (`points`).
- **Política de Google (riesgo asumido):** Google no permite dar incentivos a cambio de reseñas. Puede borrar reseñas o penalizar la ficha del local. La app aclara que los puntos no dependen de la calificación, pero el riesgo es tuyo. Si preferís evitarlo, se apaga la misión borrando `google_review` de la fila `missions`.
- **Ser administrador:** el panel `/admin` es solo para administradores. Para darte ese rol en producción: Supabase → SQL Editor → `update public.profiles set is_admin = true where id = (select id from auth.users where email = 'TU-EMAIL');`

## 9. Comunidad: moderación y textos legales

- **Cargar los primeros lugares:** entrá a `/admin` con tu usuario administrador y usá "Cargar un lugar directo" para dejar la comunidad con contenido el día del lanzamiento (pizzerías argentinas, medialunas, cafés y helados que vos recomendás).
- **Revisar cada tanto `/admin`:** ahí aparecen los lugares propuestos por clientes (para aprobar o rechazar), las reseñas de Google por verificar y los comentarios reportados.
- **Contenido de usuarios (con la gestoría):** como los clientes publican lugares y comentarios, conviene sumar a los textos legales: reglas de convivencia (qué no se puede publicar), que los comentarios son anónimos hacia otros clientes pero el local puede ver quién los escribió, y cómo pedir que se borre algo. Pedile a la gestoría que lo revise junto con la privacidad.

## 10. Verificación automática de reseñas de Google (opcional)

**Qué hace:** cada 30 minutos la app trae las reseñas de tu local desde Google y las compara con las misiones de reseña pendientes. Si el **nombre de la reseña coincide con el nombre de la cuenta de Google con la que entró el cliente**, le suma los puntos sola. Si solo coincide el nombre que el cliente escribió, te la marca en `/admin` como "Posible coincidencia" para aprobar de un toque. Las reseñas anónimas no se pueden verificar: quedan para revisión manual. **Mientras no hagas esto, todo sigue funcionando con aprobación manual.**

**Lo que Google exige (verificado en su documentación):**

- Un perfil de empresa **verificado y activo hace más de 60 días**, con un **sitio web** cargado. Como el local abrió hace poco, puede que todavía no cumpla.
- Pedirle acceso a la API a Google. Google no publica cuánto tarda la respuesta.

**Pasos:**

1. Entrá a https://business.google.com con la cuenta dueña del local y confirmá que figura como "Verificado" y que tiene el sitio web cargado.
2. En https://console.cloud.google.com (el mismo proyecto "Uno de Miga" del login con Google) anotá el **número de proyecto**: en "Panel" → tarjeta "Información del proyecto".
3. Pedí el acceso: abrí el formulario de contacto de la API de Google Business Profile (https://developers.google.com/my-business/content/prereqs → botón "GBP API contact form"), elegí **"Application for Basic API Access"**, usá el email que figura como dueño del perfil y pegá el número de proyecto. Google responde por email. Para ver el estado: Cloud Console → APIs y servicios → cuotas de "Google My Business API": **0 = todavía no aprobado**, **300 = aprobado**.
4. Cuando esté aprobado, en "APIs y servicios" → "Biblioteca" habilitá: **My Business Account Management API**, **My Business Business Information API** y **Google My Business API**.
5. "APIs y servicios" → "Credenciales" → "Crear credenciales" → "ID de cliente de OAuth" → tipo "Aplicación web". En "URI de redirección autorizados" agregá `https://developers.google.com/oauthplayground`. Anotá el ID y el secreto.
6. Conseguí el "refresh token": entrá a https://developers.google.com/oauthplayground → engranaje ⚙ (arriba a la derecha) → tildá "Use your own OAuth credentials" y pegá el ID y el secreto → en el paso 1 escribí el permiso `https://www.googleapis.com/auth/business.manage` → "Authorize APIs" (con la cuenta dueña del local) → "Exchange authorization code for tokens" → copiá el **Refresh token**.
7. Cargá los secretos. En tu compu: en `supabase/functions/.env` completá `GOOGLE_BP_CLIENT_ID`, `GOOGLE_BP_CLIENT_SECRET` y `GOOGLE_BP_REFRESH_TOKEN`. En producción: `npx supabase secrets set GOOGLE_BP_CLIENT_ID=... GOOGLE_BP_CLIENT_SECRET=... GOOGLE_BP_REFRESH_TOKEN=...`
8. Encontrá el código de tu local: entrá a `/admin` y tocá **"Buscar mi local en Google"**. Aparece una lista con el código de cada local (empieza con `accounts/`). Copiá el de Uno de Miga.
9. Cargalo como secreto `GOOGLE_BP_LOCATION` (mismo lugar que el paso 7).
10. En producción, programá la búsqueda automática: Supabase → SQL Editor → `select public.schedule_google_sync('https://REF.supabase.co/functions/v1/sync-google-reviews', 'CLAVE3');` (CLAVE3 es el mismo secreto de la reconciliación) y publicá la función: `npx supabase functions deploy sync-google-reviews`.
11. Probalo: en `/admin` tocá **"Buscar reseñas de Google ahora"**. Te cuenta cuántas reseñas nuevas encontró y cuántas aprobó.

**Para apagar la aprobación automática** (que solo sugiera): Supabase → Table editor → `settings` → fila `google_reviews` → `auto_approve` en `false`.

**Límites que conviene saber:** la coincidencia es por nombre, así que dos personas con el mismo nombre podrían confundirse (cada reseña suma una sola vez y la revisión manual sigue disponible). Los puntos no dependen de la calificación de la reseña.

## 11. Consulta legal antes de apostar puntos entre clientes

Pediste poder apostar puntos entre clientes (por ejemplo en partidas online). Todavía **no está construido** y no lo voy a prender sin tu OK después de esta consulta. El motivo: los puntos se canjean por productos reales, así que apostarlos puede considerarse un juego de azar o apuesta regulada en España, y hay reglas especiales si juegan menores.

1. Preguntale a tu gestoría o a un abogado: "Tengo una app de fidelización cuyos puntos se canjean por productos. ¿Puedo dejar que los clientes apuesten puntos entre ellos en un juego de habilidad? ¿Necesito alguna licencia?"
2. Mientras tanto, la alternativa segura es: rankings y torneos con premios que pone el local, sin arriesgar puntos.
3. Cuando tengas la respuesta, contámela y lo configuro (queda apagado por defecto en `settings`).

## 12. Puertos locales de Supabase (cambiaron de 543xx a 553xx)

Windows reservó el rango de puertos 54306–54405 (pasa a veces después de reiniciar la compu) y justo ahí vivían los de Supabase, así que no arrancaba. Los pasé a la serie 553xx (la API local ahora es `http://127.0.0.1:55321`, la base 55322, Studio 55323 y el buzón de pruebas 55324). Ya está cambiado en `supabase/config.toml`, `.env.local`, `.env.example`, `vite.config.ts` y los tests.

Lo único que tenés que hacer es lo de Google: si ya probaste el login con Google en tu compu, en Google Cloud Console → Credenciales → tu ID de cliente, agregá a "URI de redirección autorizados" `http://127.0.0.1:55321/auth/v1/callback`.

Si algún día querés volver a los puertos de antes: abrí PowerShell **como administrador**, corré `net stop winnat` y `net start winnat`, y deshacé el cambio de puertos (buscá 553 y poné 543).
