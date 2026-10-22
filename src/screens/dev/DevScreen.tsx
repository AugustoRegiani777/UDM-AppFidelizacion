import { Link } from 'react-router'
import { Screen } from '@/components/Screen'
import { CashSimulator } from './CashSimulator'
import { TabletSimulator } from './TabletSimulator'

/** Herramientas de desarrollo. Esta ruta solo se registra cuando env.devTools es true. */
export function DevScreen() {
  return (
    <Screen className="gap-4">
      <Link to="/" className="underline">
        Inicio
      </Link>
      <h1 className="font-display text-5xl">Desarrollo</h1>
      <TabletSimulator />
      <CashSimulator />
    </Screen>
  )
}
