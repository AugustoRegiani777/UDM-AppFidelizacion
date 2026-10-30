import { readFileSync } from 'node:fs'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { legalDocs, LEGAL_VERSION } from '@/legal'
import { company, isPending, pendingCompanyFields } from '@/legal/company'
import { PrivacyScreen } from '@/screens/privacy/PrivacyScreen'
import { AvisoLegalScreen, BasesScreen, CookiesScreen, NormasScreen } from './LegalScreens'

const screens = {
  '/aviso-legal': AvisoLegalScreen,
  '/privacidad': PrivacyScreen,
  '/cookies': CookiesScreen,
  '/bases': BasesScreen,
  '/normas': NormasScreen,
} as const

describe('páginas legales', () => {
  it.each(legalDocs.map((doc) => [doc.path, doc] as const))(
    '%s renderiza título, versión, fecha y pie de página',
    (path, doc) => {
      const Screen = screens[path]
      render(
        <MemoryRouter>
          <Screen />
        </MemoryRouter>,
      )
      expect(screen.getByRole('heading', { level: 1, name: doc.title })).toBeInTheDocument()
      expect(screen.getByText(new RegExp(`Versión ${LEGAL_VERSION}`))).toBeInTheDocument()
      expect(screen.getByText(/última actualización: 1 de noviembre de 2026/i)).toBeInTheDocument()
      const footer = screen.getByRole('navigation', { name: /información legal/i })
      for (const other of legalDocs) {
        expect(footer.querySelector(`a[href="${other.path}"]`)).not.toBeNull()
      }
      expect(doc.sections.length).toBeGreaterThan(3)
    },
  )

  it('el aviso legal muestra titular, NIF, domicilio y contacto leídos de company.ts', () => {
    render(
      <MemoryRouter>
        <AvisoLegalScreen />
      </MemoryRouter>,
    )
    expect(screen.getByText(new RegExp(`Titular: ${company.legalName}`))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`NIF/CIF: ${company.taxId}`))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(company.storeAddress.split(',')[0]!))).toBeInTheDocument()
    expect(screen.getByText(new RegExp(`Correo electrónico de contacto`))).toBeInTheDocument()
  })

  it('la política de privacidad cubre lo que exige el RGPD', () => {
    render(
      <MemoryRouter>
        <PrivacyScreen />
      </MemoryRouter>,
    )
    for (const heading of [
      /responsable del tratamiento/i,
      /finalidades y bases jurídicas/i,
      /destinatarios/i,
      /transferencias internacionales/i,
      /plazos de conservación/i,
      /sus derechos/i,
      /reclamaciones/i,
      /menores de edad/i,
      /decisiones automatizadas/i,
      /seguridad/i,
    ]) {
      expect(screen.getByRole('heading', { level: 2, name: heading })).toBeInTheDocument()
    }
  })

  it('mientras falten datos del titular se avisa que es un borrador', () => {
    render(
      <MemoryRouter>
        <CookiesScreen />
      </MemoryRouter>,
    )
    const hasPending = pendingCompanyFields().length > 0
    expect(screen.queryByRole('note') !== null).toBe(hasPending)
  })

  it('los datos del titular salen de un único archivo y los pendientes están marcados', () => {
    expect(isPending(company.legalName)).toBe(true)
    expect(pendingCompanyFields()).toEqual(
      expect.arrayContaining(['legalName', 'taxId', 'registeredAddress', 'contactEmail']),
    )
  })

  it('la versión legal del paquete coincide con la de la migración (settings.legal)', () => {
    const sql = readFileSync('supabase/migrations/20261031000001_legal_consent.sql', 'utf-8')
    expect(sql).toContain(`"version": "${LEGAL_VERSION}"`)
  })
})
