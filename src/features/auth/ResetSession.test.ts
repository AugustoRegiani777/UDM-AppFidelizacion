import { isDeadSessionError } from './sessionErrors'

describe('sesión que ya no sirve', () => {
  it('reconoce que el usuario ya no existe o que el token no vale', () => {
    expect(isDeadSessionError({ status: 403, code: 'user_not_found' })).toBe(true)
    expect(isDeadSessionError({ status: 401 })).toBe(true)
    // El perfil no existe (single() sin filas): también es una sesión de un usuario borrado.
    expect(isDeadSessionError({ code: 'PGRST116' })).toBe(true)
  })

  it('no confunde un error de red o del servidor con una sesión muerta', () => {
    expect(isDeadSessionError(null)).toBe(false)
    expect(isDeadSessionError({ status: 500 })).toBe(false)
    expect(isDeadSessionError({ code: 'fetch_failed' })).toBe(false)
  })
})
