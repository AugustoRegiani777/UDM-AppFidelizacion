import { Link } from 'react-router'
import { Card } from '@/components/Card'
import { copy } from '@/copy'

/** Acceso a las misiones de puntos extra. */
export function MissionsLink() {
  return (
    <Link to="/misiones">
      <Card className="flex items-center justify-between">
        <span className="font-bold">{copy.missions.section}</span>
        <span className="text-brand-ink font-semibold">{copy.missions.sectionCta}</span>
      </Card>
    </Link>
  )
}
