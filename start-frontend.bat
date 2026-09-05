@echo off
chcp 65001 >nul
cd /d %~dp0

echo === 프론트엔드 시작 (포트 5173) ===
echo.

netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [경고] 포트 5173이 이미 사용 중입니다.
    echo        http://localhost:5173
    pause
    exit /b 0
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [오류] Node.js/npm이 설치되어 있지 않습니다.
    echo https://nodejs.org 에서 LTS 버전을 설치하세요.
    pause
    exit /b 1
)

cd frontend
if not exist node_modules (
    echo npm install 실행 중...
    call npm install
)
start "Asset Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
cd ..

echo.
echo 프론트엔드: http://localhost:5173
echo 종료: stop-frontend.bat
echo.
pause
