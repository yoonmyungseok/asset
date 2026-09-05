@echo off
chcp 65001 >nul
cd /d %~dp0

echo === 프론트엔드 재시작 ===
call "%~dp0stop-frontend.bat"
timeout /t 2 /nobreak >nul
call "%~dp0start-frontend.bat"
