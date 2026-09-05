@echo off
chcp 65001 >nul
cd /d %~dp0

echo === 백엔드 시작 (포트 8000) ===
echo.

netstat -ano | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [경고] 포트 8000이 이미 사용 중입니다.
    echo        http://127.0.0.1:8000/docs
    pause
    exit /b 0
)

if not exist .venv (
    echo Python 가상환경 생성 중...
    python -m venv .venv
)

start "Asset Backend" cmd /k "cd /d %~dp0 && call .venv\Scripts\activate && pip install -r requirements.txt -q && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"

echo.
echo 백엔드 API: http://127.0.0.1:8000/docs
echo 종료: stop-backend.bat
echo.
pause
