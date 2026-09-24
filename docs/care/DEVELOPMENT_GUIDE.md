# 개발 가이드

## 초기 설정

```bash
npm install
cp .env.example .env   # Windows: copy
npm run db:setup         # push + seed (또는 db:push만)
npm run dev
```

기본 URL: `http://localhost:3000` (README).

## 환경 변수 (.env.example)

| 변수 | 용도 |
|------|------|
| `DATABASE_URL` | SQLite (`file:./dev.db`) |
| `GOOGLE_APPLICATION_CREDENTIALS` | 서비스 계정 JSON 경로 (권장) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | 대안 |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON 한 줄 |
| `GOOGLE_SPREADSHEET_ID` | (선택) UI 대신 ID 고정 |

Google Sheets 기능은 자격 증명 + (UI 또는 env) 스프레드시트 ID가 필요하다.

## Windows dev 서버 재시작

- `restart.bat`: 포트 3000 LISTEN 프로세스 종료 후 `npm run dev` (새 cmd 창)
- 내부: `scripts/restart-launch.ps1`

## 품질 확인

```bash
npm test
npm run lint
npm run build
```

- 테스트: `src/**/*.test.ts` (Vitest, Node 환경)
- Lint: eslint 9 + eslint-config-next (일부 페이지에서 `react-hooks/set-state-in-effect` 등 기존 이슈 존재)
- Build: Prisma client 생성 후 `next build` — dev 서버가 켜져 있으면 Windows에서 `prisma generate` 파일 잠금(EPERM)이 날 수 있음

## Cursor / AI 작업

1. `.cursor/rules/` — 변경 원칙·레이어
2. `docs/` — 구조·API·DB
3. `AGENTS.md` — Next.js 16 문서 참조 안내

코드 변경 시 요청 범위만 수정하고, 관련 API·페이지·스키마·테스트를 함께 확인한다.

## 로컬 only 스크립트

- `scripts/import-running.ts`: 고정 Windows 경로 Excel + Python(pandas)로 DB import. `package.json` script에 연결되어 있지 않음. 수동 `tsx scripts/import-running.ts` 전제.
