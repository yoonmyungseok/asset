@echo off

if /i "%~1"=="_run_" goto :run

powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0scripts\restart-launch.ps1" -BatPath "%~f0"
exit

:run
chcp 65001 >nul
setlocal EnableDelayedExpansion

cd /d "%~dp0"

set PORT=4000

echo ========================================
echo  Asset - Dev Server
echo ========================================
echo.
echo   http://localhost:%PORT%
echo   Press Ctrl+C to stop
echo.

call npm run dev

if errorlevel 1 (
    echo.
    echo [ERROR] Failed to start dev server.
    pause
    exit /b 1
)
