@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SAKURA Local Bridge v0.6

set "PY_CMD="
where py >nul 2>nul
if not errorlevel 1 set "PY_CMD=py -3"

if not defined PY_CMD (
  where python >nul 2>nul
  if not errorlevel 1 set "PY_CMD=python"
)

if not defined PY_CMD goto no_python

%PY_CMD% -c "import sys; raise SystemExit(0 if sys.version_info >= (3,10) else 1)"
if errorlevel 1 goto old_python

%PY_CMD% sakura_bridge.py
set "EXIT_CODE=%errorlevel%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo SAKURA Local se cerro con el codigo %EXIT_CODE%.
  echo Revisa el mensaje mostrado arriba.
)
pause
exit /b %EXIT_CODE%

:no_python
echo.
echo Python 3.10 o superior no esta instalado o no esta agregado al PATH.
echo Ejecuta primero INSTALAR_SAKURA_LOCAL.bat
pause
exit /b 1

:old_python
echo.
echo La version de Python instalada es demasiado antigua.
echo Instala Python 3.10 o superior.
pause
exit /b 1
