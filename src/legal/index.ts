import { avisoLegal } from './avisoLegal'
import { bases } from './bases'
import { cookies } from './cookies'
import { normas } from './normas'
import { privacidad } from './privacidad'
import type { LegalDoc } from './types'

export { company, LEGAL_UPDATED_AT, LEGAL_VERSION } from './company'
export type { LegalDoc, LegalSection } from './types'
export { avisoLegal, bases, cookies, normas, privacidad }

/** Orden en el que aparecen en el pie de página. */
export const legalDocs: LegalDoc[] = [avisoLegal, privacidad, cookies, bases, normas]
