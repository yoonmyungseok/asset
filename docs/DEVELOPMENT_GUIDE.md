# 개발 가이드

## 요구사항

- Node.js 20+, npm 10+

## 초기 설정

```bash
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

http://localhost:4000

## 환경 변수

`.env.example`:

| 변수 | 용도 |
|------|------|
| `PORT` | 4000 (Next scripts에도 반영) |
| `DATABASE_URL` | `file:./data/asset.db` |
| `TOSS_*` | Toss Invest (선택) |
| `GOOGLE_*` | Sheets 서비스 계정 (건강, 선택) |

## npm scripts

| Script | 설명 |
|--------|------|
| `dev` / `start` | 포트 4000 |
| `build` | generate + next build |
| `test` / `test:watch` | Vitest |
| `lint` | ESLint |
| `db:migrate` | migrate dev |
| `db:push` | db push |
| `db:seed` | 시드 |
| `db:studio` | Prisma Studio |
| `db:import` | 레거시 자산 DB |
| `db:migrate-care` | self-care → 통합 DB |

## 레거시 self-care DB

```bash
npm run db:migrate-care
npx tsx scripts/migrate-self-care-db.ts --dry-run --source ../self-care/prisma/dev.db
```

포팅 스크립트(개발용): `scripts/port-self-care.mjs`.

## Windows dev 서버 재시작

`restart.bat` → `scripts/restart-launch.ps1` (포트 4000~).

## 품질 확인

```bash
npm test
npm run lint
npm run build
```

- 테스트: `tests/**/*.test.ts`, `src/**/*.test.ts` (건강은 `src/lib/care/**/__tests__`)
- Windows: dev 서버 실행 중 `prisma generate` EPERM 가능 → 서버 종료 후 재시도

## AI / Cursor 작업

1. [`.cursor/rules/`](../.cursor/rules/) — `project-core`, `safety`, `architecture-*`, `coding-standards-*`
2. [`docs/README.md`](README.md) — 설계 문서 목록
3. [`AGENTS.md`](../AGENTS.md)

도메인을 섞지 않는다: 자산 변경은 `/api/v1`·`lib/services`, 건강 변경은 `/api`·`lib/care`.

## 문서 수정

구조·API 변경 시 해당 `docs/*.md`와 README 요약을 함께 맞춘다.
