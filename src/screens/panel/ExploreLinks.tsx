import { Link } from 'react-router'
import { Card } from '@/components/Card'
import { copy } from '@/copy'

function LinkCard({ to, title, cta }: { to: string; title: string; cta: string }) {
  return (
    <Link to={to}>
      <Card className="flex items-center justify-between">
        <span className="font-bold">{title}</span>
        <span className="text-brand-ink font-semibold">{cta}</span>
      </Card>
    </Link>
  )
}

/** Más formas de sumar puntos: misiones y comunidad. */
export function ExploreLinks() {
  return (
    <section className="flex flex-col gap-3">
      <LinkCard to="/misiones" title={copy.missions.section} cta={copy.missions.sectionCta} />
      <LinkCard to="/juegos" title={copy.arcade.section} cta={copy.arcade.sectionCta} />
      <LinkCard to="/comunidad" title={copy.community.section} cta={copy.community.sectionCta} />
    </section>
  )
}
