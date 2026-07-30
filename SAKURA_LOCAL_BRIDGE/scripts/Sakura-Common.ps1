Set-StrictMode -Version 2.0

function Test-SakuraUrl {
    param([Parameter(Mandatory=$true)][string]$Url)
    try { return Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 3 -ErrorAction Stop }
    catch { return $null }
}

function Find-OllamaExecutable {
    $Command = Get-Command ollama.exe -ErrorAction SilentlyContinue
    if ($Command) { return $Command.Source }
    $Candidates = @(
        (Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"),
        (Join-Path $env:LOCALAPPDATA "Ollama\ollama.exe"),
        (Join-Path $env:ProgramFiles "Ollama\ollama.exe")
    )
    foreach ($Candidate in $Candidates) { if ($Candidate -and (Test-Path $Candidate)) { return $Candidate } }
    return $null
}

function Find-PythonCommand {
    $Py = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($Py) {
        & $Py.Source -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)" 2>$null
        if ($LASTEXITCODE -eq 0) { return @{ File=$Py.Source; Prefix=@("-3") } }
    }
    $Python = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($Python) {
        & $Python.Source -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)" 2>$null
        if ($LASTEXITCODE -eq 0) { return @{ File=$Python.Source; Prefix=@() } }
    }
    return $null
}

function Get-PortOwner {
    param([int]$Port=8765)
    try {
        $Connection=Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
        if ($Connection) { return [int]$Connection.OwningProcess }
    } catch {}
    try {
        foreach ($Line in (netstat -ano -p tcp 2>$null)) {
            if ($Line -match "^\s*TCP\s+\S+:$Port\s+\S+\s+LISTENING\s+(\d+)\s*$") { return [int]$Matches[1] }
        }
    } catch {}
    return $null
}

function Get-ProcessInfo {
    param([int]$ProcessId)
    try { return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop }
    catch { return $null }
}

function Stop-OldSakuraBridge {
    param([Parameter(Mandatory=$true)][string]$Root)
    $Ids=New-Object System.Collections.Generic.List[int]
    $PidFile=Join-Path $Root "SAKURA_DATA\bridge.pid"
    if (Test-Path $PidFile) {
        try { $Value=(Get-Content $PidFile -Raw).Trim(); if ($Value -match "^\d+$") { $Ids.Add([int]$Value) } } catch {}
    }
    $Owner=Get-PortOwner -Port 8765
    if ($Owner) { $Ids.Add($Owner) }
    foreach ($Id in ($Ids | Select-Object -Unique)) {
        $Info=Get-ProcessInfo -ProcessId $Id
        if ($Info -and [string]$Info.CommandLine -like "*sakura_bridge.py*") {
            try { Stop-Process -Id $Id -Force -ErrorAction Stop } catch {}
        }
    }
    Start-Sleep -Milliseconds 900
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

function Start-SakuraBridgeProcess {
    param([Parameter(Mandatory=$true)][string]$Root)
    $Python=Find-PythonCommand
    if (-not $Python) { throw "Python 3.10 o superior no está instalado o no está en PATH." }
    $Data=Join-Path $Root "SAKURA_DATA"
    New-Item -ItemType Directory -Force -Path $Data | Out-Null
    $ErrLog=Join-Path $Data "bridge-error.log"
    Remove-Item $ErrLog -Force -ErrorAction SilentlyContinue
    $Launcher=Join-Path $Root "START_BRIDGE.cmd"
    if (-not (Test-Path $Launcher)) { throw "Falta START_BRIDGE.cmd." }
    $Process=Start-Process -FilePath $Launcher -WorkingDirectory $Root -WindowStyle Hidden -PassThru
    $Process.Id | Set-Content (Join-Path $Data "bridge.pid") -Encoding ascii
}

function Wait-SakuraBridge {
    param([int]$Seconds=25)
    foreach ($Index in 1..([Math]::Max(1,$Seconds*2))) {
        Start-Sleep -Milliseconds 500
        $Status=Test-SakuraUrl "http://127.0.0.1:8765/status"
        if ($Status -and [string]$Status.version -eq "0.9-v17.15.3") { return $Status }
    }
    return $null
}

function Show-BridgeError {
    param([Parameter(Mandatory=$true)][string]$Root)
    $Path=Join-Path $Root "SAKURA_DATA\bridge-error.log"
    if (Test-Path $Path) {
        Write-Host "`nERROR REAL DEL PUENTE:" -ForegroundColor Yellow
        Get-Content $Path -Tail 30 | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    }
}
