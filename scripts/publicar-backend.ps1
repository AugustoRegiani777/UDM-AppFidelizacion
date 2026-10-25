# Publica el backend de la app en un proyecto de Supabase en la nube.
# Uso (en la carpeta del proyecto, después de `npx supabase login`):
#   powershell -ExecutionPolicy Bypass -File scripts\publicar-backend.ps1 -ProjectRef abcdefghijklmno
# El ProjectRef es el código de tu proyecto en Supabase (Project Settings -> General -> Reference ID).
# No toca nada local ni sube secretos a ningún repo: los secretos nuevos se guardan en
# supabase\.env.produccion.local (ignorado por git) y se cargan directo en Supabase.
param(
  [Parameter(Mandatory = $true)][string]$ProjectRef,
  # Mientras el POS real no esté conectado se usa el modo de prueba.
  [string]$PosMode = 'mock'
)

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

function Step($text) { Write-Host "`n==> $text" -ForegroundColor Cyan }
function Secret { -join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) }) }

# Funciones que se publican. NUNCA dev-mock-sale ni dev-pos-redeem (simulan la tablet y la caja).
$functions = @(
  'claim-sale', 'start-chest', 'finish-chest', 'renew-redemption', 'validate-redemption',
  'play-game', 'delete-account', 'reconcile', 'sync-google-reviews'
)

Step 'Comprobando que iniciaste sesión en Supabase'
& npx supabase projects list *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Primero corré: npx supabase login' -ForegroundColor Yellow
  exit 1
}

Step "Enlazando con el proyecto $ProjectRef (te va a pedir la contraseña de la base)"
& npx supabase link --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { exit 1 }

Step 'Subiendo la estructura de la base (migraciones)'
& npx supabase db push
if ($LASTEXITCODE -ne 0) { exit 1 }

$envFile = 'supabase\.env.produccion.local'
if (Test-Path $envFile) {
  Step 'Usando los secretos que ya generaste antes (supabase\.env.produccion.local)'
  $lines = Get-Content $envFile
} else {
  Step 'Generando secretos nuevos'
  $lines = @(
    "POS_MODE=$PosMode",
    "POS_HMAC_SECRET=$(Secret)",
    "POS_INBOUND_HMAC_SECRET=$(Secret)",
    "RECONCILE_SECRET=$(Secret)"
  )
  Set-Content -Path $envFile -Value $lines -Encoding ascii
}

Step 'Cargando los secretos en Supabase'
& npx supabase secrets set --env-file $envFile
if ($LASTEXITCODE -ne 0) { exit 1 }

Step 'Publicando las funciones'
& npx supabase functions deploy @functions --project-ref $ProjectRef
if ($LASTEXITCODE -ne 0) { exit 1 }

$reconcile = ($lines | Where-Object { $_ -like 'RECONCILE_SECRET=*' }) -replace '^RECONCILE_SECRET=', ''
$url = "https://$ProjectRef.supabase.co"

Step 'Buscando la clave pública'
$anon = ''
try {
  $keys = & npx supabase projects api-keys --project-ref $ProjectRef -o json | ConvertFrom-Json
  $anon = ($keys | Where-Object { $_.name -eq 'anon' }).api_key
} catch {
  # si falla, se ve en Supabase -> Project Settings -> API
}

Write-Host "`n=================== LISTO ===================" -ForegroundColor Green
Write-Host "1) En Netlify cargá estas variables:"
Write-Host "   VITE_SUPABASE_URL      = $url"
if ($anon) { Write-Host "   VITE_SUPABASE_ANON_KEY = $anon" }
else { Write-Host '   VITE_SUPABASE_ANON_KEY = (Supabase -> Project Settings -> API -> anon public)' }
Write-Host '   VITE_APP_URL           = la dirección de tu sitio en Netlify (con https://)'
Write-Host "`n2) En Supabase -> SQL Editor, pegá y ejecutá esto (programa la reconciliación cada 5 minutos):"
Write-Host "   select public.schedule_reconcile('$url/functions/v1/reconcile', '$reconcile');" -ForegroundColor Yellow
Write-Host "`n3) Guardá una copia de $envFile en un lugar seguro (no está en GitHub a propósito)."
Write-Host '4) Después seguí con el login de Google (docs\DEPLOY.md, sección "Autenticación en producción").'
