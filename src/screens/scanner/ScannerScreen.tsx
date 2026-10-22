import { useRef } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/Button'
import { Screen } from '@/components/Screen'
import { saleRoute } from '@/features/claims/pendingSale'
import { parseSaleCode } from '@/features/scanner/parseSaleCode'
import { useQrScanner, type ScannerState } from '@/features/scanner/useQrScanner'
import { copy } from '@/copy'
import { ManualCodeForm } from './ManualCodeForm'

/** Escáner interno: camino principal para sumar una compra. */
export function ScannerScreen() {
  const navigate = useNavigate()

  /** Devuelve false si el texto no es una venta (el escáner sigue buscando; el formulario avisa). */
  function openSale(text: string): boolean {
    const uuid = parseSaleCode(text)
    if (uuid) navigate(saleRoute(uuid), { replace: true })
    return uuid !== null
  }

  const videoRef = useRef<HTMLVideoElement>(null)
  const scanner = useQrScanner(videoRef, openSale) // un QR ajeno se ignora y la cámara sigue buscando
  const cameraProblem = scanner.state === 'denied' || scanner.state === 'unavailable'

  return (
    <Screen className="gap-5">
      <Link to="/panel" className="min-h-12 content-center underline">
        {copy.scanner.back}
      </Link>
      <h1 className="font-display text-5xl leading-none">{copy.scanner.title}</h1>

      <video
        ref={videoRef}
        playsInline
        muted
        className={`aspect-square w-full rounded-card bg-ink object-cover ${scanner.state === 'scanning' ? '' : 'hidden'}`}
      />

      <ScannerBody state={scanner.state} onStart={scanner.start} />
      {(cameraProblem || scanner.state === 'idle') && <ManualCodeForm onSubmit={openSale} />}
    </Screen>
  )
}

function ScannerBody({ state, onStart }: { state: ScannerState; onStart: () => void }) {
  if (state === 'scanning') return <p className="text-muted text-center">{copy.scanner.pointAt}</p>
  if (state === 'starting') return <p className="text-muted text-center">{copy.scanner.starting}</p>

  if (state === 'denied') {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">{copy.scanner.deniedTitle}</h2>
        <p className="text-muted">{copy.scanner.deniedBody}</p>
        <ul className="text-muted list-disc space-y-1 pl-5 text-sm">
          {copy.scanner.howToEnable.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
        <Button variant="ghost" onClick={onStart}>
          {copy.scanner.retry}
        </Button>
      </div>
    )
  }

  if (state === 'unavailable') {
    return (
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold">{copy.scanner.unsupportedTitle}</h2>
        <p className="text-muted">{copy.scanner.unsupportedBody}</p>
      </div>
    )
  }

  // idle: explicamos para qué se pide el permiso antes de pedirlo.
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-bold">{copy.scanner.introTitle}</h2>
      <p className="text-muted">{copy.scanner.introBody}</p>
      <Button onClick={onStart}>{copy.scanner.enable}</Button>
    </div>
  )
}
