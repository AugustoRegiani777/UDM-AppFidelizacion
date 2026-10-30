import { Link } from 'react-router'
import { LegalFooter } from '@/components/LegalFooter'
import { Screen } from '@/components/Screen'
import { legalCopy } from '@/copy/legal'
import { LEGAL_UPDATED_AT, LEGAL_VERSION, type LegalDoc } from '@/legal'
import { pendingCompanyFields } from '@/legal/company'

/** "2026-11-01" -> "1 de noviembre de 2026" */
function formatDate(iso: string) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  )
}

/** Página pública de un texto legal: título, versión, fecha y secciones. */
export function LegalPage({ doc }: { doc: LegalDoc }) {
  const draft = pendingCompanyFields().length > 0
  return (
    <Screen className="gap-5">
      <Link to="/" className="underline">
        {legalCopy.page.back}
      </Link>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-5xl leading-none">{doc.title}</h1>
        <p className="text-muted text-sm">
          {legalCopy.page.versionLabel(LEGAL_VERSION)} ·{' '}
          {legalCopy.page.updatedLabel(formatDate(LEGAL_UPDATED_AT))}
        </p>
      </header>
      {draft && (
        <p role="note" className="bg-brand-soft text-brand-ink rounded-chip px-4 py-3 text-sm">
          {legalCopy.page.draftNotice}
        </p>
      )}
      <p className="text-muted">{doc.intro}</p>
      {doc.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          <h2 className="font-display text-2xl">{section.heading}</h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph} className="text-muted text-sm leading-relaxed">
              {paragraph}
            </p>
          ))}
          {section.bullets && (
            <ul className="text-muted flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <LegalFooter />
    </Screen>
  )
}
