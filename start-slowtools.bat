@echo off
setlocal
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js and npm are required to start SlowTools.
  echo Install Node.js from https://nodejs.org/ and try again.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing project dependencies for the first run...
  call npm install
  if errorlevel 1 (
    echo Dependency installation failed.
    pause
    exit /b 1
  )
)

echo Starting SlowTools...
start "SlowTools Dev Server" cmd /k "cd /d ""%~dp0"" && npm run dev -- --host 127.0.0.1 --open"
endlocal
