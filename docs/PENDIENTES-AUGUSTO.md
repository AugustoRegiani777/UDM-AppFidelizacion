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
