/** Textos de la interfaz relacionados con lo legal (casillas, pie, perfil). Los textos legales largos están en src/legal. */
export const legalCopy = {
  footer: {
    label: 'Información legal',
    links: {
      '/aviso-legal': 'Aviso legal',
      '/privacidad': 'Privacidad',
      '/cookies': 'Cookies',
      '/bases': 'Bases del programa',
      '/normas': 'Normas de la comunidad',
    },
  },
  page: {
    versionLabel: (version: string) => `Versión ${version}`,
    updatedLabel: (date: string) => `Última actualización: ${date}`,
    back: 'Volver',
    draftNotice:
      'Borrador: faltan datos del titular por completar antes del lanzamiento (ver src/legal/company.ts).',
  },
  consent: {
    adult: 'Confirmo que tengo 18 años o más.',
    privacyPrefix: 'He leído y acepto la',
    privacyLink: 'Política de privacidad',
    termsPrefix: 'Acepto las',
    termsLink1: 'Bases del programa',
    termsAnd: 'y las',
    termsLink2: 'Normas de la comunidad',
    promo: 'Quiero recibir novedades y promos de Uno de Miga por email (opcional).',
    missingTitle: 'Para continuar necesitamos que marques:',
    missingAdult: 'que tenés 18 años o más',
    missingPrivacy: 'que leíste y aceptás la Política de privacidad',
    missingTerms: 'que aceptás las Bases del programa y las Normas de la comunidad',
    optionalNote:
      'La casilla de novedades es opcional y la podés cambiar cuando quieras desde tu perfil.',
    updateTitle: 'Actualizamos nuestros textos legales',
    updateBody:
      'Para seguir usando la app, volvé a confirmar las casillas. No perdés ningún punto ni dato.',
    updateSubmit: 'Aceptar y continuar',
  },
  profile: {
    dataTitle: 'Tus datos',
    dataBody:
      'Podés descargar una copia de todo lo que guardamos de vos (perfil, compras, puntos, canjes, partidas, tienda y comunidad) en un archivo.',
    download: 'Descargar mis datos',
    downloading: 'Preparando…',
    downloadError: 'Uy, no pudimos preparar la descarga. Probá de nuevo.',
    downloaded: 'Listo, se descargó tu archivo.',
    contact: (email: string) =>
      `Para otros derechos (oposición, limitación) o dudas sobre tus datos, escribinos a ${email}.`,
    promoHelp:
      'Podés retirar el permiso de novedades y promos en cualquier momento desmarcando la casilla y guardando.',
    deleteBody:
      'Se borran para siempre tu cuenta, tus puntos y premios, tus partidas, tus pedidos de la tienda y lo que publicaste en la comunidad. No se puede deshacer.',
    deleteKept:
      'Lo que se conserva: los tickets y registros de ventas del local (caja) que la ley obliga a guardar, que no quedan vinculados a tu cuenta, y las copias de seguridad del proveedor, que se sobrescriben solas con el tiempo y no se usan para restaurar cuentas borradas.',
    deleteAsk: '¿Seguro que querés borrar tu cuenta?',
  },
} as const
