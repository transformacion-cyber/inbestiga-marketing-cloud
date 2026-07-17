@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Instalación local de SAKURA
where python >nul 2>&1
if %errorlevel% neq 0 (
  echo No se encontró Python en este equipo.
  echo Instala Python 3.10 o superior y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)
python -c "import sys; assert sys.version_info >= (3,10), 'Se requiere Python 3.10 o superior'"
if %errorlevel% neq 0 (
  echo La versión de Python es demasiado antigua.
  pause
  exit /b 1
)
for %%D in (conocimiento conversaciones correcciones personalidad preferencias embeddings acciones respaldos) do if not exist "SAKURA_DATA\%%D" mkdir "SAKURA_DATA\%%D"
echo.
echo SAKURA Local quedó preparada. No se instalaron dependencias externas.
echo Ahora ejecuta INICIAR_SAKURA_LOCAL.bat
pause
