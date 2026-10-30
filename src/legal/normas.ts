import { company } from './company'
import type { LegalDoc } from './types'

/** Normas de la comunidad (contenido de usuarios). PLANTILLA para revisión de la gestoría. */
export const normas: LegalDoc = {
  path: '/normas',
  shortTitle: 'Normas de la comunidad',
  title: 'Normas de la comunidad',
  intro: `La comunidad de ${company.tradeName} es un espacio para recomendar lugares de Valencia y charlar de buena onda. Estas normas se aplican a todo lo que los usuarios publiquen (lugares, comentarios, nombres visibles).`,
  sections: [
    {
      heading: '1. Qué se puede publicar',
      paragraphs: [
        'Recomendaciones sinceras de lugares (pizzerías, cafés, heladerías, panaderías y similares) y comentarios respetuosos basados en su propia experiencia. Cada usuario es responsable de lo que publica.',
      ],
    },
    {
      heading: '2. Qué no se permite',
      bullets: [
        'Contenido ilegal, que incite al odio, la violencia o la discriminación, o que sea acosador, amenazante, sexual o inadecuado.',
        'Insultos, ataques personales o contenido que dañe el honor, la intimidad o la propia imagen de terceros.',
        'Datos personales de otras personas (teléfonos, domicilios, fotografías) sin su consentimiento.',
        'Publicidad no solicitada, enlaces engañosos, spam, reseñas falsas o pagadas, o hacerse pasar por otra persona o por el local.',
        'Contenido que infrinja derechos de autor u otros derechos de terceros.',
        'Intentar manipular puntos, rankings o “me gusta” con cuentas múltiples o automatismos.',
      ],
    },
    {
      heading: '3. Moderación',
      paragraphs: [
        `Los lugares propuestos se revisan antes de publicarse y los comentarios pueden revisarse en cualquier momento. ${company.tradeName} puede ocultar, rechazar o eliminar contenido que incumpla estas normas o la ley, y suspender o cancelar la cuenta de quien las incumpla de forma grave o reiterada. Cuando sea posible se avisará a la persona afectada y podrá alegar por el correo de contacto. Los “me gusta” son anónimos para el resto de usuarios; el local puede ver quién ha publicado cada contenido para poder moderarlo.`,
      ],
    },
    {
      heading: '4. Cómo reportar contenido',
      bullets: [
        'Desde cada comentario, use la opción de denunciar: queda registrada y el equipo la revisa.',
        `También puede escribir a ${company.contactEmail} indicando qué contenido es y por qué lo considera inadecuado.`,
        'Si usted es titular de un derecho afectado (honor, datos personales, propiedad intelectual) puede pedir la retirada del contenido por ese mismo medio; lo atenderemos con la mayor diligencia posible.',
      ],
    },
    {
      heading: '5. Sus contenidos y sus datos',
      paragraphs: [
        'Puede pedir que se borre un contenido suyo, o borrar su cuenta desde “Tu perfil”, lo que elimina también lo que publicó. Al publicar, usted otorga al local una licencia limitada para mostrarlo en la aplicación, según el Aviso legal. El tratamiento de sus datos se rige por la Política de privacidad.',
      ],
    },
    {
      heading: '6. Cambios',
      paragraphs: [
        'Estas normas pueden actualizarse; la versión y fecha figuran en la página. Si el cambio es relevante, se pedirá de nuevo la aceptación.',
      ],
    },
  ],
}
