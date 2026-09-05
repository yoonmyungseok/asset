@echo off
chcp 65001 >nul
cd /d %~dp0

echo === 프론트엔드 종료 (포트 5173) ===

set FOUND=0
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo   PID %%a 종료
    taskkill /PID %%a /F >nul 2>&1
    set FOUND=1
)

if "%FOUND%"=="0" echo   실행 중인 프론트엔드가 없습니다.
echo 완료.
timeout /t 1 /nobreak >nul
