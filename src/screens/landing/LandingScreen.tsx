import { Navigate } from 'react-router'
import { LegalFooter } from '@/components/LegalFooter'
import { Screen } from '@/components/Screen'
import { SignInOptions } from '@/features/auth/SignInOptions'
import { useAuth } from '@/features/auth/useAuth'
import { copy } from '@/copy'

/** Portada pública: punto de entrada del QR fijo y del sticker NFC del mostrador. */
export function LandingScreen() {
  const { session } = useAuth()
  if (session) return <Navigate to="/panel" replace />

  return (
    <Screen className="gap-10">
      <header className="pt-8">
        <p className="text-brand font-display text-2xl tracking-wide">{copy.brand}</p>
        <h1 className="font-display mt-2 text-[72px] leading-[0.9]">{copy.landing.title}</h1>
        <p className="text-muted mt-4 text-lg">{copy.landing.subtitle}</p>
      </header>

      <SignInOptions returnPath="/panel" />

      <section aria-labelledby="how">
        <h2 id="how" className="font-display text-3xl">
          {copy.landing.stepsTitle}
        </h2>
        <ol className="mt-4 flex flex-col gap-4">
          {copy.landing.steps.map((step, index) => (
            <li key={step.title} className="flex gap-4">
              <span className="font-display bg-brand grid size-10 shrink-0 place-items-center rounded-full text-xl text-white">
                {index + 1}
              </span>
              <div>
                <p className="font-bold">{step.title}</p>
                <p className="text-muted text-sm">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <LegalFooter />
    </Screen>
  )
}
