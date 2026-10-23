import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'
import {
  errorCode,
  useAddComment,
  usePlaces,
  useTogglePlaceLike,
} from '@/features/community/communityApi'
import { copy } from '@/copy'
import { CommentList } from './CommentList'
import { LikeButton } from './LikeButton'

/** Detalle de un lugar: datos, like anónimo y comentarios. */
export function PlaceScreen() {
  const { id = '' } = useParams()
  const places = usePlaces(null)
  const like = useTogglePlaceLike()
  const addComment = useAddComment(id)
  const [text, setText] = useState('')
  const place = places.data?.find((p) => p.id === id)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    addComment.mutate(text, { onSuccess: () => setText('') })
  }

  const error = addComment.isError
    ? (copy.community.errors[errorCode(addComment.error)] ?? copy.community.errorFallback)
    : null

  return (
    <Screen className="gap-4">
      <Link to="/comunidad" className="min-h-12 content-center underline">
        {copy.community.back}
      </Link>
      {place && (
        <>
          <div>
            <span className="bg-brand-soft text-brand-ink rounded-full px-2.5 py-0.5 text-xs font-bold">
              {copy.community.categoryLong[place.category]}
            </span>
            <h1 className="font-display mt-2 text-5xl leading-none">{place.name}</h1>
            {place.address && <p className="text-muted mt-1">{place.address}</p>}
            {place.note && <p className="mt-2">{place.note}</p>}
          </div>
          <div className="flex items-center gap-3">
            <LikeButton
              liked={place.liked}
              count={place.likes}
              disabled={place.mine || like.isPending}
              onToggle={() => like.mutate(place.id)}
            />
            {place.maps_url && (
              <a
                href={place.maps_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand-ink font-bold underline"
              >
                {copy.community.openMaps}
              </a>
            )}
          </div>

          <section aria-labelledby="comments" className="flex flex-col gap-3">
            <h2 id="comments" className="font-display text-3xl">
              {copy.community.commentsTitle}
            </h2>
            <CommentList placeId={place.id} />
            <form onSubmit={handleSubmit} className="flex flex-col gap-2">
              <label className="sr-only" htmlFor="comment">
                {copy.community.commentPlaceholder}
              </label>
              <textarea
                id="comment"
                rows={3}
                maxLength={280}
                value={text}
                placeholder={copy.community.commentPlaceholder}
                onChange={(e) => setText(e.target.value)}
                className="bg-surface ring-track focus:ring-brand rounded-chip p-4 ring-2 outline-none"
              />
              {error && (
                <p role="alert" className="text-brand-ink text-sm">
                  {error}
                </p>
              )}
              {addComment.isSuccess && addComment.data.points > 0 && (
                <p role="status" className="text-green-ink text-sm font-bold">
                  {copy.community.pointsGained(addComment.data.points)}
                </p>
              )}
              <Button type="submit" disabled={addComment.isPending || text.trim().length < 2}>
                {copy.community.commentSend}
              </Button>
            </form>
            <p className="text-muted text-center text-xs">{copy.community.anonymous}</p>
          </section>
        </>
      )}
    </Screen>
  )
}
