# Publicar la app en producción

Todo está preparado, pero **no se publicó nada**. Esta guía es para cuando quieras lanzar. Los pasos que requieren tus cuentas están en `PENDIENTES-AUGUSTO.md`, sección 5, escritos para alguien no técnico.

## Piezas

| Pieza                             | Dónde vive                                                                  | Qué hay que hacer                      |
| --------------------------------- | --------------------------------------------------------------------------- | -------------------------------------- |
| Base de datos + login + funciones | Proyecto nuevo de Supabase (`unodemiga-fidelizacion`, **separado del POS**) | Migraciones, secretos, funciones, cron |
| Web (PWA)                         | Netlify (`netlify.toml` ya está listo)                                      | Conectar el repo y cargar 3 variables  |
| Login con Google                  | Google Cloud + Supabase Auth                                                | Credenciales de producción             |

## Qué se publica y qué no

- Se publican las migraciones de `supabase/migrations/` (incluye premios y reglas iniciales).
- **No** se aplica `supabase/seed.sql` (es solo de desarrollo: ventas falsas y cron local).
- Funciones a publicar: `claim-sale`, `start-chest`, `finish-chest`, `start-run`, `finish-run`, `renew-redemption`, `validate-redemption`, `play-game`, `delete-account`, `reconcile`, `sync-google-reviews`.
- Funciones que **nunca** se publican: `dev-mock-sale` y `dev-pos-redeem` (simulan la tablet y la caja). Además responden 404 sin `DEV_ENDPOINTS=true`, variable que no se carga en producción.
- La pantalla `/dev` y el login por email no existen en el build de producción.

## Variables

Web (Netlify): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_URL`. No cargar `VITE_DEV_TOOLS`.

Funciones (Supabase secrets): `POS_MODE`, `POS_BASE_URL`, `POS_HMAC_SECRET`, `POS_INBOUND_HMAC_SECRET`, `RECONCILE_SECRET` y, para verificar reseñas de Google (opcional), `GOOGLE_BP_CLIENT_ID`, `GOOGLE_BP_CLIENT_SECRET`, `GOOGLE_BP_REFRESH_TOKEN`, `GOOGLE_BP_LOCATION` (guía en PENDIENTES, sección 10).

- Mientras el POS real no esté conectado: `POS_MODE=mock`. Ojo: en producción la tabla `dev_mock_sales` no existe, así que ninguna compra se podrá acreditar hasta pasar a `real`. Eso es lo esperado: **no lanzar a clientes antes de conectar el POS** (ver `INFORME-FINAL.md`, próximos pasos).
- Cuando el POS tenga sus funciones: `POS_MODE=real`, `POS_BASE_URL=https://unodemigapos.netlify.app` y los dos secretos HMAC (los mismos del lado del POS).

## Si `npx supabase` falla con "could not determine executable to run"

Pasa cuando `npx` apunta a un npm viejo instalado en el usuario (carpeta `AppData\Roaming
pm`). Se evita llamando al CLI directo con Node: `node node_modules\supabase\dist\supabase.js <comando>` (por ejemplo `... login` o `... db push`). El script `scripts\publicar-backend.ps1` ya lo hace así.

## Comandos (los ejecuta Augusto una vez)

Atajo: `powershell -ExecutionPolicy Bypass -File scripts\publicar-backend.ps1 -ProjectRef <REF>` hace todo lo de abajo (menos el SQL del cron) y te imprime las variables para Netlify. Los secretos que genera quedan en `supabase\.env.produccion.local` (ignorado por git).


```
npx supabase login
npx supabase link --project-ref <REF-DEL-PROYECTO>
npx supabase db push
npx supabase secrets set POS_MODE=mock POS_HMAC_SECRET=<secreto> POS_INBOUND_HMAC_SECRET=<secreto> RECONCILE_SECRET=<secreto>
npx supabase functions deploy claim-sale start-chest finish-chest start-run finish-run renew-redemption validate-redemption play-game delete-account reconcile sync-google-reviews
```

Después, en el editor SQL de Supabase, programar la reconciliación (usar el mismo `RECONCILE_SECRET`):

```sql
select public.schedule_reconcile('https://<REF>.supabase.co/functions/v1/reconcile', '<RECONCILE_SECRET>');
```

## Autenticación en producción

- Authentication → Providers → Google: activar con el ID y el secreto de producción.
- Authentication → Providers → Email: **desactivar** el registro por email (solo Google).
- Authentication → URL Configuration: Site URL = el dominio real; Redirect URLs = `https://<dominio>/**`.
- En Google Cloud: agregar `https://<REF>.supabase.co/auth/v1/callback` a los URI de redirección autorizados.

## Después de publicar: verificación

Seguir `CHECKLIST-LANZAMIENTO.md`.
