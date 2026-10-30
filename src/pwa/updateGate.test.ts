import {
  applyNow,
  getUpdateState,
  holdUpdates,
  isBusyPath,
  resetUpdateGate,
  setApplyUpdate,
  updateAvailable,
} from './updateGate'

describe('actualización de la app', () => {
  beforeEach(() => resetUpdateGate())

  it('aplica enseguida la versión nueva si no hay nada en pantalla', () => {
    const apply = vi.fn()
    setApplyUpdate(apply)
    updateAvailable()
    expect(apply).toHaveBeenCalledTimes(1)
    expect(getUpdateState().pending).toBe(false)
  })

  it('con un juego en pantalla espera, avisa, y aplica apenas se sale', () => {
    const apply = vi.fn()
    setApplyUpdate(apply)
    const release = holdUpdates()
    updateAvailable()
    expect(apply).not.toHaveBeenCalled()
    expect(getUpdateState()).toEqual({ pending: true, busy: true })
    release()
    expect(apply).toHaveBeenCalledTimes(1)
    expect(getUpdateState()).toEqual({ pending: false, busy: false })
  })

  it('espera a que terminen todos los juegos abiertos y soltar dos veces no desbalancea', () => {
    const apply = vi.fn()
    setApplyUpdate(apply)
    const a = holdUpdates()
    const b = holdUpdates()
    updateAvailable()
    a()
    a()
    expect(apply).not.toHaveBeenCalled()
    b()
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('el botón Actualizar aplica aunque haya un juego, una sola vez', () => {
    const apply = vi.fn()
    setApplyUpdate(apply)
    holdUpdates()
    updateAvailable()
    applyNow()
    applyNow()
    expect(apply).toHaveBeenCalledTimes(1)
  })

  it('reconoce las rutas que no se deben interrumpir', () => {
    expect(isBusyPath('/escanear')).toBe(true)
    expect(isBusyPath('/raspadita/abc')).toBe(true)
    expect(isBusyPath('/panel')).toBe(false)
    expect(isBusyPath('/cofres-nada')).toBe(false)
  })
})
