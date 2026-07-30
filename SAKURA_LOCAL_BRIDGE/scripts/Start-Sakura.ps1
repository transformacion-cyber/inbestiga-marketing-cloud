param([switch]$ForceRestart,[switch]$NoPause)
$ErrorActionPreference="Stop"
$Root=Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "Sakura-Common.ps1")
Clear-Host
Write-Host "============================================================" -ForegroundColor Magenta
Write-Host "     SAKURA LOCAL BRIDGE v0.9 · INBESTIGA v17.15.3" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Magenta
try {
    $OllamaState=Test-SakuraUrl "http://127.0.0.1:11434/api/tags"
    if (-not $OllamaState) {
        $Ollama=Find-OllamaExecutable
        if (-not $Ollama) { throw "No se encontró Ollama instalado." }
        Write-Host "`nIniciando Ollama..." -ForegroundColor Cyan
        Start-Process -FilePath $Ollama -ArgumentList "serve" -WindowStyle Hidden | Out-Null
        foreach ($Index in 1..40) { Start-Sleep -Milliseconds 500; $OllamaState=Test-SakuraUrl "http://127.0.0.1:11434/api/tags"; if ($OllamaState) { break } }
    }
    if (-not $OllamaState) { throw "Ollama no respondió en 127.0.0.1:11434." }

    $Status=Test-SakuraUrl "http://127.0.0.1:8765/status"
    if ($ForceRestart -or ($Status -and [string]$Status.version -ne "0.9-v17.15.3")) {
        Stop-OldSakuraBridge -Root $Root
        $Status=$null
    }
    if (-not $Status) {
        $Owner=Get-PortOwner -Port 8765
        if ($Owner) {
            $Info=Get-ProcessInfo -ProcessId $Owner
            throw "El puerto 8765 está ocupado por $($Info.Name) (PID $Owner). Ejecuta REPARAR_Y_REINICIAR_SAKURA.bat."
        }
        Write-Host "Iniciando conector local..." -ForegroundColor Cyan
        Start-SakuraBridgeProcess -Root $Root
        $Status=Wait-SakuraBridge -Seconds 25
    }
    if (-not $Status) { Show-BridgeError -Root $Root; throw "El puente no pudo iniciar." }

    $Admin=Invoke-RestMethod "http://127.0.0.1:8765/api/pairing/admin" -TimeoutSec 5
    $Code=[string]$Admin.code
    try { Set-Clipboard -Value $Code } catch {}
    Write-Host "`nConector local: ACTIVO" -ForegroundColor Green
    Write-Host "Versión: 0.9-v17.15.3" -ForegroundColor Green
    Write-Host "Ollama: CONECTADO" -ForegroundColor Green
    Write-Host "`n------------------------------------------------------------" -ForegroundColor DarkMagenta
    Write-Host " CÓDIGO DE EMPAREJAMIENTO" -ForegroundColor Yellow
    Write-Host "`n                  $Code" -ForegroundColor White -BackgroundColor DarkMagenta
    Write-Host "`n El código fue copiado al portapapeles." -ForegroundColor Cyan
    Write-Host " Pégalo en SAKURA > Ajustes > Motor local > Emparejar." -ForegroundColor Cyan
    Write-Host "------------------------------------------------------------" -ForegroundColor DarkMagenta
} catch {
    Write-Host "`nERROR: $($_.Exception.Message)" -ForegroundColor Red
    Show-BridgeError -Root $Root
    if (-not $NoPause) { Read-Host "Presiona ENTER para cerrar" }
    exit 1
}
if (-not $NoPause) { Read-Host "Puedes cerrar esta ventana; SAKURA seguirá activa" }
