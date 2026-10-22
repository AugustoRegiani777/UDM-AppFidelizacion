import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { ScannerScreen } from './ScannerScreen'

const UUID = '3f2b8c1e-5d4a-4b7e-9a10-1c2d3e4f5a6b'

function renderScanner() {
  render(
    <MemoryRouter initialEntries={['/escanear']}>
      <Routes>
        <Route path="/escanear" element={<ScannerScreen />} />
        <Route path="/s/:uuid" element={<p>COMPRA</p>} />
        <Route path="/panel" element={<p>PANEL</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

function mockCamera(getUserMedia: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
}

describe('ScannerScreen', () => {
  it('explica para qué se pide la cámara antes de pedirla', () => {
    mockCamera(vi.fn())
    renderScanner()
    expect(screen.getByText('Vamos a usar tu cámara')).toBeInTheDocument()
    expect(screen.getByText(/no sacamos ni guardamos fotos/i)).toBeInTheDocument()
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled()
  })

  it('si se niega el permiso, muestra cómo habilitarlo y deja escribir el código', async () => {
    mockCamera(() => Promise.reject(new DOMException('no', 'NotAllowedError')))
    renderScanner()

    await userEvent.click(screen.getByRole('button', { name: 'Activar cámara' }))

    expect(await screen.findByText('La cámara está bloqueada')).toBeInTheDocument()
    expect(screen.getByText(/iphone: tocá "aa"/i)).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/link o código/i), `https://miga.app/s/${UUID}`)
    await userEvent.click(screen.getByRole('button', { name: 'Sumar esta compra' }))
    await waitFor(() => expect(screen.getByText('COMPRA')).toBeInTheDocument())
  })

  it('rechaza con amabilidad un código que no es una compra', async () => {
    mockCamera(() => Promise.reject(new DOMException('no', 'NotAllowedError')))
    renderScanner()
    await userEvent.click(screen.getByRole('button', { name: 'Activar cámara' }))
    await screen.findByText('La cámara está bloqueada')

    await userEvent.type(screen.getByLabelText(/link o código/i), 'hola')
    await userEvent.click(screen.getByRole('button', { name: 'Sumar esta compra' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/no reconocemos ese código/i)
  })
})
