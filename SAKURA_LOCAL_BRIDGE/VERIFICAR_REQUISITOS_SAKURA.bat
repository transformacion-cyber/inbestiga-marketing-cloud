@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Verificacion de requisitos de SAKURA

echo ==========================================
echo VERIFICACION DE SAKURA LOCAL
echo ==========================================
echo.

set "PY_CMD="
where py >nul 2>nul
if not errorlevel 1 set "PY_CMD=py -3"
if not defined PY_CMD (
  where python >nul 2>nul
  if not errorlevel 1 set "PY_CMD=python"
)

if defined PY_CMD (
  echo [OK] Python encontrado:
  %PY_CMD% --version
) else (
  echo [FALTA] Python 3.10 o superior.
)

echo.
where ollama >nul 2>nul
if not errorlevel 1 (
  echo [OK] Ollama encontrado:
  ollama --version
) else (
  echo [FALTA] Ollama no fue encontrado en el PATH.
)

echo.
if exist "sakura_bridge.py" (
  echo [OK] sakura_bridge.py esta presente.
) else (
  echo [FALTA] sakura_bridge.py no esta en esta carpeta.
)

echo.
echo Cuando Python y Ollama muestren [OK], ejecuta:
echo INICIAR_SAKURA_LOCAL.bat
pause
