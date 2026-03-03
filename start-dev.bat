@echo off
cd /d "%~dp0"

echo Iniciando servidor de desenvolvimento em http://localhost:5173 ...
npm.cmd run dev -- --host localhost --port 5173

if errorlevel 1 (
  echo.
  echo Falha ao iniciar. Tentando porta 5174...
  npm.cmd run dev -- --host localhost --port 5174
)
