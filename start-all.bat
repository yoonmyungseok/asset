@echo off
chcp 65001 >nul
cd /d %~dp0

echo === 개발 모드 (백엔드 + 프론트 분리) ===
echo.

netstat -ano | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [경고] 포트 8000이 이미 사용 중입니다.
    echo        stop.bat 실행 후 다시 시도하거나, 아래 주소로 바로 접속하세요:
    echo        http://127.0.0.1:8000/docs
    echo.
    goto :check_frontend
)

if not exist .venv (
    python -m venv .venv
)
start "Asset API" cmd /k "cd /d %~dp0 && call .venv\Scripts\activate && pip install -r requirements.txt -q && uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
timeout /t 2 /nobreak >nul

:check_frontend
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [경고] 포트 5173이 이미 사용 중입니다.
    echo        http://localhost:5173 으로 바로 접속하세요.
    echo.
    goto :done
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [경고] Node.js 미설치 - 프론트엔드는 실행되지 않습니다.
    echo        API만 사용: http://127.0.0.1:8000/docs
    goto :done
)

cd frontend
if not exist node_modules call npm install
start "Asset Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
cd ..

:done
echo.
echo 백엔드 API:  http://127.0.0.1:8000/docs
echo 프론트엔드:  http://localhost:5173
echo.
echo 서버 종료: stop.bat
pause
