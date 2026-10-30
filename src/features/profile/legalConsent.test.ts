import { needsLegalAcceptance, type ConsentState } from './legalConsent'

const ok: ConsentState = {
  program_consent_at: '2026-11-01T10:00:00Z',
  adult_confirmed_at: '2026-11-01T10:00:00Z',
  privacy_accepted_at: '2026-11-01T10:00:00Z',
  terms_accepted_at: '2026-11-01T10:00:00Z',
  legal_version: '2026-11-01',
}

describe('needsLegalAcceptance', () => {
  it('no pide nada si está todo aceptado en la versión vigente', () => {
    expect(needsLegalAcceptance(ok, '2026-11-01')).toBe(false)
  })

  it('pide aceptar cuando la versión vigente es más nueva', () => {
    expect(needsLegalAcceptance(ok, '2026-11-02')).toBe(true)
    expect(needsLegalAcceptance(ok, '2027-01-01')).toBe(true)
  })

  it('pide aceptar si falta cualquiera de las fechas', () => {
    for (const key of Object.keys(ok) as (keyof ConsentState)[]) {
      expect(needsLegalAcceptance({ ...ok, [key]: null }, '2026-11-01')).toBe(true)
    }
  })
})
