# Mudar la app a app.unodemigavalencia.com (guía paso a paso)

Objetivo: que los clientes entren por `https://app.unodemigavalencia.com` y no vean "netlify.app", y que esa dirección quede fija aunque algún día cambies de proveedor o de cuenta de Netlify.

**Tu web actual (www.unodemigavalencia.com) no se toca.** La dirección vieja (`udm-appfidelizacion.netlify.app`) sigue funcionando durante toda la mudanza. Tiempo total: 1 hora de trabajo, más la espera de internet (de minutos a unas horas).

Índice

1. Netlify: agregar el dominio
2. Arsys: crear el registro `app`
3. Netlify: verificar, HTTPS y dominio principal
4. Cambiar la dirección en los 4 lugares
5. Pruebas finales
6. Cuándo quitar la dirección vieja
7. Plan de vuelta atrás
8. Tabla resumen y dudas frecuentes

Regla de oro: **agregá lo nuevo sin quitar lo viejo**. Lo viejo se saca recién en el paso 6.

---

## 1. Netlify: agregar el dominio al sitio

1. Entrá a https://app.netlify.com y abrí el sitio **udm-appfidelizacion**.
2. En el menú de la izquierda tocá **Domain management** (en algunas versiones del panel está dentro de **Site configuration → Domain management**).
3. Tocá **Add a domain** (puede decir **Add domain** o **Add custom domain**).
4. Escribí `app.unodemigavalencia.com` y tocá **Verify** y luego **Add domain**. Si Netlify pregunta si sos el dueño del dominio, respondé que sí.
5. Netlify te va a mostrar un aviso tipo "Awaiting External DNS" o "DNS verification pending". **Es normal**: todavía falta el paso 2.
6. Tocá **Options → Configure DNS** o **Check DNS configuration** (el nombre varía) y anotá el valor del registro **CNAME** que te pide. Para un subdominio, el valor es la dirección del sitio: `udm-appfidelizacion.netlify.app`.

Salió bien si: en la lista aparece `app.unodemigavalencia.com` con un aviso amarillo de DNS pendiente.

Si no la ves o Netlify dice "domain already in use": el dominio está en otro sitio de Netlify. Avisame y lo vemos.

Fuente: documentación de Netlify, "External DNS configuration" (https://docs.netlify.com/domains-https/custom-domains/configure-external-dns/). No pude abrirla en vivo para esta guía: si algún nombre de botón cambió, seguí el sentido del paso.

---

## 2. Arsys: crear el registro `app`

### 2.1 Dónde está la gestión de DNS

No pude confirmar el menú exacto del panel actual de Arsys. Probá estas rutas, en este orden. El nombre puede variar:

1. Entrá a https://secure.arsys.es (el área de cliente) con tu usuario.
2. Buscá **Mis productos** (o **Mis servicios**, o **Dominios**).
3. Tocá el dominio **unodemigavalencia.com**.
4. Buscá una opción que se llame **DNS**, **Zona DNS**, **Gestión de DNS**, **Gestionar DNS** o **Editar zona**.

Si no la encontrás, escribile a soporte de Arsys con este texto: "Quiero agregar un registro CNAME para el subdominio app del dominio unodemigavalencia.com. ¿Dónde se gestiona la zona DNS?". También sirve su chat o el teléfono.

### 2.2 Cómo saber si los DNS los administra Arsys

Puede pasar que el dominio esté en Arsys pero los DNS los lleve **otro servicio** (por ejemplo Cloudflare o el hosting de tu web), usando "servidores de nombres" (nameservers) externos.

- Dentro del dominio en Arsys, buscá **Servidores DNS** o **Nameservers**. Si ves nombres de Arsys, los DNS son de Arsys y seguís en 2.3.
- También podés entrar a https://dnschecker.org, elegir **NS**, escribir `unodemigavalencia.com` y ver qué servidores aparecen.
- Si aparecen servidores de otra empresa, el registro `app` **se crea en esa otra empresa**, no en Arsys. Preguntale a quien te hizo la web actual.

### 2.3 Crear el registro

**Antes de nada: no modifiques ni borres ningún registro que ya exista.** En particular los de `www` (tipo A o CNAME), los **MX** (correo) y los **TXT**. Si los tocás podés dejar tu web o tu correo sin funcionar. Solo agregás uno nuevo.

1. Dentro de la gestión de DNS, tocá **Añadir registro** (o **Nuevo registro**, **Crear**).
2. Completá:

| Campo | Valor |
| --- | --- |
| Tipo | `CNAME` |
| Nombre / Host / Subdominio | `app` (solo `app`, sin `.unodemigavalencia.com`; si el panel exige el nombre completo, `app.unodemigavalencia.com`) |
| Valor / Destino / Apunta a | `udm-appfidelizacion.netlify.app` (el que te dio Netlify en el paso 1) |
| TTL | `3600` (1 hora) o el valor "automático" |

3. Punto final: algunos paneles piden el destino con un punto al final (`udm-appfidelizacion.netlify.app.`) y otros sin punto. Probá primero **sin** punto. Si el panel lo rechaza o lo guarda raro, probá con punto. Si el panel agrega el punto solo, no lo escribas vos.
4. Guardá. Si el panel dice que ya existe un registro `app`, no lo pises: avisame.

### 2.4 Cuánto tarda y cómo comprobarlo

Entre unos minutos y unas horas (a veces hasta 24). Para ver si ya llegó:

1. Entrá a https://dnschecker.org.
2. Escribí `app.unodemigavalencia.com`, elegí el tipo **CNAME** y tocá **Search**.
3. Salió bien si en la mayoría de los lugares aparece `udm-appfidelizacion.netlify.app`.

Mientras tanto no cambies nada más. Si pasan 24 horas y no aparece: revisá que el nombre sea `app` (sin espacios ni duplicar el dominio) y que lo hayas guardado.

---

## 3. Netlify: verificar, HTTPS y dominio principal

1. Volvé a **Domain management** del sitio en Netlify.
2. Tocá **Verify DNS configuration** (o **Check DNS configuration**). Si el DNS ya llegó, el aviso amarillo desaparece.
3. En la sección **HTTPS** tocá **Verify DNS configuration** y después **Provision certificate** (o **Let's Encrypt certificate**). Es gratis y automático. Puede tardar unos minutos y a veces una hora.
4. Salió bien si ves **"Your site has HTTPS enabled"** y al abrir `https://app.unodemigavalencia.com` aparece la app con el candado.
5. **Hacé este punto recién después del paso 4** (ver el aviso de abajo). Dejalo como principal: en la lista de dominios, en la fila de `app.unodemigavalencia.com` tocá **Options → Set as primary domain**. Netlify va a redirigir `udm-appfidelizacion.netlify.app` a la nueva dirección.

Si el certificado no sale: esperá una hora y probá de nuevo. Si sigue, es casi siempre que el DNS no terminó de propagar (volvé al 2.4).

Importante: la redirección de la dirección vieja a la nueva tiene que hacerse **después** del paso 4 (Google y Supabase). Si activás el dominio principal antes, quien entre por la vieja será mandado a la nueva y Google puede rechazar el ingreso. Por eso el orden recomendado es: completar el paso 3 hasta el HTTPS, hacer el paso 4, y recién ahí **Set as primary domain**.

---

## 4. Cambiar la dirección en 4 lugares

En todos los casos: **agregá la nueva y dejá la vieja** hasta terminar las pruebas.

### 4.1 Google Cloud

1. Entrá a https://console.cloud.google.com y elegí el proyecto **UnodeMigaCredentials**.
2. Menú **Google Auth Platform → Clientes** y abrí el cliente **Uno de Miga web**.
3. En **Orígenes autorizados de JavaScript** tocá **Agregar URI** y escribí `https://app.unodemigavalencia.com`. No quites `https://udm-appfidelizacion.netlify.app` todavía.
4. En **URI de redirección autorizados** **no cambies nada**: sigue siendo `https://qfpqqkpyxvjzeddnqzuz.supabase.co/auth/v1/callback`. Ese es de Supabase y no depende de tu dominio.
5. Tocá **Guardar**. Google avisa que puede tardar unos minutos (a veces hasta unas horas) en aplicarse.
6. Menú **Google Auth Platform → Branding** (en versiones anteriores, "Pantalla de consentimiento de OAuth"):
   - **Dominios autorizados:** agregá `unodemigavalencia.com`.
   - **Página principal de la aplicación:** `https://app.unodemigavalencia.com`
   - **Política de privacidad:** `https://app.unodemigavalencia.com/privacidad`
   - **Condiciones del servicio:** `https://app.unodemigavalencia.com/bases`
   - Guardá. Si Google te pide verificar el dominio (Search Console), seguí sus indicaciones; el dominio es tuyo y se verifica con un registro TXT, que se agrega en Arsys sin tocar los demás.

Los textos de Google están en `docs/GOOGLE-LOGIN.md`.

### 4.2 Supabase

1. Entrá a https://supabase.com/dashboard y abrí el proyecto `qfpqqkpyxvjzeddnqzuz`.
2. **Authentication → URL Configuration**.
3. **Site URL:** cambiala a `https://app.unodemigavalencia.com`.
4. **Redirect URLs:** tocá **Add URL** y agregá `https://app.unodemigavalencia.com/**` (con los dos asteriscos). **Dejá** `https://udm-appfidelizacion.netlify.app/**`.
5. **Save changes**.

### 4.3 Variables de entorno de Netlify

1. En Netlify: **Site configuration → Environment variables**.
2. Editá `VITE_APP_URL` y poné `https://app.unodemigavalencia.com` (sin barra al final). Si no existe, creala.
3. Hacé un nuevo despliegue: **Deploys → Trigger deploy → Deploy site** (hace falta porque la variable se incorpora al construir la web).

Qué usa esa variable (ya preparado en el código, `src/lib/appUrl.ts`): las páginas legales (`/aviso-legal`, `/privacidad`) muestran esa dirección. El QR de venta `{VITE_APP_URL}/s/{uuid}` lo arma el sistema del local (POS), no esta app: ver 4.4.

### 4.4 Código, textos y el sistema del local (POS)

- En el código, la dirección sale de **una sola variable** (`VITE_APP_URL`). Con el valor por defecto actual (`netlify.app`) no hay que cambiar archivos: solo la variable de Netlify del 4.3.
- Cuando la app esté publicada en la nueva dirección, hay que dar la nueva base al POS para que arme los QR `https://app.unodemigavalencia.com/s/{uuid}` (variable `LOYALTY_APP_URL` en el sistema del local; ver `docs/03-integracion-pos.md`). Mientras tanto, los QR viejos con `netlify.app` siguen funcionando porque esa dirección redirige.
- Documentos que mencionan la dirección vieja y conviene actualizar al final: `docs/GOOGLE-LOGIN.md`, `docs/DEPLOY.md`, `docs/PENDIENTES-AUGUSTO.md`. También `.env.example` si usás la dirección pública en pruebas.

---

## 5. Pruebas finales (lista de verificación)

Hacelas desde el celular, con los datos móviles o en una ventana privada.

- [ ] `https://app.unodemigavalencia.com` abre la app con candado, sin avisos.
- [ ] Entrar con Google funciona y vuelve a la app con tu sesión.
- [ ] Los puntos de tu cuenta están intactos (son los mismos de antes).
- [ ] Instalar la app en la pantalla de inicio desde la nueva dirección y abrirla. (La instalada antes con la dirección vieja es otra app: ver dudas frecuentes.)
- [ ] Escanear un QR de venta: llega a `/s/...` y suma los puntos.
- [ ] `/privacidad`, `/bases`, `/aviso-legal` y `/cookies` abren en la dirección nueva y muestran la dirección nueva.
- [ ] Después de **Set as primary domain**: abrir `https://udm-appfidelizacion.netlify.app` te lleva a `https://app.unodemigavalencia.com`.
- [ ] Tu web `www.unodemigavalencia.com` y tu correo siguen funcionando igual.

Si algo falla: error "redirect_uri_mismatch" o "origin_mismatch" → revisá el 4.1 (puede tardar en aplicar). Vuelve a la pantalla de login sin entrar → revisá 4.2.

---

## 6. Cuándo recién quitar la dirección vieja

Esperá al menos una semana de uso normal y verificá que ningún QR impreso ni ningún enlace compartido siga usando la dirección vieja. Recién ahí:

- Google Cloud: en el cliente, quitá `https://udm-appfidelizacion.netlify.app` de **Orígenes autorizados de JavaScript**.
- Supabase: quitá `https://udm-appfidelizacion.netlify.app/**` de **Redirect URLs**.
- En Netlify **no borres** la dirección netlify.app (no se puede ni hace falta): seguirá redirigiendo.

---

## 7. Plan de vuelta atrás

Como nada viejo se quitó, volver es fácil:

1. Netlify: en **Domain management**, volvé a poner `udm-appfidelizacion.netlify.app` como dominio principal (o quitá `app.unodemigavalencia.com`).
2. Netlify: `VITE_APP_URL` otra vez en `https://udm-appfidelizacion.netlify.app` y nuevo despliegue.
3. Supabase: **Site URL** otra vez la dirección vieja.
4. Google y Arsys no hace falta tocarlos: el registro `app` y el origen extra no molestan.

---

## 8. Tabla resumen: qué cambiar y dónde

| Dónde | Qué | Valor EXACTO | ¿Se quita lo viejo? |
| --- | --- | --- | --- |
| Netlify → Domain management | Agregar dominio | `app.unodemigavalencia.com` | No |
| Arsys → DNS de unodemigavalencia.com | Registro CNAME, nombre `app` | destino `udm-appfidelizacion.netlify.app` | No se tocan los demás registros |
| Google Cloud → Clientes → Uno de Miga web | Orígenes autorizados de JavaScript | `https://app.unodemigavalencia.com` | Recién en el paso 6 |
| Google Cloud → Clientes (URI de redirección) | No cambia | `https://qfpqqkpyxvjzeddnqzuz.supabase.co/auth/v1/callback` | No aplica |
| Google Cloud → Branding | Dominio autorizado | `unodemigavalencia.com` | No |
| Google Cloud → Branding | Página principal / Privacidad / Condiciones | `https://app.unodemigavalencia.com` / `.../privacidad` / `.../bases` | Se reemplazan |
| Supabase → Authentication → URL Configuration | Site URL | `https://app.unodemigavalencia.com` | Se reemplaza |
| Supabase → URL Configuration | Redirect URLs | `https://app.unodemigavalencia.com/**` | Recién en el paso 6 |
| Netlify → Environment variables | `VITE_APP_URL` | `https://app.unodemigavalencia.com` | Se reemplaza |
| Sistema del local (POS) | Base de los QR | `https://app.unodemigavalencia.com` | Se reemplaza |

### Dudas frecuentes

**¿Por qué no se pierde nada?** Los puntos y las cuentas están en Supabase, no en la dirección web. Y la dirección vieja sigue viva y redirige a la nueva.

**¿Por qué los subdominios son gratis?** Porque el costo es el del dominio (`unodemigavalencia.com`), que ya pagás. Un subdominio es solo una entrada más en su tabla de DNS.

**¿Y los .es y .eu?** No hacen falta ahora. Más adelante se pueden redirigir al `.com` (Arsys suele tener una opción de "redirección" del dominio) sin afectar a esta app.

**¿Qué pasa con la app que mis clientes ya instalaron?** La instalada desde la dirección vieja seguirá abriendo mientras esa dirección redirija. Como el navegador la considera otra app, quien quiera la nueva debe reinstalarla desde `app.unodemigavalencia.com`. El inicio de sesión se vuelve a pedir una vez, pero los puntos están a salvo en la cuenta. Hacelo con calma: conviene avisar en el local.

**¿Y si cambio de proveedor en el futuro?** Solo cambiás el destino del registro `app` en Arsys. La dirección para los clientes queda igual.
