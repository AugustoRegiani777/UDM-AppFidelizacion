import { parseSaleCode } from './parseSaleCode'

const UUID = '3f2b8c1e-5d4a-4b7e-9a10-1c2d3e4f5a6b'

describe('parseSaleCode', () => {
  it.each([
    [`https://miga.app/s/${UUID}`, UUID],
    [`http://192.168.1.20:5173/s/${UUID}?x=1`, UUID],
    [`  https://miga.app/s/${UUID.toUpperCase()}  `, UUID],
    [UUID, UUID],
  ])('lee %s', (input, expected) => {
    expect(parseSaleCode(input)).toBe(expected)
  })

  it.each([
    '',
    'hola',
    'https://miga.app/',
    'https://miga.app/s/123',
    `https://miga.app/x/${UUID}`,
  ])('ignora %j', (input) => {
    expect(parseSaleCode(input)).toBeNull()
  })
})
