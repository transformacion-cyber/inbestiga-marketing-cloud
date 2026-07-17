@echo off
chcp 65001 >nul
cd /d "%~dp0"
title SAKURA Local Bridge v0.6
where python >nul 2>&1
if %errorlevel% neq 0 (
  echo No se encontró Python. Ejecuta primero INSTALAR_SAKURA_LOCAL.bat
  pause
  exit /b 1
)
python sakura_bridge.py
pause
