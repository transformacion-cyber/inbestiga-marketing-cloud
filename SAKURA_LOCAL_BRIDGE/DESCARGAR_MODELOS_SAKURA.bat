@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Modelos locales de SAKURA

where ollama >nul 2>nul
if errorlevel 1 goto no_ollama

echo Descargando modelo conversacional gemma3:4b...
ollama pull gemma3:4b
if errorlevel 1 goto download_error

echo.
echo Descargando modelo semantico embeddinggemma...
ollama pull embeddinggemma
if errorlevel 1 goto download_error

echo.
echo Modelos listos. Ya puedes iniciar SAKURA Local.
pause
exit /b 0

:no_ollama
echo.
echo No se encontro Ollama en este equipo.
echo Abre Ollama o reinicia Windows despues de instalarlo y vuelve a intentarlo.
pause
exit /b 1

:download_error
echo.
echo No se pudo completar una descarga.
echo Comprueba que Ollama este abierto y que tengas conexion a Internet.
pause
exit /b 1
