$ErrorActionPreference="Continue"
$Root=Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "Sakura-Common.ps1")
Stop-OldSakuraBridge -Root $Root
Write-Host "Puente SAKURA detenido. Ollama permanece activo." -ForegroundColor Green
Start-Sleep -Seconds 2
