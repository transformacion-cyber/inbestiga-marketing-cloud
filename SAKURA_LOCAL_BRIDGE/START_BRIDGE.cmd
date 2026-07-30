@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if not exist "SAKURA_DATA" mkdir "SAKURA_DATA"
where py.exe >nul 2>nul
if not errorlevel 1 (
  py.exe -3 -u "sakura_bridge.py" >>"SAKURA_DATA\bridge.log" 2>>"SAKURA_DATA\bridge-error.log"
  exit /b %errorlevel%
)
where python.exe >nul 2>nul
if not errorlevel 1 (
  python.exe -u "sakura_bridge.py" >>"SAKURA_DATA\bridge.log" 2>>"SAKURA_DATA\bridge-error.log"
  exit /b %errorlevel%
)
echo Python 3.10 o superior no esta disponible.>>"SAKURA_DATA\bridge-error.log"
exit /b 9009
