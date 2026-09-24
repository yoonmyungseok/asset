# 생활·자산 관리 (Asset + Self Care)

개인 **자산·가계부·투자**와 **건강(체중·러닝·식단)** 을 하나의 Next.js 앱에서 관리합니다.

## Tech Stack

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | SQLite + Prisma |
| Styling | Tailwind CSS v4 |
| Charts | Recharts v3 |
| Testing | Vitest |
| Validation | Zod |
| 금액 연산 | decimal.js + Prisma.Decimal |
| 건강 연동 | googleapis (Google Sheets 러닝 동기화, 선택) |

## Quick Start

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

브라우저: http://localhost:4000

## 주요 경로

| 영역 | 페이지 | API |
|------|--------|-----|
| 통합 대시보드 | `/` | 자산 `/api/v1/dashboard/*`, 건강 `/api/dashboard` |
| 가계부·예산·자산 | `/ledger`, `/ledger/budget`, `/ledger/analysis`, `/investment`, `/investment/accounts/[id]` | `/api/v1/*` |
| 건강 | `/weight`, `/running`, `/running-settings`, `/diet`, `/food-settings` | `/api/weight`, `/api/running`, `/api/diet` 등 |
| 설정 | `/settings`, `/settings/health` | 자산 UI + 건강 `/api/settings` |

설계 문서: [`docs/README.md`](docs/README.md) · Cursor Agent 규칙: [`.cursor/rules/`](.cursor/rules/)

## self-care DB 이관

기존 `self-care` SQLite(`prisma/dev.db`) 데이터를 통합 DB로 복사:

```bash
npm run db:migrate-care
# dry-run
npx tsx scripts/migrate-self-care-db.ts --dry-run --source ../self-care/prisma/dev.db
```

## 레거시 자산 DB 이관

```bash
npm run db:import
```

## 테스트·빌드

```bash
npm test
npm run test:watch
npm run lint
npm run build
```

## 환경 변수

`.env.example` 참고:

- `PORT` — 기본 4000 (`dev` / `start` 스크립트와 동일)
- `DATABASE_URL` — 기본 `file:./data/asset.db`
- `TOSS_*` — Toss Invest (선택)
- `GOOGLE_*` — Google Sheets 서비스 계정 (선택)

## npm scripts

| Script | 설명 |
|--------|------|
| `dev` | Next dev, 포트 4000 |
| `start` | Next start, 포트 4000 |
| `build` | `prisma generate` + Next 빌드 |
| `test` | Vitest 1회 실행 |
| `test:watch` | Vitest watch |
| `lint` | ESLint |
| `postinstall` | `prisma generate` |
| `db:migrate` | Prisma migrate dev (`scripts/run-prisma.ts`) |
| `db:push` | Prisma db push |
| `db:seed` | 자산 + 건강 시드 |
| `db:studio` | Prisma Studio |
| `db:import` | 레거시 자산 DB 이관 |
| `db:migrate-care` | self-care DB → 통합 DB |
