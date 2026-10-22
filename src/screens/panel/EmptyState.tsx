import { Card } from '@/components/Card'
import { copy } from '@/copy'

/** Cliente nuevo: invita a la primera compra en vez de mostrar un panel vacío. */
export function EmptyState() {
  return (
    <Card className="bg-brand-soft text-center shadow-none">
      <p className="font-display text-3xl">{copy.panel.emptyTitle}</p>
      <p className="text-muted mt-1">{copy.panel.emptyBody}</p>
    </Card>
  )
}
