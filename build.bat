@echo off
cd /d %~dp0

echo === 1. 프론트엔드 빌드 ===
cd frontend
where npm >nul 2>&1
if errorlevel 1 (
    echo [오류] Node.js/npm이 설치되어 있지 않습니다.
    echo https://nodejs.org 에서 LTS 버전을 설치한 후 다시 실행하세요.
    pause
    exit /b 1
)
if not exist node_modules (
    echo npm install 실행 중...
    call npm install
)
call npm run build
if errorlevel 1 (
    echo [오류] 프론트엔드 빌드 실패
    pause
    exit /b 1
)
cd ..

echo.
echo === 2. Python 의존성 확인 ===
if not exist .venv (
    python -m venv .venv
)
call .venv\Scripts\activate
pip install -r requirements.txt -q

echo.
echo === 3. 테스트 실행 ===
pytest -v
if errorlevel 1 (
    echo [오류] 테스트 실패
    pause
    exit /b 1
)

echo.
echo === 빌드 완료 ===
echo 프로덕션 실행: start.bat
pause
