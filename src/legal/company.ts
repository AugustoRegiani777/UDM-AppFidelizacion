/**
 * ÚNICO lugar con los datos del titular de la web y del responsable del tratamiento.
 * Las páginas legales (/aviso-legal, /privacidad, /cookies, /bases, /normas) leen todo de acá.
 *
 * Todo lo que diga 'PENDIENTE: ...' lo tiene que completar el dueño del local (con ayuda de la gestoría)
 * ANTES de lanzar la app al público. Ver docs/LEGAL-PENDIENTE.md.
 */

/** Marca de los datos que todavía no se conocen. Los tests y el aviso de la gestoría buscan este prefijo. */
export const PENDING_PREFIX = 'PENDIENTE'

export const company = {
  /** Nombre comercial (este sí es conocido). */
  tradeName: 'Uno de Miga',
  /** Razón social o nombre y apellidos del titular (autónomo/a o sociedad). */
  legalName: 'PENDIENTE: completar razón social o nombre y apellidos del titular',
  /** NIF o CIF del titular. */
  taxId: 'PENDIENTE: completar NIF/CIF',
  /** Domicilio social o fiscal completo del titular (LSSI art. 10). */
  registeredAddress: 'PENDIENTE: completar domicilio social o fiscal',
  /** Dirección del local (dato conocido). */
  storeAddress: 'Carrer Llop 1, Valencia (España)',
  /** Correo para consultas generales y para ejercer derechos de protección de datos. */
  contactEmail: 'PENDIENTE: completar email de contacto',
  /** Teléfono (opcional; dejar vacío si no se quiere publicar). */
  contactPhone: '',
  /** Datos del Registro Mercantil, solo si el titular es una sociedad inscrita; si no, dejar vacío. */
  commercialRegistry:
    'PENDIENTE: completar datos del Registro Mercantil (solo si es sociedad) o dejar vacío',
  /** Dirección web de la app. */
  website: 'https://udm-appfidelizacion.netlify.app',
  /** Delegado de protección de datos, solo si la gestoría indica que hace falta nombrarlo; si no, dejar vacío. */
  dpo: '',
} as const

/**
 * Versión vigente de los textos legales (AAAA-MM-DD). Se guarda con cada aceptación.
 * Si se cambia un texto de fondo, subir esta fecha Y la de settings.legal.version en la base de datos
 * (hay una migración nueva o un UPDATE en el panel de Supabase): así los clientes vuelven a aceptar.
 * Un test comprueba que coincide con la migración 20261031000001.
 */
export const LEGAL_VERSION = '2026-11-01'

/** Fecha de la última actualización de los textos (mostrada en cada página). */
export const LEGAL_UPDATED_AT = '2026-11-01'

/** Texto del dato, o undefined si está vacío (los campos opcionales no se muestran). */
export function companyValue(value: string): string | undefined {
  return value.trim() === '' ? undefined : value
}

export function isPending(value: string): boolean {
  return value.startsWith(PENDING_PREFIX)
}

/** Lista de los campos de `company` que siguen sin completar (para avisos y tests). */
export function pendingCompanyFields(): string[] {
  return Object.entries(company)
    .filter(([, value]) => isPending(value))
    .map(([key]) => key)
}
