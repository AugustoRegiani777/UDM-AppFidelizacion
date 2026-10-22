import { clearPendingSale, isSaleUuid, readPendingSale, savePendingSale } from './pendingSale'

const UUID = '3f2b8c1e-5d4a-4b7e-9a10-1c2d3e4f5a6b'

describe('pendingSale', () => {
  beforeEach(() => localStorage.clear())

  it('valida uuids', () => {
    expect(isSaleUuid(UUID)).toBe(true)
    expect(isSaleUuid('hola')).toBe(false)
    expect(isSaleUuid(undefined)).toBe(false)
  })

  it('guarda, lee y limpia', () => {
    savePendingSale(UUID)
    expect(readPendingSale()).toBe(UUID)
    clearPendingSale()
    expect(readPendingSale()).toBeNull()
  })

  it('ignora valores corruptos', () => {
    localStorage.setItem('pending_sale_uuid', '<script>')
    expect(readPendingSale()).toBeNull()
  })
})
