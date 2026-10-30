# Legal: qué falta antes de lanzar (para el dueño)

> **Aviso importante:** los textos legales de la app (aviso legal, privacidad, cookies, bases del programa y normas de la comunidad) son **plantillas serias, no asesoramiento jurídico**. Las preparó un programador, no un abogado. Antes de abrir la app al público tienen que ser **revisadas y aprobadas por la gestoría o un abogado**. La responsabilidad legal del texto final es del local.

## 1. Qué quedó hecho en la app

- Páginas públicas (se abren sin iniciar sesión): `/aviso-legal`, `/privacidad`, `/cookies`, `/bases` y `/normas`. Cada una muestra la versión y la fecha de última actualización.
- Pie de página con esos enlaces en la portada, el login, la bienvenida, el perfil y las propias páginas legales.
- En la bienvenida (primera vez que alguien entra) hay tres casillas obligatorias, sin marcar de antemano: tengo 18 años o más, acepto la política de privacidad, acepto las bases y las normas. Y una cuarta, opcional, para recibir promos por email. Sin las tres primeras no se puede seguir, y la app explica por qué con amabilidad.
- El servidor guarda la prueba: cuándo confirmó la edad, cuándo aceptó cada cosa y **qué versión** de los textos aceptó.
- Si cambian los textos y se sube la versión, la próxima vez que entre cada cliente tiene que volver a aceptar (sin perder puntos ni datos). Quienes ya tenían cuenta antes de este cambio también pasan una vez por las casillas nuevas.
- En el perfil: "Descargar mis datos" (archivo con todo lo que la app guarda de esa persona), "Borrar mi cuenta" (explica qué se borra y qué se conserva) y la casilla de promos para retirar el permiso cuando quiera.
- No hay banner de cookies porque la app **no usa cookies de analítica, publicidad ni seguimiento**; solo guarda lo técnico (la sesión, preferencias y la caché de la app). **Si algún día se agrega Google Analytics, Meta Pixel, publicidad o similar, hay que avisar antes**: en ese caso es obligatorio pedir permiso con un banner y actualizar la política de cookies.

## 2. Datos que hay que completar (pasáselos al desarrollador o completalos vos)

Todo está en **un solo archivo**: `src/legal/company.ts`. Lo que dice `PENDIENTE:` hay que reemplazarlo por el dato real. Las páginas lo leen de ahí; mientras falte algo, las páginas legales muestran un cartel de "Borrador" (desaparece solo cuando se completa todo).

| Campo | Qué es | Dato |
| --- | --- | --- |
| `legalName` | Razón social, o nombre y apellidos si sos autónomo/a | PENDIENTE |
| `taxId` | NIF o CIF | PENDIENTE |
| `registeredAddress` | Domicilio social o fiscal completo (calle, número, código postal, ciudad) | PENDIENTE |
| `contactEmail` | Email de contacto, también para que los clientes ejerzan sus derechos de datos | PENDIENTE |
| `commercialRegistry` | Datos del Registro Mercantil (tomo, folio, hoja). **Solo si es una sociedad inscrita.** Si sos autónomo/a, dejarlo vacío (`''`) | PENDIENTE o vacío |
| `contactPhone` | Teléfono (opcional) | vacío por ahora |
| `dpo` | Delegado de protección de datos. Casi seguro que no hace falta; que lo confirme la gestoría. Vacío si no | vacío |
| `tradeName`, `storeAddress`, `website` | Ya están: Uno de Miga, Carrer Llop 1 (Valencia) y la web | listo |

Además: crear (o confirmar) un email real para recibir consultas de privacidad, y revisarlo seguido; la ley da **un mes** para contestar a quien pide ver o borrar sus datos.

## 3. Qué tiene que revisar la gestoría (página por página)

Pasale este documento y las direcciones de las páginas (los textos están en `src/legal/`):

1. **Aviso legal** (`/aviso-legal`): que los datos del titular estén completos y sean correctos (LSSI art. 10), el objeto del sitio, la licencia sobre lo que publican los usuarios, la jurisdicción (Valencia).
2. **Política de privacidad** (`/privacidad`):
   - Responsable, finalidades y bases jurídicas (programa = contrato; promos = consentimiento; antifraude = interés legítimo).
   - Lista de datos tratados y de proveedores (Supabase en Irlanda, Netlify, Google) y las garantías por transferencias fuera de la UE (cláusulas tipo / Marco de Privacidad UE-EE. UU.).
   - **Plazos de conservación**: hoy el texto dice que los datos se guardan mientras exista la cuenta y se borran al borrarla. Confirmar si conviene otro criterio (por ejemplo, borrar cuentas inactivas tras X años) y qué se conserva por obligación legal.
   - Si la prueba de consentimiento (fecha y versión aceptada) puede o debe conservarse un tiempo tras borrar la cuenta (hoy se borra junto con la cuenta).
   - Si hace falta delegado de protección de datos y si hay que hacer una evaluación de impacto (casi seguro que no por el volumen).
3. **Política de cookies** (`/cookies`): que sea correcto no mostrar banner (solo almacenamiento técnico necesario).
4. **Bases del programa** (`/bases`): cómo se suman puntos, premios y escalones, caducidad de los códigos de canje, que los juegos son **de habilidad, sin apuestas ni azar con premio en dinero**, que no se pueden comprar puntos, el derecho a **anular puntos por fraude**, el aviso al modificar o terminar el programa y que los puntos no caducan por tiempo. Que confirme si el programa necesita algún requisito adicional (por ejemplo, sobre promociones o sorteos) y que **no hay problema con las monedas y la tienda** tal como están hoy. Importante: si en el futuro se permite apostar puntos entre clientes, hay que consultarlo **antes** (ver sección 11 de `docs/PENDIENTES-AUGUSTO.md`).
5. **Normas de la comunidad** (`/normas`): moderación, cómo reportar contenido y la responsabilidad del local sobre lo que publican los clientes (LSSI: retirar contenido ilícito cuando se tiene conocimiento).
6. **Textos de las casillas** de la bienvenida y de la pantalla de perfil (están en `src/copy/legal.ts`): que sean claras y suficientes como prueba de consentimiento.

Cuando la gestoría devuelva cambios, se editan los archivos de `src/legal/`. Si el cambio es de fondo (cambia qué aceptan los clientes), hay que **subir la versión**: `LEGAL_VERSION` y `LEGAL_UPDATED_AT` en `src/legal/company.ts` y, al publicar, la versión guardada en la base (`settings`, clave `legal`). Así todos los clientes vuelven a aceptar. Para cambios menores (una errata) no hace falta.

## 4. Qué hay que hacer fuera del código

- **Registro de actividades de tratamiento (RAT).** Si el local guarda datos de clientes (ahora sí, con esta app) tiene que tener un documento interno que lo describa: qué datos, para qué, con quién se comparten, cuánto se guardan y qué medidas de seguridad hay. La gestoría tiene modelos.
- **Contratos de encargado de tratamiento (DPA)** con los proveedores que tocan datos: **Supabase** y **Netlify** (y Google para el login). Normalmente se aceptan desde el propio panel de cada servicio (suelen llamarse "Data Processing Addendum"); guardá una copia firmada o el comprobante. Confirmar que el proyecto de Supabase de producción esté en la región de Europa (Irlanda).
- **Cartel o ticket informativo en el local.** Poner en el mostrador (o en el ticket) un aviso breve: que existe el programa, que se tratan datos, quién es el responsable y dónde ver la política completa (el QR puede llevar a `/privacidad`).
- **No usar los datos para publicidad sin la casilla.** Solo se pueden mandar promos a quien marcó la casilla opcional. En la base queda quién la marcó (columna `promo_consent`). No exportar la lista de clientes para otras campañas ni a otras herramientas sin hablar antes con la gestoría.
- **Atender derechos.** Alguien puede escribir al email de contacto pidiendo ver, corregir o borrar datos, o quejarse. Acceso, borrado y retirar promos se pueden hacer solos desde el perfil; el resto (oposición, limitación) se atiende a mano. Contestar en un mes como máximo y guardar registro.
- **Brechas de seguridad.** Si se filtraran datos de clientes, hay que avisar a la AEPD en 72 horas. Tener a mano a quién llamar.
- **Modo invitado.** Antes del lanzamiento se apaga (ver `docs/GOOGLE-LOGIN.md`, paso 7): todo cliente entra con Google, como indica el plan.
- **Pantalla de consentimiento de Google.** Cargar ahí las direcciones de privacidad y condiciones (están anotadas en `docs/GOOGLE-LOGIN.md`, paso 1) **después** de completar los datos del titular.
- **Facturas y tickets.** Siguen en el sistema de caja del local; la ley obliga a conservarlos aunque el cliente borre su cuenta de la app. No están vinculados a la cuenta una vez borrada.

## 5. Lista rápida

- [ ] Completar `src/legal/company.ts` (nombre/razón social, NIF/CIF, domicilio, email; registro mercantil si aplica).
- [ ] Gestoría revisa las 5 páginas y los textos de las casillas.
- [ ] Ajustes pedidos por la gestoría aplicados; versión subida si fueron de fondo.
- [ ] DPA aceptados con Supabase, Netlify y Google; proyecto de Supabase en Europa.
- [ ] Registro de actividades de tratamiento hecho.
- [ ] Cartel/ticket informativo en el local.
- [ ] Email de contacto creado y alguien que lo mire.
- [ ] Modo invitado apagado y pantalla de consentimiento de Google cargada con las direcciones legales.
