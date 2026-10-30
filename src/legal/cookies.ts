import { company } from './company'
import type { LegalDoc } from './types'

/**
 * Política de cookies y almacenamiento local (art. 22.2 LSSI-CE). PLANTILLA para revisión de la gestoría.
 * Si algún día se añade analítica, publicidad o cualquier cookie no esencial, hay que actualizar este texto
 * y pedir consentimiento previo (banner con "Aceptar" y "Rechazar" al mismo nivel) antes de cargarla.
 */
export const cookies: LegalDoc = {
  path: '/cookies',
  shortTitle: 'Cookies',
  title: 'Política de cookies y almacenamiento local',
  intro: `${company.tradeName} no utiliza cookies de analítica, publicidad ni seguimiento, ni comparte información de su navegación con terceros con fines comerciales. Solo se emplea almacenamiento técnico necesario para que la aplicación funcione.`,
  sections: [
    {
      heading: '1. Qué son estas tecnologías',
      paragraphs: [
        'Las cookies y tecnologías similares (como el almacenamiento local del navegador, localStorage, o la caché del service worker de una aplicación instalable) guardan pequeños datos en su dispositivo. Según el artículo 22.2 de la LSSI-CE, las que son estrictamente necesarias para prestar un servicio que usted solicita están exentas del deber de pedir consentimiento. Por eso esta aplicación no muestra un banner de cookies.',
      ],
    },
    {
      heading: '2. Qué se guarda, para qué y cuánto tiempo',
      bullets: [
        'Sesión de inicio de sesión (localStorage, clave que empieza por “sb-” y termina en “-auth-token”): la guarda Supabase para mantenerle identificado. Finalidad: autenticación. Se mantiene hasta que cierre sesión o expire la sesión.',
        'Compra pendiente (localStorage, “pending_sale_uuid”): recuerda el código de una compra escaneada mientras completa el inicio de sesión. Finalidad: funcional. Se borra al sumarse la compra.',
        'Preferencia de sonido (localStorage, “sound_enabled”): recuerda si activó los sonidos. Finalidad: personalización a petición suya.',
        'Progreso de los minijuegos en el dispositivo (localStorage, claves que empiezan por “arcade_”): niveles superados, estrellas y mejores marcas. Finalidad: funcional. El progreso oficial (puntos, monedas, ranking) se guarda en el servidor.',
        'Reintento de sesión (sessionStorage, “udm:session-retried”): evita bucles cuando una sesión caducada se renueva. Se borra al cerrar la pestaña.',
        'Caché de la aplicación (service worker de la PWA): guarda los archivos de la aplicación para que cargue rápido y pueda abrirse con mala cobertura. Finalidad: técnica.',
      ],
    },
    {
      heading: '3. Cookies de terceros',
      paragraphs: [
        'Al iniciar sesión se le redirige a Google, que puede usar sus propias cookies en sus páginas conforme a su política (https://policies.google.com/technologies/cookies). Dentro de esta aplicación no se cargan servicios de analítica, publicidad ni redes sociales de terceros.',
      ],
    },
    {
      heading: '4. Cómo borrar o bloquear estos datos',
      bullets: [
        'Cerrar sesión desde “Tu perfil” elimina la sesión guardada.',
        'Desde los ajustes de su navegador puede borrar los datos del sitio (almacenamiento local, cookies y caché) o bloquearlos. Si los bloquea, es posible que no pueda iniciar sesión o que algunas funciones no operen.',
        'Si instaló la aplicación en su pantalla de inicio, al desinstalarla se elimina también su caché.',
        'Borrar su cuenta desde “Tu perfil” elimina sus datos del servidor; los datos locales de su dispositivo se pueden borrar como se indica arriba.',
      ],
    },
    {
      heading: '5. Cambios',
      paragraphs: [
        `Si en el futuro ${company.tradeName} incorporase analítica, publicidad u otras tecnologías no esenciales, actualizará esta política y solicitará su consentimiento previo, que podrá rechazar o retirar en cualquier momento, antes de activarlas.`,
      ],
    },
  ],
}
