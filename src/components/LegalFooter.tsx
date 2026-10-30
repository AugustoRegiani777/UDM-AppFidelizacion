import { Link } from 'react-router'
import { legalCopy } from '@/copy/legal'
import { legalDocs } from '@/legal'

/** Pie de página con los enlaces legales (LSSI/RGPD). Va en las pantallas públicas y en el perfil. */
export function LegalFooter({ className = '' }: { className?: string }) {
  return (
    <footer className={`mt-auto pt-6 text-center ${className}`}>
      <nav aria-label={legalCopy.footer.label}>
        <ul className="text-muted flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
          {legalDocs.map((doc) => (
            <li key={doc.path}>
              <Link to={doc.path} className="inline-block min-h-6 underline">
                {legalCopy.footer.links[doc.path]}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  )
}
