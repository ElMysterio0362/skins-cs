@echo off
title Skins CS
cd /d "%~dp0"

rem Node portatil (ZIP). Se mudar de pasta, ajuste o caminho abaixo.
set "NODE=C:\Users\vinicius.sanches\Documents\NODE\node-v24.22.0-win-x64\node.exe"

rem Se nao achar no caminho acima, tenta o node instalado no sistema.
if not exist "%NODE%" set "NODE=node"
"%NODE%" -v >nul 2>&1
if errorlevel 1 (
  echo.
  echo [ERRO] Node.js nao encontrado.
  echo Edite o arquivo iniciar.bat e corrija o caminho na linha "set NODE=".
  echo.
  pause
  exit /b 1
)

echo Iniciando Skins CS em http://localhost:8080
echo Para encerrar, feche esta janela ou aperte Ctrl+C.
echo.

rem Abre o navegador 2 segundos depois, quando o servidor ja estiver de pe.
start "" /b cmd /c "timeout /t 2 /nobreak >nul & start "" http://localhost:8080"

"%NODE%" server.mjs

echo.
echo O servidor parou. Se apareceu EADDRINUSE, a porta 8080 ja esta em uso
echo (talvez o site ja esteja aberto em outra janela).
pause
