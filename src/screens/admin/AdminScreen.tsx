import { useQueryClient } from '@tanstack/react-query'
import { Link, Navigate } from 'react-router'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { Screen } from '@/components/Screen'
import {
  reviewMission,
  useIsAdmin,
  usePendingMissions,
  type PendingMission,
} from '@/features/admin/adminApi'
import { copy } from '@/copy'

function MissionRow({ item, onDone }: { item: PendingMission; onDone: () => void }) {
  async function decide(approve: boolean) {
    await reviewMission(item.id, approve)
    onDone()
  }
  const text = copy.missions.items[item.mission as keyof typeof copy.missions.items]
  return (
    <Card className="flex flex-col gap-2">
      <p className="font-bold">{item.display_name}</p>
      <p className="text-muted text-sm">{text?.title ?? item.mission}</p>
      {item.note && (
        <p className="text-sm">
          {copy.admin.noteLabel}: <strong>{item.note}</strong>
        </p>
      )}
      <div className="flex gap-2">
        <Button onClick={() => void decide(true)}>{copy.admin.approve}</Button>
        <Button variant="ghost" onClick={() => void decide(false)}>
          {copy.admin.reject}
        </Button>
      </div>
    </Card>
  )
}

/** Panel de administración (solo admins). El servidor vuelve a chequear el rol en cada acción. */
export function AdminScreen() {
  const isAdmin = useIsAdmin()
  const queryClient = useQueryClient()
  const pending = usePendingMissions(isAdmin.data === true)

  if (isAdmin.isPending) return <FullScreenLoader />
  if (!isAdmin.data) return <Navigate to="/panel" replace />

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-pending-missions'] })

  return (
    <Screen className="gap-4">
      <Link to="/panel" className="min-h-12 content-center underline">
        {copy.admin.back}
      </Link>
      <h1 className="font-display text-5xl leading-none">{copy.admin.title}</h1>
      <section aria-labelledby="missions-review" className="flex flex-col gap-3">
        <h2 id="missions-review" className="font-display text-3xl">
          {copy.admin.missionsTitle}
        </h2>
        {pending.data?.length === 0 && <p className="text-muted">{copy.admin.nothingPending}</p>}
        {pending.data?.map((item) => (
          <MissionRow key={item.id} item={item} onDone={() => void refresh()} />
        ))}
      </section>
    </Screen>
  )
}
