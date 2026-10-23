import { Link } from 'react-router'
import { Card } from '@/components/Card'
import { useTogglePlaceLike, type Place } from '@/features/community/communityApi'
import { copy } from '@/copy'
import { LikeButton } from './LikeButton'

export function PlaceCard({ place }: { place: Place }) {
  const like = useTogglePlaceLike()
  const gained = like.data?.points ?? 0

  return (
    <Card className="flex flex-col gap-2">
      <Link to={`/comunidad/${place.id}`} className="flex flex-col gap-1">
        <span className="bg-brand-soft text-brand-ink w-fit rounded-full px-2.5 py-0.5 text-xs font-bold">
          {copy.community.categoryLong[place.category]}
        </span>
        <h3 className="text-lg leading-tight font-bold">{place.name}</h3>
        {place.note && <p className="text-muted line-clamp-2 text-sm">{place.note}</p>}
      </Link>
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <LikeButton
            liked={place.liked}
            count={place.likes}
            disabled={place.mine || like.isPending}
            onToggle={() => like.mutate(place.id)}
          />
          <Link to={`/comunidad/${place.id}`} className="text-muted px-2 text-sm font-semibold">
            💬 {place.comments}
          </Link>
        </div>
        {gained > 0 && (
          <span role="status" className="text-green-ink text-sm font-bold">
            {copy.community.pointsGained(gained)}
          </span>
        )}
      </div>
    </Card>
  )
}
