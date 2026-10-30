import { avisoLegal, bases, cookies, normas } from '@/legal'
import { LegalPage } from './LegalPage'

export function AvisoLegalScreen() {
  return <LegalPage doc={avisoLegal} />
}

export function CookiesScreen() {
  return <LegalPage doc={cookies} />
}

export function BasesScreen() {
  return <LegalPage doc={bases} />
}

export function NormasScreen() {
  return <LegalPage doc={normas} />
}
