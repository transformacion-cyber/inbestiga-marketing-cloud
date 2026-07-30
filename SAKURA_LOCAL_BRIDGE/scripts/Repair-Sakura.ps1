$ErrorActionPreference="Continue"
$Root=Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "Sakura-Common.ps1")
Clear-Host
Write-Host "REPARANDO SAKURA LOCAL..." -ForegroundColor Magenta
Stop-OldSakuraBridge -Root $Root
Remove-Item (Join-Path $Root "SAKURA_DATA\bridge-error.log") -Force -ErrorAction SilentlyContinue
& (Join-Path $PSScriptRoot "Start-Sakura.ps1") -ForceRestart
