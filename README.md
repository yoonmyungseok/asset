# Asset Manager

개인 자산·가계부·투자 통합 관리 앱. Next.js 단일 스택으로 프론트엔드와 API를 함께 제공합니다.

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

## Quick Start

```bash
# 1. 의존성 설치
npm install

# 2. 환경 변수 설정
cp .env.example .env

# 3. DB 마이그레이션 + 시드
npm run db:migrate
npm run db:seed

# 4. 개발 서버 시작
npm run dev
```

브라우저에서 http://localhost:4000 을 엽니다.

## 기존 DB 이관

레거시 Python/FastAPI 앱의 `data/asset.db`를 Prisma DB로 이관할 때:

```bash
npm run db:import
# 또는 dry-run으로 row count 확인
npx tsx scripts/migrate-db.ts --dry-run
```

## 테스트

```bash
# 전체 테스트 (1회 실행)
npm test -- --run

# watch 모드
npm run test:watch
```

## 프로덕션 빌드

```bash
npm run build
npm run start
```

헬스체크:

```bash
curl http://localhost:4000/api/v1/health
# → { "status": "ok" }
```

## 주요 npm scripts

| Script | 설명 |
|--------|------|
| `dev` | 개발 서버 (Turbopack) |
| `build` | 프로덕션 빌드 |
| `start` | 프로덕션 서버 |
| `test` | Vitest 테스트 |
| `test:watch` | Vitest watch 모드 |
| `db:migrate` | Prisma migrate dev |
| `db:seed` | 기본 데이터 시드 |
| `db:import` | 레거시 DB 이관 |
| `db:studio` | Prisma Studio |
| `lint` | ESLint |

## 환경 변수

`.env.example` 참고:

- `PORT` — 개발/프로덕션 서버 포트 (기본: `4000`)
- `DATABASE_URL` — SQLite 경로 (기본: `file:./data/asset.db`)
- `TOSS_CLIENT_ID`, `TOSS_CLIENT_SECRET`, `TOSS_BASE_URL` — Toss Invest API (선택)

## 데이터

- `data/asset.db` — SQLite 데이터베이스
- `data/toss_credentials.json` — Toss API 인증 정보 (gitignore)
