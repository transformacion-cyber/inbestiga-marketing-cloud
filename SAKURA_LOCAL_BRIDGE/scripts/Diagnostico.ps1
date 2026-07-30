$ErrorActionPreference="Continue"
$Root=Split-Path -Parent $PSScriptRoot
. (Join-Path $PSScriptRoot "Sakura-Common.ps1")
Clear-Host
Write-Host "=== DIAGNÓSTICO SAKURA LOCAL v0.9 ===" -ForegroundColor Magenta
$Python=Find-PythonCommand
Write-Host ("Python 3.10+: " + $(if($Python){"OK"}else{"NO DISPONIBLE"})) -ForegroundColor $(if($Python){"Green"}else{"Red"})
$Ollama=Find-OllamaExecutable
Write-Host ("Ollama instalado: " + $(if($Ollama){"SÍ"}else{"NO"})) -ForegroundColor $(if($Ollama){"Green"}else{"Red"})
$OllamaState=Test-SakuraUrl "http://127.0.0.1:11434/api/tags"
Write-Host ("Ollama API: " + $(if($OllamaState){"CONECTADA"}else{"DESCONECTADA"})) -ForegroundColor $(if($OllamaState){"Green"}else{"Red"})
$Owner=Get-PortOwner -Port 8765
Write-Host ("Puerto 8765: " + $(if($Owner){"OCUPADO · PID $Owner"}else{"LIBRE"})) -ForegroundColor $(if($Owner){"Yellow"}else{"Green"})
if($Owner){$Info=Get-ProcessInfo -ProcessId $Owner;if($Info){Write-Host ("Proceso: "+$Info.Name);Write-Host ("Comando: "+$Info.CommandLine)}}
$Status=Test-SakuraUrl "http://127.0.0.1:8765/status"
if($Status){Write-Host "`nEstado del puente:" -ForegroundColor Cyan;$Status|ConvertTo-Json -Depth 5}else{Write-Host "`nPuente: NO RESPONDE" -ForegroundColor Red}
Show-BridgeError -Root $Root
$LastRoute=Join-Path $Root "SAKURA_DATA\last_route.txt"
if(Test-Path $LastRoute){Write-Host "`nÚltima ruta desconocida:" -ForegroundColor Yellow;Get-Content $LastRoute}
Read-Host "`nPresiona ENTER para cerrar"
