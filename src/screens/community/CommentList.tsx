import { useState } from 'react'
import { Card } from '@/components/Card'
import {
  usePlaceComments,
  useReportComment,
  useToggleCommentLike,
  type PlaceComment,
} from '@/features/community/communityApi'
import { copy } from '@/copy'
import { LikeButton } from './LikeButton'

function CommentRow({ comment }: { comment: PlaceComment }) {
  const like = useToggleCommentLike()
  const report = useReportComment()
  const [reported, setReported] = useState(false)
  const gained = like.data?.points ?? 0

  return (
    <li className="flex flex-col gap-1 py-3">
      <p className="text-muted text-xs font-bold">{comment.alias}</p>
      <p>{comment.body}</p>
      <div className="flex items-center justify-between">
        <LikeButton
          liked={comment.liked}
          count={comment.likes}
          disabled={comment.mine || like.isPending}
          onToggle={() => like.mutate(comment.id)}
        />
        <div className="flex items-center gap-3">
          {gained > 0 && (
            <span role="status" className="text-green-ink text-sm font-bold">
              {copy.community.pointsGained(gained)}
            </span>
          )}
          {!comment.mine &&
            (reported ? (
              <span role="status" className="text-muted text-xs">
                {copy.community.reported}
              </span>
            ) : (
              <button
                type="button"
                className="text-muted min-h-11 px-2 text-xs underline"
                onClick={() => report.mutate(comment.id, { onSuccess: () => setReported(true) })}
              >
                {copy.community.report}
              </button>
            ))}
        </div>
      </div>
    </li>
  )
}

export function CommentList({ placeId }: { placeId: string }) {
  const comments = usePlaceComments(placeId)
  if (!comments.data) return null
  return comments.data.length === 0 ? (
    <p className="text-muted">{copy.community.noComments}</p>
  ) : (
    <Card className="py-1">
      <ul className="divide-track divide-y">
        {comments.data.map((comment) => (
          <CommentRow key={comment.id} comment={comment} />
        ))}
      </ul>
    </Card>
  )
}
