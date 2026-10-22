# 03 · Integración con el POS

## Lo que sabemos del POS (relevado del código)

- JavaScript puro con módulos ES, sin framework. Hosteado en Netlify (`unodemigapos.netlify.app`).
- Corre en el navegador de una tablet Android, **offline-first** (IndexedDB) y sincroniza con su propio Supabase.
- Ya tiene funciones de Netlify con `SUPABASE_SERVICE_ROLE_KEY` disponible.
- Tabla `ventas`: `uuid`, `fecha`, `hora`, `total_centavos`, `sale_mode` (`normal` | `togoo`), `forma_pago` (`efectivo` | `tarjeta` | `glovo` | `bizum`), `anulada`, `origen`, `pedido_id`.
- Precios finales en centavos, sin desglose de IVA.
- RLS del POS muy permisiva (cualquier autenticado lee todo). **Por eso nunca compartimos base ni usuarios.**
- No tiene base de pruebas.

## El contrato

Toda llamada entre servidores lleva:

- Header `X-Timestamp`: epoch en segundos.
- Header `X-Signature`: `hex(HMAC_SHA256(secret, timestamp + "." + body))`.
- Se rechaza si la firma no coincide o si el timestamp tiene más de 300 segundos.

### A. Fidelización → POS: consultar una venta

`POST {POS_BASE_URL}/.netlify/functions/loyalty-sale` — firmado con `POS_HMAC_SECRET`.

Request: `{ "sale_uuid": "…" }`

Response 200:

```json
{
  "found": true,
  "sale": {
    "uuid": "…",
    "total_cents": 1240,
    "sold_at": "2026-10-22T13:05:00+02:00",
    "voided": false,
    "channel": "local"
  }
}
```

- `channel`: `local` | `glovo` | `togoo` (derivado de `forma_pago` y `sale_mode`).
- Si no existe (o todavía no sincronizó): `{ "found": false }`.
- Devuelve **solo** esos campos. Nada de productos, clientes ni caja.

### B. POS → Fidelización: validar un código de canje

`POST {SUPABASE_URL}/functions/v1/validate-redemption` — firmado con `POS_INBOUND_HMAC_SECRET`.

Request: `{ "code": "MIGA-7K3P" }`

Response 200:

```json
{
  "valid": true,
  "reward": { "id": "…", "name": "Un café", "kind": "points" },
  "customer_name": "Lucía"
}
```

o `{ "valid": false, "reason": "expired" | "used" | "not_found" }`.

La validación marca el código como usado en el mismo paso (operación atómica).

### C. QR de venta en la tablet

Después de confirmar una venta, el POS muestra un QR con:
`{APP_URL}/s/{venta.uuid}`
durante unos 60 segundos o hasta que se cierre.

## Modo mock (para desarrollar esta app ya)

`supabase/functions/_shared/pos-adapter.ts` expone:

```ts
interface PosAdapter {
  getSale(saleUuid: string): Promise<PosSale | null>
}
```

- `POS_MODE=mock`: lee ventas falsas de una tabla local `dev_mock_sales` (solo existe en desarrollo, con seed) para poder probar todos los casos: venta válida, anulada, de Glovo, vieja, inexistente, que "aparece" más tarde.
- `POS_MODE=real`: llama al endpoint A con HMAC.
- Una pantalla de desarrollo (`/dev`, solo en modo dev) permite crear ventas mock y ver su QR, para simular la tablet.

## Trabajo a hacer en el repo del POS (más adelante)

Cuando la app de fidelización esté lista, abrir el repo del POS en VS Code y pasarle a Claude este prompt:

```
Vamos a conectar este POS con la app de fidelización de Uno de Miga, que es un proyecto aparte con su propio Supabase. Te paso el contrato de integración (pegar aquí la sección "El contrato" de docs/03-integracion-pos.md).

Reglas:
- Cambios solo aditivos. No tocar caja, ventas, cierres ni la sincronización existente.
- No compartimos base de datos ni usuarios con la otra app. Solo estas funciones.
- Primero creá una base de pruebas (staging) y probá todo ahí. Nunca contra la base real.

Tareas, de a una, proponiendo plan antes de cada una:
1. Netlify Function `loyalty-sale`: verifica HMAC (secreto en env `LOYALTY_HMAC_SECRET`), lee la venta por uuid con service role y devuelve solo los campos del contrato.
2. Después de confirmar una venta, mostrar un QR grande con `{LOYALTY_APP_URL}/s/{uuid}` durante 60 segundos, con botón para cerrar. Debe funcionar offline (el QR se genera localmente).
3. Botón "Canjear premio" en la caja: el empleado escribe el código, el frontend llama a una nueva Netlify Function `loyalty-redeem` (autenticada con el token del empleado, como cobro-terminal) que a su vez llama a `validate-redemption` con HMAC. Si es válido, registrar el producto del premio a 0 € (o el descuento) para que descuente stock como cualquier venta.
4. Documentar las nuevas variables de entorno.
```
