@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title SAKURA Local - Instalacion

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

for %%D in (conocimiento conversaciones correcciones personalidad preferencias embeddings acciones respaldos) do (
  if not exist "SAKURA_DATA\%%D" mkdir "SAKURA_DATA\%%D"
)

echo.
echo SAKURA Local quedo preparada correctamente.
echo No se instalaron dependencias externas.
echo Ahora ejecuta INICIAR_SAKURA_LOCAL.bat
echo.
pause
exit /b 0

:no_python
echo.
echo Python 3.10 o superior no esta instalado o no esta agregado al PATH.
echo.
echo Paso 1: instala Python desde la pagina oficial de Python.
echo Paso 2: durante la instalacion marca la opcion "Add python.exe to PATH".
echo Paso 3: cierra esta ventana y vuelve a ejecutar este archivo.
echo.
echo Se abrira la pagina oficial de descarga.
start "" "https://www.python.org/downloads/windows/"
pause
exit /b 1

:old_python
echo.
echo La version de Python instalada es demasiado antigua.
echo Instala Python 3.10 o superior y vuelve a ejecutar este archivo.
start "" "https://www.python.org/downloads/windows/"
pause
exit /b 1
