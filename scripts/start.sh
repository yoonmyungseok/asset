#!/bin/bash
set -e

# 환경 변수 및 PATH 설정
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting Asset Next.js server..." >> logs/start.log

# 기존 4000 포트 점유 프로세스 정리
PID=$(lsof -ti :4000 || true)
if [ -n "$PID" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Port 4000 is occupied by PID $PID. Killing..." >> logs/start.log
    kill -9 $PID || true
fi

# Next.js 실행
exec npm run dev
