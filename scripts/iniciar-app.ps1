# Levanta todo el entorno local de la app: Docker, Supabase, funciones y la web.
# Se usa con doble clic en "Iniciar app.bat".
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

function Test-Docker {
    docker info 2>$null | Out-Null
    return ($LASTEXITCODE -eq 0)
}

if (-not (Test-Docker)) {
    Write-Host 'Prendiendo Docker Desktop (puede tardar un minuto)...'
    $docker = 'C:\Program Files\Docker\Docker\Docker Desktop.exe'
    if (-not (Test-Path $docker)) { throw 'No encuentro Docker Desktop. Instalalo desde docker.com.' }
    Start-Process $docker
    $waited = 0
    while (-not (Test-Docker)) {
        Start-Sleep -Seconds 5
        $waited += 5
        if ($waited -ge 240) { throw 'Docker no arrancó. Abrilo a mano y volvé a probar.' }
    }
}

Write-Host 'Levantando la base de datos (Supabase)...'
npx supabase start | Out-Null

Write-Host 'Abriendo las funciones del servidor y la web en ventanas nuevas...'
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'npx supabase functions serve'
Start-Process powershell -ArgumentList '-NoExit', '-Command', 'npm run dev'

Start-Sleep -Seconds 12
Start-Process 'http://localhost:5173'
Start-Process 'http://localhost:5173/dev'
Write-Host ''
Write-Host 'Listo. La app esta en http://localhost:5173 y el simulador de caja/tablet en /dev.'
Write-Host 'Para cerrar todo: cerra las dos ventanas nuevas y, si queres, corre: npx supabase stop'
