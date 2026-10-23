import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'
import { CATEGORIES, usePlaces, type PlaceCategory } from '@/features/community/communityApi'
import { Cascade, CascadeItem } from '@/motion/Cascade'
import { copy } from '@/copy'
import { AddPlaceSheet } from './AddPlaceSheet'
import { PlaceCard } from './PlaceCard'

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-bold ${active ? 'bg-ink text-bg' : 'bg-surface text-ink'}`}
    >
      {children}
    </button>
  )
}

/** Recomendaciones de Valencia: lugares aprobados, filtrables por categoría. */
export function CommunityScreen() {
  const [category, setCategory] = useState<PlaceCategory | null>(null)
  const [adding, setAdding] = useState(false)
  const places = usePlaces(category)

  return (
    <Screen className="gap-4">
      <Link to="/panel" className="min-h-12 content-center underline">
        {copy.community.backToPanel}
      </Link>
      <h1 className="font-display text-5xl leading-none">{copy.community.title}</h1>
      <p className="text-muted">{copy.community.subtitle}</p>

      <div
        className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1"
        role="group"
        aria-label="Categorías"
      >
        <Chip active={category === null} onClick={() => setCategory(null)}>
          {copy.community.all}
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
            {copy.community.categories[c]}
          </Chip>
        ))}
      </div>

      <Button onClick={() => setAdding(true)}>{copy.community.add}</Button>

      {places.data?.length === 0 && <p className="text-muted">{copy.community.empty}</p>}
      <Cascade key={category ?? 'all'} className="flex flex-col gap-3">
        {places.data?.map((place) => (
          <CascadeItem key={place.id}>
            <PlaceCard place={place} />
          </CascadeItem>
        ))}
      </Cascade>
      <p className="text-muted text-center text-xs">{copy.community.anonymous}</p>

      <AddPlaceSheet open={adding} onClose={() => setAdding(false)} />
    </Screen>
  )
}
