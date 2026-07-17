@echo off
chcp 65001 >nul
title Modelos locales de SAKURA
where ollama >nul 2>&1
if %errorlevel% neq 0 (
  echo No se encontró Ollama. Abre o instala Ollama y vuelve a intentarlo.
  pause
  exit /b 1
)
echo Descargando modelo conversacional gemma3:4b...
ollama pull gemma3:4b
if %errorlevel% neq 0 goto error
echo Descargando modelo semántico embeddinggemma...
ollama pull embeddinggemma
if %errorlevel% neq 0 goto error
echo.
echo Modelos listos. Ya puedes iniciar SAKURA Local.
pause
exit /b 0
:error
echo.
echo No se pudo completar una descarga. Revisa Ollama y la conexión.
pause
