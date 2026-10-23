import { Link } from 'react-router'
import { FullScreenLoader } from '@/components/FullScreenLoader'
import { Screen } from '@/components/Screen'
import {
  useMissionsConfig,
  useMyMissionClaims,
  type MissionId,
} from '@/features/missions/missionsApi'
import { Cascade, CascadeItem } from '@/motion/Cascade'
import { copy } from '@/copy'
import { MissionCard } from './MissionCard'

const ORDER: MissionId[] = ['instagram_follow', 'google_review']

export function MissionsScreen() {
  const config = useMissionsConfig()
  const claims = useMyMissionClaims()

  if (config.isPending || claims.isPending) return <FullScreenLoader />
  if (config.isError) throw config.error
  if (claims.isError) throw claims.error

  return (
    <Screen className="gap-4">
      <Link to="/panel" className="min-h-12 content-center underline">
        {copy.missions.back}
      </Link>
      <h1 className="font-display text-5xl leading-none">{copy.missions.title}</h1>
      <p className="text-muted">{copy.missions.subtitle}</p>
      <Cascade className="flex flex-col gap-3">
        {ORDER.filter((id) => config.data[id]).map((id) => (
          <CascadeItem key={id}>
            <MissionCard
              id={id}
              config={config.data[id]}
              claim={claims.data.find((claim) => claim.mission === id)}
            />
          </CascadeItem>
        ))}
      </Cascade>
    </Screen>
  )
}
