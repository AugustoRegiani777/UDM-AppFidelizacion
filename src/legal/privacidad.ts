import { company, companyValue } from './company'
import type { LegalDoc } from './types'

/**
 * Política de privacidad (RGPD y LOPDGDD). PLANTILLA para revisión de la gestoría.
 */
export const privacidad: LegalDoc = {
  path: '/privacidad',
  shortTitle: 'Privacidad',
  title: 'Política de privacidad',
  intro: `Esta política explica cómo ${company.tradeName} trata los datos personales de las personas que usan su aplicación de fidelización (${company.website}), conforme al Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica 3/2018 (LOPDGDD).`,
  sections: [
    {
      heading: '1. Responsable del tratamiento',
      bullets: [
        `Responsable: ${company.legalName}`,
        `Nombre comercial: ${company.tradeName}`,
        `NIF/CIF: ${company.taxId}`,
        `Domicilio: ${company.registeredAddress}`,
        `Correo electrónico para cuestiones de privacidad: ${company.contactEmail}`,
        ...(companyValue(company.dpo) ? [`Delegado de protección de datos: ${company.dpo}`] : []),
      ],
    },
    {
      heading: '2. Datos que tratamos',
      paragraphs: ['Solo tratamos los datos necesarios para el funcionamiento del programa:'],
      bullets: [
        'Datos de la cuenta de Google que usted autoriza al iniciar sesión: nombre, dirección de correo electrónico y foto de perfil. No recibimos su contraseña de Google.',
        'Datos del perfil: el nombre con el que desea que le llamemos, sus preferencias (por ejemplo, sonidos o aparecer en los rankings) y las confirmaciones y aceptaciones que otorga al registrarse (mayoría de edad, política de privacidad, bases y normas, comunicaciones comerciales), con su fecha y la versión de los textos aceptada.',
        'Compras vinculadas al programa: cuando usted escanea el código QR de un ticket, asociamos esa compra a su cuenta (importe, fecha y estado de la venta) para calcular sus puntos. No recibimos datos de su medio de pago.',
        'Puntos y canjes: libro de movimientos de puntos, premios desbloqueados, códigos de canje generados y su estado.',
        'Actividad en los juegos y la tienda del programa: partidas, puntuaciones, monedas virtuales, pases, mejoras y pedidos de la tienda.',
        'Contenido de la comunidad: lugares que recomiende, comentarios, “me gusta” y denuncias que realice.',
        'Datos técnicos mínimos de conexión (como la dirección IP) que los proveedores de alojamiento y de la base de datos registran de forma automática por seguridad y funcionamiento.',
      ],
    },
    {
      heading: '3. Finalidades y bases jurídicas',
      bullets: [
        'Gestionar su cuenta y el programa de fidelización: sumar puntos, desbloquear y canjear premios, juegos, tienda y comunidad. Base jurídica: ejecución del contrato o relación que se establece al aceptar las Bases del programa (art. 6.1.b RGPD).',
        'Dejar constancia de su mayoría de edad y de la aceptación de los textos legales. Base jurídica: cumplimiento de obligaciones legales y atención de reclamaciones (art. 6.1.c y 6.1.f RGPD).',
        'Enviarle comunicaciones comerciales y promociones del local por medios electrónicos. Base jurídica: su consentimiento (art. 6.1.a RGPD y art. 21 LSSI-CE), que es opcional, se otorga con una casilla desmarcada por defecto y puede retirar en cualquier momento desde su perfil.',
        'Prevenir el fraude, proteger la seguridad de la aplicación y de las cuentas, y detectar abusos (por ejemplo, intentos de sumar puntos de forma indebida). Base jurídica: interés legítimo del responsable (art. 6.1.f RGPD), ponderado de forma que no prevalezcan sus derechos.',
        'Moderar el contenido de la comunidad conforme a las Normas de la comunidad. Base jurídica: interés legítimo y ejecución del servicio.',
        'Atender sus solicitudes de derechos y consultas. Base jurídica: cumplimiento de obligaciones legales y ejecución del servicio.',
      ],
    },
    {
      heading: '4. Destinatarios y encargados del tratamiento',
      paragraphs: [
        'No vendemos sus datos ni los cedemos a terceros con fines propios. Solo acceden a ellos proveedores que actúan como encargados del tratamiento bajo contrato, o personas a las que la ley obliga a facilitarlos:',
      ],
      bullets: [
        'Supabase (base de datos y autenticación): los datos se alojan en la Unión Europea, en la región de Irlanda (AWS eu-west-1).',
        'Netlify, Inc. (alojamiento y distribución de la aplicación web).',
        'Google LLC / Google Ireland Limited (inicio de sesión con Google, y enlaces a Google Maps si usted los abre).',
        'Administraciones públicas, jueces y tribunales y fuerzas y cuerpos de seguridad, cuando exista una obligación legal.',
        'Otros usuarios solo ven lo que usted decide publicar en la comunidad y, si no se oculta, su nombre y puntuación en los rankings.',
      ],
    },
    {
      heading: '5. Transferencias internacionales',
      paragraphs: [
        'Los datos de la aplicación se almacenan en la UE. Algunos proveedores (Google, Netlify y Supabase) pertenecen a grupos con sede en Estados Unidos y podrían acceder a datos de forma puntual o tratar datos técnicos fuera del Espacio Económico Europeo. Estas transferencias se amparan en el Marco de Privacidad de Datos UE-EE. UU. (decisión de adecuación de la Comisión Europea) cuando el proveedor está certificado y, en su defecto, en las cláusulas contractuales tipo aprobadas por la Comisión Europea. Puede solicitar más información o una copia de las garantías en el correo indicado arriba.',
      ],
    },
    {
      heading: '6. Plazos de conservación',
      bullets: [
        'Datos de la cuenta, puntos, partidas y contenido de la comunidad: mientras mantenga su cuenta. Si la borra desde su perfil, se eliminan de la aplicación de forma inmediata.',
        'Copias de seguridad del proveedor: se sobrescriben en su ciclo ordinario y no se utilizan para restaurar cuentas borradas.',
        'Comunicaciones comerciales: hasta que retire su consentimiento.',
        'Tickets y registros de ventas del propio establecimiento (sistema de caja): se conservan el tiempo que exigen las obligaciones contables, mercantiles y tributarias, con independencia de su cuenta en la aplicación y sin vincularse a ella una vez borrada.',
        'Datos que deban conservarse bloqueados para atender posibles responsabilidades legales: durante los plazos de prescripción aplicables y después se suprimen.',
      ],
    },
    {
      heading: '7. Sus derechos y cómo ejercerlos',
      paragraphs: [
        'Usted puede ejercer en cualquier momento los derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad, así como retirar el consentimiento otorgado sin que ello afecte a la licitud del tratamiento previo.',
        'Dentro de la propia aplicación, en la pantalla “Tu perfil”, puede:',
      ],
      bullets: [
        'Descargar todos sus datos en un archivo JSON (acceso y portabilidad).',
        'Corregir su nombre (rectificación).',
        'Marcar o desmarcar la casilla de novedades y promociones (retirar el consentimiento).',
        'Borrar su cuenta y todos sus datos (supresión).',
        `Para el resto de solicitudes (oposición, limitación u otras consultas), escriba a ${company.contactEmail}, indicando el correo de su cuenta de Google. Podremos pedirle que acredite su identidad. Responderemos en el plazo máximo de un mes, prorrogable conforme a la ley.`,
      ],
    },
    {
      heading: '8. Reclamaciones ante la autoridad de control',
      paragraphs: [
        'Si considera que el tratamiento no se ajusta a la normativa, puede presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD), C/ Jorge Juan, 6, 28001 Madrid, www.aepd.es, sin perjuicio de que le agradeceremos que nos contacte antes para intentar resolverlo.',
      ],
    },
    {
      heading: '9. Menores de edad',
      paragraphs: [
        'La aplicación está dirigida exclusivamente a personas mayores de 18 años. Al registrarse, el usuario confirma que cumple este requisito. Si detectamos que una cuenta pertenece a un menor, la cancelaremos y eliminaremos sus datos. Si usted cree que un menor ha creado una cuenta, escríbanos para que la borremos.',
      ],
    },
    {
      heading: '10. Decisiones automatizadas y elaboración de perfiles',
      paragraphs: [
        'No tomamos decisiones basadas únicamente en tratamientos automatizados que le produzcan efectos jurídicos o le afecten significativamente, ni elaboramos perfiles de comportamiento o de marketing. Los puntos y premios se calculan con reglas objetivas y públicas (ver Bases del programa). Las medidas antifraude señalan casos para su revisión por una persona.',
      ],
    },
    {
      heading: '11. Seguridad',
      paragraphs: [
        'Aplicamos medidas técnicas y organizativas adecuadas: comunicaciones cifradas (HTTPS), control de acceso a nivel de fila en la base de datos para que cada cliente solo acceda a sus propios datos, cálculo de puntos y premios exclusivamente en el servidor, separación de entornos y secretos fuera del código. Ningún sistema es infalible; si se produjera una brecha de seguridad que afectase a sus derechos, se lo notificaremos y lo comunicaremos a la autoridad cuando proceda.',
      ],
    },
    {
      heading: '12. Cookies y almacenamiento local',
      paragraphs: [
        'La aplicación no utiliza cookies de analítica, publicidad ni seguimiento. Solo usa almacenamiento técnico necesario. Consulte la Política de cookies.',
      ],
    },
    {
      heading: '13. Cambios en esta política',
      paragraphs: [
        'Podemos actualizar esta política para reflejar cambios legales o del servicio. La versión y la fecha figuran al inicio de la página. Si el cambio es relevante, le pediremos que vuelva a aceptar los textos la próxima vez que entre a la aplicación.',
      ],
    },
  ],
}
