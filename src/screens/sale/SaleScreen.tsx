import { Screen } from '@/components/Screen'
import { copy } from '@/copy'

/** Provisorio de la Fase 3: la compra ya sobrevive al login; el reclamo real llega en la Fase 4. */
export function SaleScreen() {
  return (
    <Screen className="justify-center gap-3">
      <h1 className="font-display text-5xl">{copy.sale.saving}</h1>
      <p className="text-muted">{copy.sale.savedBody}</p>
    </Screen>
  )
}
