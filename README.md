# Asset Manager

개인 자산·가계부·투자를 한 앱에서 관리합니다. Next.js App Router로 UI와 `/api/v1` API를 함께 제공합니다.

## 시작하기

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

http://localhost:4000 (포트는 `package.json` / `PORT` 기준, 기본 4000)

## 스택

Next.js 16 · React 19 · TypeScript · Prisma (SQLite) · Tailwind 4 · Zod · Vitest · decimal.js

## 구조

| 경로 | 역할 |
|------|------|
| `src/app` | 페이지, `api/v1` 라우트 |
| `src/lib` | services, validations, DB·API 유틸 |
| `src/components` | UI |
| `prisma` | 스키마·마이그레이션·seed |
| `tests` | Vitest (단위·통합) |
| `scripts` | Prisma 래퍼, 레거시 DB 이관, Windows dev 재시작 |

AI/에이전트 규칙: `.cursor/rules/` · Next.js 주의사항: `AGENTS.md`

## 명령

| 명령 | 설명 |
|------|------|
| `npm run dev` / `build` / `start` | 개발·빌드·프로덕션 |
| `npm test -- --run` | 테스트 1회 |
| `npm run test:watch` | 테스트 watch |
| `npm run db:migrate` / `db:seed` / `db:studio` | DB |
| `npm run db:import` | 레거시 SQLite → Prisma DB (`scripts/migrate-db.ts`) |
| `npm run lint` | ESLint |

Windows에서 기존 dev 프로세스 정리 후 서버: `restart.bat`

## 환경 변수

`.env.example` — `DATABASE_URL` (기본 `file:./data/asset.db`), Toss Invest API (선택).

로컬 DB·인증 파일은 git에 포함하지 않습니다 (`data/.gitkeep`만 추적).
