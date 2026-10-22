import { Link } from 'react-router'
import { Screen } from '@/components/Screen'
import { useProfile } from '@/features/profile/useProfile'
import { copy } from '@/copy'

/** Provisorio de la Fase 3; el panel real llega en la Fase 5. */
export function PanelScreen() {
  const profile = useProfile()
  return (
    <Screen className="gap-4">
      <h1 className="font-display text-5xl">
        {copy.panel.hello(profile.data?.display_name ?? '')}
      </h1>
      <Link to="/perfil" className="underline">
        {copy.profile.title}
      </Link>
    </Screen>
  )
}
