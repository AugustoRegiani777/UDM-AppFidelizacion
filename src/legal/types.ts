export interface LegalSection {
  heading: string
  paragraphs?: string[]
  bullets?: string[]
}

export interface LegalDoc {
  /** Ruta pública, en español. */
  path: '/aviso-legal' | '/privacidad' | '/cookies' | '/bases' | '/normas'
  /** Nombre corto para enlaces y pie de página. */
  shortTitle: string
  title: string
  intro: string
  sections: LegalSection[]
}
