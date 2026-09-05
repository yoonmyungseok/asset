@echo off
cd /d %~dp0
echo 기존 서버 종료 중...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    echo   포트 8000 - PID %%a 종료
    taskkill /PID %%a /F >nul 2>&1
)

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo   포트 5173 - PID %%a 종료
    taskkill /PID %%a /F >nul 2>&1
)

echo 완료.
timeout /t 1 /nobreak >nul
