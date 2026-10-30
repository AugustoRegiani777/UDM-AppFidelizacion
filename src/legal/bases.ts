import { company } from './company'
import type { LegalDoc } from './types'

/**
 * Bases y condiciones del programa de fidelización. PLANTILLA para revisión de la gestoría.
 * Las cifras concretas (puntos por euro, escalones, topes) se muestran en la propia app y se pueden ajustar
 * desde el panel; aquí se describen las reglas sin fijar números que puedan cambiar.
 */
export const bases: LegalDoc = {
  path: '/bases',
  shortTitle: 'Bases del programa',
  title: 'Bases y condiciones del programa de fidelización',
  intro: `Estas bases regulan el programa de fidelización de ${company.tradeName} (en adelante, el “Programa”), gratuito y dirigido a clientes mayores de 18 años del establecimiento situado en ${company.storeAddress}. Al registrarse, el usuario declara haberlas leído y las acepta.`,
  sections: [
    {
      heading: '1. Quién puede participar',
      paragraphs: [
        'Pueden participar las personas físicas mayores de 18 años que inicien sesión con una cuenta de Google propia y acepten estas bases, la Política de privacidad y las Normas de la comunidad. Cada persona puede tener una sola cuenta. La cuenta es personal e intransferible.',
      ],
    },
    {
      heading: '2. Cómo se suman puntos',
      bullets: [
        `Los puntos de compra se suman por las compras efectuadas en el local de ${company.tradeName}: la persona escanea el código QR de su ticket con la aplicación y el sistema registra la venta a su cuenta.`,
        'El servidor calcula los puntos a partir del importe real de la venta, leído del sistema de caja del local, según la equivalencia vigente (puntos por euro) que se muestra en la aplicación. El cliente no decide ni modifica los puntos.',
        'Cada ticket solo puede sumarse una vez y en una única cuenta. Las ventas anuladas o devueltas no suman puntos y, si ya se habían sumado, se descuentan.',
        'Pueden existir misiones o acciones con puntos extra (por ejemplo, seguir al local en una red social o dejar una reseña), sujetas a las condiciones indicadas en cada una y, en su caso, a verificación por el local.',
        'Los puntos y las monedas del Programa no se pueden comprar ni pagar con dinero, no tienen valor monetario, no son canjeables por dinero y no se pueden vender ni transferir entre usuarios.',
      ],
    },
    {
      heading: '3. Premios y escalones de comida',
      bullets: [
        'Al alcanzar determinados totales acumulados de puntos de compra se desbloquean premios de comida (los “escalones”), que se muestran en la aplicación con su descripción. Los escalones pueden repetirse cada vez que se alcanza de nuevo el total indicado.',
        'Los premios están sujetos a disponibilidad y a las condiciones de cada uno (por ejemplo, producto concreto o tope de precio). Los premios no son canjeables por dinero ni por otro producto, salvo decisión del local.',
      ],
    },
    {
      heading: '4. Cómo se canjea un premio',
      bullets: [
        'El canje se hace siempre en la caja del local, mostrando el código que genera la aplicación. El código lo valida el personal del local en el sistema de caja.',
        'Cada código es de un solo uso y caduca a los pocos minutos de generarse (el tiempo restante se muestra en pantalla). Si caduca sin usarse, puede generarse otro mientras el premio siga desbloqueado, sin perder los puntos.',
        'Para desbloquear algunos premios puede ser necesario superar un minijuego (“cofre”). Es una dinámica de ambientación: el premio lo habilitan los puntos, y se puede reintentar sin límite.',
        'Los premios de la tienda del Programa que se canjean en el local siguen estas mismas reglas de código.',
      ],
    },
    {
      heading: '5. Juegos de habilidad',
      paragraphs: [
        'Los minijuegos son de habilidad: el resultado depende de la destreza del jugador y no de la suerte. En el Programa no hay apuestas ni juegos de azar con premio en dinero, y no se paga dinero por jugar.',
        'Las partidas oficiales las valida el servidor repitiendo la partida; solo estas cuentan para el ranking y para las monedas de juego. Las monedas de juego se ganan jugando (con un tope diario), no tienen valor económico y no se canjean por comida ni por dinero. Los pases de desafío y las mejoras de personaje de la tienda se obtienen con monedas o puntos según se indica en la aplicación.',
        'Los rankings muestran el nombre del jugador, que puede ocultarse desde el perfil. Los resultados con mejoras de personaje pueden clasificarse aparte de los resultados sin mejoras.',
      ],
    },
    {
      heading: '6. Tienda del Programa',
      paragraphs: [
        'En la tienda se pueden obtener mejoras de personaje y premios del local con puntos de compra, y pases con monedas de juego. Gastar puntos en la tienda no hace perder los escalones de comida ya alcanzados. Todo gasto de puntos o monedas se registra en el libro de movimientos y es definitivo, salvo error del sistema o anulación por fraude.',
      ],
    },
    {
      heading: '7. Antifraude y anulación de puntos',
      paragraphs: [
        `${company.tradeName} podrá, sin necesidad de aviso previo cuando exista indicio razonable de fraude, anular puntos, monedas, premios, códigos o partidas obtenidos de forma fraudulenta, irregular o con manipulación del sistema (por ejemplo: tickets ajenos o duplicados, cuentas múltiples, uso de programas automáticos, alteración del juego o de las comunicaciones), así como suspender o cancelar la cuenta implicada. La persona afectada podrá presentar alegaciones por el correo de contacto (${company.contactEmail}).`,
      ],
    },
    {
      heading: '8. Vigencia, modificación y fin del Programa',
      bullets: [
        'El Programa tiene duración indefinida.',
        `${company.tradeName} podrá modificar estas bases, la equivalencia de puntos, los escalones, los premios, los juegos o la tienda por razones operativas, legales o comerciales. Los cambios se publicarán en la aplicación con la nueva versión y fecha y, si son relevantes, se solicitará de nuevo la aceptación.`,
        'Si el Programa finalizara, se avisará con antelación razonable (como mínimo 30 días) en la aplicación y en el local, para que los usuarios puedan canjear los premios ya desbloqueados.',
        'Los puntos no tienen caducidad por el mero paso del tiempo mientras la cuenta esté activa, salvo que se comunique lo contrario con el aviso anterior.',
      ],
    },
    {
      heading: '9. Datos personales',
      paragraphs: [
        'El tratamiento de datos se rige por la Política de privacidad. Las comunicaciones comerciales solo se envían a quien marque la casilla opcional correspondiente, y se puede retirar el consentimiento en cualquier momento desde el perfil.',
      ],
    },
    {
      heading: '10. Responsabilidad y reclamaciones',
      paragraphs: [
        `${company.tradeName} no responde de fallos de conectividad, del dispositivo del usuario ni de interrupciones del servicio ajenas a su control, sin perjuicio de los derechos que la ley reconoce a los consumidores. Las reclamaciones pueden dirigirse a ${company.contactEmail} o en el propio local.`,
      ],
    },
    {
      heading: '11. Ley aplicable y jurisdicción',
      paragraphs: [
        'Estas bases se rigen por la legislación española. Para cualquier controversia, y salvo fuero imperativo del consumidor, serán competentes los juzgados y tribunales de Valencia.',
      ],
    },
  ],
}
