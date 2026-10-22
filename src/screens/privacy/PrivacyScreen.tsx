import { Link } from 'react-router'
import { Screen } from '@/components/Screen'
import { copy } from '@/copy'

export function PrivacyScreen() {
  return (
    <Screen className="gap-4">
      <h1 className="font-display text-5xl">{copy.privacy.title}</h1>
      {copy.privacy.body.map((paragraph) => (
        <p key={paragraph} className="text-muted">
          {paragraph}
        </p>
      ))}
      <Link to="/" className="mt-auto underline">
        {copy.privacy.back}
      </Link>
    </Screen>
  )
}
