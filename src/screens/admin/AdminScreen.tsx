import { Link, Navigate } from 'react-router'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { Screen } from '@/components/Screen'
import { useIsAdmin } from '@/features/admin/adminApi'
import { copy } from '@/copy'
import { CreatePlace, MissionsReview, PlacesReview, ReportedComments } from './AdminSections'

/** Panel de administración (solo admins). El servidor vuelve a chequear el rol en cada acción. */
export function AdminScreen() {
  const isAdmin = useIsAdmin()

  if (isAdmin.isPending) return <FullScreenLoader />
  if (!isAdmin.data) return <Navigate to="/panel" replace />

  return (
    <Screen className="gap-6">
      <Link to="/panel" className="min-h-12 content-center underline">
        {copy.admin.back}
      </Link>
      <h1 className="font-display text-5xl leading-none">{copy.admin.title}</h1>
      <MissionsReview />
      <PlacesReview />
      <ReportedComments />
      <CreatePlace />
    </Screen>
  )
}
