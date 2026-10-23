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
   - Para probar en tu compu: `http://127.0.0.1:54321/auth/v1/callback`
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
4. **Funciones:** `npx supabase functions deploy claim-sale create-redemption validate-redemption play-game delete-account reconcile`
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
