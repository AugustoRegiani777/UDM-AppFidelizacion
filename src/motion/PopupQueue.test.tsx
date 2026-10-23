import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { PopupQueueProvider } from './PopupQueue'
import { usePopups } from './usePopups'

function Trigger({ ids, spontaneous = false }: { ids: string[]; spontaneous?: boolean }) {
  const { show } = usePopups()
  useEffect(() => {
    ids.forEach((id) => show({ id, spontaneous, render: () => <p>Popup {id}</p> }))
  }, [ids, spontaneous, show])
  return null
}

const IDS = ['a', 'b']

describe('PopupQueue', () => {
  it('muestra de a uno: el segundo aparece cuando se cierra el primero', async () => {
    render(
      <PopupQueueProvider>
        <Trigger ids={IDS} />
      </PopupQueueProvider>,
    )
    expect(await screen.findByText('Popup a')).toBeInTheDocument()
    expect(screen.queryByText('Popup b')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    expect(await screen.findByText('Popup b', {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it('se cierra tocando afuera y con Escape', async () => {
    render(
      <PopupQueueProvider>
        <Trigger ids={['solo']} />
      </PopupQueueProvider>,
    )
    expect(await screen.findByText('Popup solo')).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await vi.waitFor(() => expect(screen.queryByText('Popup solo')).not.toBeInTheDocument())
  })

  it('permite como máximo un popup espontáneo por sesión', async () => {
    render(
      <PopupQueueProvider>
        <Trigger ids={IDS} spontaneous />
      </PopupQueueProvider>,
    )
    expect(await screen.findByText('Popup a')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar' }))
    await vi.waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByText('Popup b')).not.toBeInTheDocument()
  })
})
