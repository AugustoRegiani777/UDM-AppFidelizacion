import { company, companyValue } from './company'
import type { LegalDoc } from './types'

/**
 * Aviso legal (LSSI-CE, art. 10). PLANTILLA para revisión de la gestoría.
 * Los datos del titular se leen de company.ts.
 */
export const avisoLegal: LegalDoc = {
  path: '/aviso-legal',
  shortTitle: 'Aviso legal',
  title: 'Aviso legal',
  intro: `En cumplimiento del artículo 10 de la Ley 34/2002, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE), se facilitan los datos identificativos del titular de este sitio web y aplicación (${company.website}).`,
  sections: [
    {
      heading: '1. Datos del titular',
      bullets: [
        `Titular: ${company.legalName}`,
        `Nombre comercial: ${company.tradeName}`,
        `NIF/CIF: ${company.taxId}`,
        `Domicilio: ${company.registeredAddress}`,
        `Establecimiento abierto al público: ${company.storeAddress}`,
        `Correo electrónico de contacto: ${company.contactEmail}`,
        ...(companyValue(company.contactPhone) ? [`Teléfono: ${company.contactPhone}`] : []),
        ...(companyValue(company.commercialRegistry)
          ? [`Datos registrales: ${company.commercialRegistry}`]
          : []),
      ],
    },
    {
      heading: '2. Objeto del sitio web',
      paragraphs: [
        `Esta aplicación web (PWA) es el programa de fidelización de ${company.tradeName}, sandwichería artesanal situada en Valencia. Permite a los clientes mayores de 18 años identificarse con su cuenta de Google, sumar puntos por sus compras realizadas en el local, consultar y canjear premios en caja, participar en minijuegos de habilidad y en la comunidad de recomendaciones.`,
        'El acceso y uso de la aplicación es gratuito. La compra de productos se realiza exclusivamente en el establecimiento físico; la aplicación no es una tienda online ni permite pagos.',
      ],
    },
    {
      heading: '3. Condiciones de uso',
      paragraphs: [
        'El acceso a la aplicación atribuye la condición de usuario e implica la aceptación de este Aviso legal, de la Política de privacidad, de la Política de cookies, de las Bases del programa y de las Normas de la comunidad. El usuario se compromete a hacer un uso adecuado de la aplicación, conforme a la ley, a la buena fe y al orden público, y a no emplearla para fines ilícitos ni lesivos de derechos de terceros.',
        'Está prohibido manipular, automatizar o alterar el funcionamiento de la aplicación, acceder a datos de otros usuarios, utilizar cuentas ajenas o intentar obtener puntos, premios o ventajas de forma fraudulenta.',
      ],
    },
    {
      heading: '4. Propiedad intelectual e industrial',
      paragraphs: [
        `Los textos, diseños, ilustraciones, mascota, logotipos, marcas, código fuente y demás contenidos de la aplicación son titularidad de ${company.legalName} o se utilizan con la debida autorización, y están protegidos por la normativa de propiedad intelectual e industrial. Queda prohibida su reproducción, distribución o transformación sin autorización expresa, salvo lo permitido por la ley.`,
        'Los contenidos que los usuarios publiquen en la comunidad siguen siendo suyos; al publicarlos conceden al titular una licencia gratuita, no exclusiva y limitada a mostrarlos dentro de la aplicación mientras estén publicados.',
      ],
    },
    {
      heading: '5. Responsabilidad',
      paragraphs: [
        'El titular procura que la información de la aplicación sea correcta y que el servicio esté disponible, pero no garantiza la ausencia de errores ni la disponibilidad ininterrumpida (por mantenimiento, fallos técnicos o causas ajenas a su control). Podrá modificar, suspender o retirar contenidos o funcionalidades cuando sea necesario.',
        'La aplicación puede contener enlaces a sitios de terceros (por ejemplo, Google Maps o Instagram). El titular no controla ni se responsabiliza de sus contenidos ni de sus políticas.',
        'Nada de lo dispuesto en este aviso limita los derechos que la normativa de consumidores y usuarios reconoce a los consumidores.',
      ],
    },
    {
      heading: '6. Protección de datos',
      paragraphs: [
        'El tratamiento de los datos personales se describe en la Política de privacidad. El uso de almacenamiento local en el dispositivo se describe en la Política de cookies.',
      ],
    },
    {
      heading: '7. Resolución de conflictos y legislación aplicable',
      paragraphs: [
        'Este aviso y el uso de la aplicación se rigen por la legislación española. Para cualquier controversia, y salvo que la normativa de consumidores establezca otro fuero imperativo, las partes se someten a los juzgados y tribunales de la ciudad de Valencia.',
        'Los consumidores residentes en la Unión Europea pueden acudir además a la plataforma europea de resolución de litigios en línea: https://ec.europa.eu/consumers/odr. También pueden dirigirse al titular por el correo de contacto indicado arriba.',
      ],
    },
  ],
}
