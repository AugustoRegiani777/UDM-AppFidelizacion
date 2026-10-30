import { isIdentityConflict, parseAuthRedirectError } from './linkErrors'

describe('vuelta de Google con error', () => {
  it('lee el error del hash o de la query', () => {
    const hash =
      '#error=server_error&error_code=identity_already_exists&error_description=Identity+is+already+linked+to+another+user'
    expect(parseAuthRedirectError('', hash)).toEqual({
      code: 'identity_already_exists',
      description: 'Identity is already linked to another user',
    })
    expect(parseAuthRedirectError('?error=access_denied&error_description=cancelled', '')).toEqual({
      code: 'access_denied',
      description: 'cancelled',
    })
  })

  it('sin error devuelve null', () => {
    expect(parseAuthRedirectError('?x=1', '#access_token=abc')).toBeNull()
    expect(parseAuthRedirectError('', '')).toBeNull()
  })

  it('reconoce el conflicto de una cuenta de Google que ya existe', () => {
    expect(isIdentityConflict({ code: 'identity_already_exists', description: '' })).toBe(true)
    expect(
      isIdentityConflict({ code: 'server_error', description: 'Identity is already linked' }),
    ).toBe(true)
    expect(isIdentityConflict({ code: 'access_denied', description: 'cancelled' })).toBe(false)
    expect(isIdentityConflict({ code: 'identity_already_exists', message: 'x' })).toBe(true)
  })
})
