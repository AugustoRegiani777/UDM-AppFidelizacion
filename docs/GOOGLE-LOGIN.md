# Activar el ingreso con Google (guía paso a paso)

Para qué sirve: hoy la versión de prueba entra como **invitado** (sin cuenta). Con Google, cada cliente tiene su cuenta, sus puntos quedan guardados en el servidor y los recupera desde cualquier celular. Esta guía te lleva de cero a "funciona", sin tocar código. Te lleva unos 30 minutos.

Datos fijos de este proyecto (los vas a copiar y pegar):

| Qué                                 | Valor                                                               |
| ----------------------------------- | ------------------------------------------------------------------- |
| Sitio de la app                     | `https://udm-appfidelizacion.netlify.app`                           |
| Proyecto de Supabase                | `qfpqqkpyxvjzeddnqzuz`                                              |
| Dirección de retorno de Supabase    | `https://qfpqqkpyxvjzeddnqzuz.supabase.co/auth/v1/callback`         |

Usá la cuenta de Google **del comercio** (no una personal), así el proyecto no depende de una persona.

---

## Paso 0. Publicar esta versión de la app (una sola vez)

Esta versión trae la migración `20261030000002_integrity_hardening.sql` y cambia la función `delete-account`. Hay que publicar las dos cosas **antes** de abrir el ingreso con Google:

1. `node node_modules\supabase\dist\supabase.js db push` (sube la migración nueva).
2. `node node_modules\supabase\dist\supabase.js functions deploy delete-account` (ahora pide confirmación explícita para borrar una cuenta).
3. Dejá que Netlify publique la app (se hace sola al subir el código).

## Paso 1. Crear el proyecto y la pantalla de consentimiento en Google Cloud

1. Entrá a <https://console.cloud.google.com> con la cuenta del comercio.
2. Arriba a la izquierda, tocá el selector de proyectos y elegí **Proyecto nuevo**. Nombre: `Uno de Miga fidelizacion`. Tocá **Crear** y esperá a que se cree (te avisa con una campanita).
3. Con el proyecto elegido, abrí el menú (las tres rayitas) y andá a **APIs y servicios** → **Pantalla de consentimiento de OAuth** (en la versión nueva se llama **Google Auth Platform**).
4. Si te pide "Comenzar":
   - **Nombre de la aplicación:** `Uno de Miga`.
   - **Correo de asistencia:** el del comercio.
   - **Público:** elegí **Externo**.
   - **Datos de contacto:** el mismo correo.
   - Aceptá las políticas y tocá **Crear**.
5. En **Branding** (Marca) cargá, si querés, el logo, y estos datos:
   - **Página principal de la aplicación:** `https://udm-appfidelizacion.netlify.app`
   - **Política de privacidad:** `https://udm-appfidelizacion.netlify.app/privacidad`
   - **Dominios autorizados:** `supabase.co` y `netlify.app`
6. En **Acceso a los datos** (Data Access / Scopes) no hace falta agregar nada especial: los permisos básicos `openid`, `email` y `profile` ya vienen y son los únicos que usa la app.
7. En **Público** (Audience), cuando termines las pruebas, tocá **Publicar la aplicación** (Publish app) y confirmá. Mientras esté en "Prueba", **solo pueden entrar los correos que agregues como usuarios de prueba**. Para clientes reales tiene que estar publicada. Con permisos básicos no hace falta pasar por una revisión de Google.

## Paso 2. Crear el cliente OAuth (el ID y el secreto)

1. En el mismo menú: **APIs y servicios** → **Credenciales** (o, en Google Auth Platform, **Clientes**).
2. Tocá **Crear credenciales** → **ID de cliente de OAuth** (o **Crear cliente**).
3. **Tipo de aplicación:** `Aplicación web`.
4. **Nombre:** `Uno de Miga web`.
5. En **Orígenes autorizados de JavaScript** tocá **Agregar URI** y pegá:
   `https://udm-appfidelizacion.netlify.app`
6. En **URI de redireccionamiento autorizados** tocá **Agregar URI** y pegá:
   `https://qfpqqkpyxvjzeddnqzuz.supabase.co/auth/v1/callback`
7. Tocá **Crear**. Google te muestra el **ID de cliente** y la **clave secreta**. Copialos a un lugar privado (administrador de contraseñas). **No los pegues en chats, mails ni en el código.**
   - Si más tarde necesitás ver la clave de nuevo, entrá a ese cliente en Credenciales.

## Paso 3. Pegar el ID y el secreto en Supabase

1. Entrá a <https://supabase.com/dashboard> y abrí el proyecto `qfpqqkpyxvjzeddnqzuz` (Fidelizacion UDM).
2. Menú izquierdo: **Authentication** → **Sign In / Providers** (en algunas versiones: **Providers**).
3. Buscá **Google** y abrilo:
   - Activá **Enable Sign in with Google**.
   - **Client IDs:** pegá el ID de cliente.
   - **Client Secret:** pegá la clave secreta.
   - Dejá desactivado **Skip nonce checks**.
   - Verificá que la **Callback URL** que muestra Supabase sea exactamente `https://qfpqqkpyxvjzeddnqzuz.supabase.co/auth/v1/callback` (la misma del paso 2).
   - **Save**.

## Paso 4. Direcciones permitidas (Site URL y Redirect URLs)

1. **Authentication** → **URL Configuration**.
2. **Site URL:** `https://udm-appfidelizacion.netlify.app`
3. **Redirect URLs:** tocá **Add URL** y agregá `https://udm-appfidelizacion.netlify.app/**` (con los dos asteriscos al final). Si querés probar también en tu compu, podés agregar `http://localhost:5173/**`; sacala cuando termines.
4. **Save changes.**

## Paso 5. Habilitar "Manual linking" (clave para no perder los datos de los invitados)

Este interruptor es lo que permite que un invitado toque **"Guardar mi progreso con Google"** y su cuenta de invitado se convierta en cuenta de Google **conservando todos sus puntos**. Sin esto, ese botón falla.

1. **Authentication** → **Sign In / Providers**.
2. Buscá el interruptor **Allow manual linking** (en algunas versiones está en **Authentication** → **Settings**/**Configuración**, sección de cuentas de usuario) y **activalo**.
3. Guardá.

Mientras haya invitados con puntos, dejá **Allow anonymous sign-ins** activado en el mismo lugar (es lo que usa la versión de prueba). Mirá el paso 7 para saber cuándo apagarlo.

También en **Authentication** → **Sign In / Providers**: dejá **Email** con el registro desactivado (en producción se entra solo con Google).

## Paso 6. Probar que funciona

Con tu cuenta de Google (si la app sigue en "Prueba" en Google, tu correo tiene que estar en usuarios de prueba):

1. **Invitado → Google (la prueba más importante).**
   1. Abrí `https://udm-appfidelizacion.netlify.app` en una ventana privada y tocá **Probar la app**. Anotá los puntos que tenés.
   2. Entrá a **Perfil** y tocá **Guardar mi progreso con Google**. Elegí tu cuenta.
   3. Volvés a la app: en Perfil ya no aparece el cuadro "Guardá tu progreso" y tus puntos son **los mismos**. Tu nombre pasó a ser el de Google.
2. **Otro celular / otro navegador.** Abrí la app, tocá **Entrar con Google** (para eso hay que haber apagado el modo invitado, paso 7; o usá la ventana privada de antes si todavía lo ves) y elegí la misma cuenta: tenés que ver los mismos puntos, monedas, mejoras y premios.
3. **Google que ya tenía cuenta.** En otra ventana privada entrá como invitado y tocá **Guardar mi progreso con Google** con la **misma** cuenta de Google del punto 1. La app tiene que avisar "Ese Google ya tiene su propio progreso", sin mezclar ni borrar nada, y ofrecer entrar con esa cuenta o seguir como invitado.
4. **Cerrar sesión y volver.** Cerrá sesión y entrá de nuevo con Google: los datos siguen ahí.

Si algo falla, mirá en Supabase → **Authentication** → **Logs** el mensaje del error; casi siempre es una dirección mal escrita en los pasos 2 o 4.

## Paso 7. Apagar el modo invitado cuando quieras lanzar

El modo invitado tiene dos partes: una variable en Netlify y los puntos de regalo en la base. Hacé las dos.

1. **Netlify** → tu sitio → **Site configuration** → **Environment variables**:
   - Borrá la variable `VITE_GUEST_MODE` (o ponele el valor `false`).
   - Después andá a **Deploys** → **Trigger deploy** → **Deploy site** (las variables solo se aplican al publicar de nuevo).
   - Con eso el botón **Entrar con Google** reemplaza a **Probar la app**.
2. **Puntos de regalo en 0.** En Supabase → **SQL Editor** → **New query**, pegá esto y tocá **Run**:

   ```sql
   update public.settings set value = '{"welcome_points": 0}'::jsonb where key = 'demo';
   ```

   Es el interruptor de los puntos de entrada: los invitados que ya existían **conservan lo que tienen**, y nadie nuevo recibe puntos de regalo.
3. **Recomendado, un tiempo después:** cuando ya no entre ningún invitado nuevo, apagá **Allow anonymous sign-ins** en Authentication → Sign In / Providers. Las sesiones de invitado que ya existen siguen funcionando. Si esperás a que tus invitados se pasen a Google, mejor: **dejalo activado hasta entonces**.

## Cosas que conviene saber

- **No se pierde nada al pasar de invitado a Google.** Es la misma cuenta (el mismo identificador interno): puntos, monedas, pases, mejoras, premios, partidas y rankings no se mueven.
- **Si el Google ya tenía cuenta**, los puntos de invitado **no se mezclan** con los de esa cuenta (así nadie puede juntar puntos entre cuentas). No se borra nada: la cuenta de invitado queda guardada en el servidor.
- **Un invitado que cierra sesión sin guardar** no puede volver a abrir su cuenta (no tiene contraseña). Sus datos no se borran, pero quedan sin dueño que pueda entrar. Por eso la app se lo avisa y le ofrece guardar con Google.
- **Los puntos no se pueden trucar:** todo se calcula en el servidor y la base solo permite leer lo propio (hay pruebas automáticas de eso en `supabase/tests/database/14_integrity.test.sql`).
- **Se guarda en el servidor** todo lo importante (puntos, monedas, pases, mejoras, premios, partidas, rankings). **Solo queda en el celular**: los récords y avances de la práctica en la sala de juegos y los ajustes de sonido; si cambia de celular, empieza esos desde cero.
- **Limpieza de invitados:** si algún día querés borrar invitados viejos de la base, hacelo siempre con un filtro que deje afuera a quien ya tenga puntos o compras, y nunca borres usuarios desde el panel de Supabase sin mirar. Quien vinculó Google ya **no** es "anónimo", así que una limpieza de anónimos no lo toca.
- **No pongas secretos en ningún archivo del repositorio.** El ID y el secreto de Google viven solo en Supabase (y en tu administrador de contraseñas).
- **Sesiones:** la sesión se renueva sola. No actives en Supabase los límites de duración de sesión ("time-box" / "inactivity timeout"), porque cerrarían la sesión de los invitados, que no pueden volver a entrar.
