import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { Screen } from '@/components/Screen'
import { usePointHistory, type PointMovement } from '@/features/points/usePointHistory'
import { copy } from '@/copy'

const dateFormat = new Intl.DateTimeFormat('es-AR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function MovementRow({ movement }: { movement: PointMovement }) {
  const positive = movement.points > 0
  return (
    <li className="flex items-center justify-between py-3">
      <div>
        <p className="font-semibold">
          {copy.history.kinds[movement.kind] ?? copy.history.kindFallback}
        </p>
        <p className="text-muted text-sm">{dateFormat.format(new Date(movement.created_at))}</p>
      </div>
      <span
        className={positive ? 'text-green-ink text-lg font-bold' : 'text-muted text-lg font-bold'}
      >
        {positive ? `+${movement.points}` : movement.points}
      </span>
    </li>
  )
}

export function HistoryScreen() {
  const history = usePointHistory()
  if (history.isPending) return <FullScreenLoader />
  if (history.isError) throw history.error

  const movements = history.data.pages.flat()
  return (
    <Screen className="gap-4">
      <Link to="/panel" className="min-h-12 content-center underline">
        {copy.history.back}
      </Link>
      <h1 className="font-display text-5xl">{copy.history.title}</h1>
      {movements.length === 0 ? (
        <p className="text-muted">{copy.history.empty}</p>
      ) : (
        <Card className="py-2">
          <ul className="divide-track divide-y">
            {movements.map((movement) => (
              <MovementRow key={movement.id} movement={movement} />
            ))}
          </ul>
        </Card>
      )}
      {history.hasNextPage && (
        <Button
          variant="ghost"
          disabled={history.isFetchingNextPage}
          onClick={() => history.fetchNextPage()}
        >
          {copy.history.more}
        </Button>
      )}
    </Screen>
  )
}
