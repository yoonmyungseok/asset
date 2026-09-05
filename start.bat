@echo off
chcp 65001 >nul
cd /d %~dp0

netstat -ano | findstr ":8000" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    echo [안내] 포트 8000이 이미 사용 중입니다. 기존 서버로 접속합니다.
    start http://127.0.0.1:8000
    pause
    exit /b 0
)

if not exist .venv (
    echo Python 가상환경 생성 중...
    python -m venv .venv
)
call .venv\Scripts\activate
pip install -r requirements.txt -q

if not exist frontend\dist (
    echo.
    echo [안내] frontend\dist 가 없습니다. 프로덕션 UI를 사용하려면 build.bat 을 먼저 실행하세요.
    echo 개발 모드로 API만 실행합니다. 프론트는 start-all.bat 을 사용하세요.
    echo.
    uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
) else (
    echo.
    echo ========================================
    echo   내 자산 관리 - 프로덕션 모드
    echo   http://127.0.0.1:8000
    echo   API 문서: http://127.0.0.1:8000/docs
    echo ========================================
    echo.
    start http://127.0.0.1:8000
    uvicorn app.main:app --host 127.0.0.1 --port 8000
)
