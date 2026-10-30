import { isDeadSessionError } from './sessionErrors'

describe('sesión que ya no sirve', () => {
  it('reconoce que el usuario o la sesión ya no existen', () => {
    expect(isDeadSessionError({ status: 403, code: 'user_not_found' })).toBe(true)
    expect(isDeadSessionError({ code: 'session_not_found' })).toBe(true)
    expect(isDeadSessionError({ code: 'refresh_token_not_found' })).toBe(true)
    // El perfil no existe (single() sin filas): también es una sesión de un usuario borrado.
    expect(isDeadSessionError({ code: 'PGRST116' })).toBe(true)
  })

  it('no confunde un error de red, del servidor o un token vencido con una sesión muerta', () => {
    expect(isDeadSessionError(null)).toBe(false)
    expect(isDeadSessionError({ status: 500 })).toBe(false)
    expect(isDeadSessionError({ code: 'fetch_failed' })).toBe(false)
    // Un 401 suelto es un token vencido que se renueva solo: cerrar la sesión de un invitado por eso
    // le haría perder su cuenta.
    expect(isDeadSessionError({ status: 401 })).toBe(false)
    expect(isDeadSessionError({ status: 401, code: 'bad_jwt' })).toBe(false)
  })
})
