@echo off
chcp 65001 >nul
cd /d %~dp0

echo === 백엔드 재시작 ===
call "%~dp0stop-backend.bat"
timeout /t 2 /nobreak >nul
call "%~dp0start-backend.bat"
