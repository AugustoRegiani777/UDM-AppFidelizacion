import { privacidad } from '@/legal'
import { LegalPage } from '@/screens/legal/LegalPage'

/** /privacidad: política de privacidad completa (el texto vive en src/legal/privacidad.ts). */
export function PrivacyScreen() {
  return <LegalPage doc={privacidad} />
}
