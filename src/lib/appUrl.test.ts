import { describe, expect, it } from 'vitest'
import { DEFAULT_APP_URL, normalizeAppUrl } from './appUrl'

describe('normalizeAppUrl', () => {
  it('usa el valor por defecto si la variable falta o está vacía', () => {
    expect(normalizeAppUrl(undefined)).toBe(DEFAULT_APP_URL)
    expect(normalizeAppUrl('  ')).toBe(DEFAULT_APP_URL)
  })

  it('saca la barra final', () => {
    expect(normalizeAppUrl('https://app.unodemigavalencia.com/')).toBe(
      'https://app.unodemigavalencia.com',
    )
  })
})
