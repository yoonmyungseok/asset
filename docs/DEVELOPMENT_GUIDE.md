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
| `build` | `prisma generate` + `next build` |
| `test` / `test:watch` | Vitest |
| `lint` | ESLint |
| `postinstall` | `prisma generate` |
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

`scripts/port-self-care.mjs` — **일회성** self-care 소스를 이 저장소로 복사할 때만 사용. 일반 개발·운영에는 필요 없음.

## Windows dev 서버 재시작

`restart.bat` → `scripts/restart-launch.ps1` (포트 4000~).

## 품질 확인

```bash
npm test
npm run lint
npm run build
```

- Vitest: `vitest.config.ts` — `environment: node`, `include: ["src/**/*.test.ts", "tests/**/*.test.ts"]`, `tests/setup.ts`, alias `@` → `src`.
- 자산 테스트: `tests/**/*.test.ts`
- 건강 테스트: `src/lib/care/**/__tests__/**/*.test.ts`
- Windows: dev 서버 실행 중 `prisma generate` EPERM 가능 → 서버 종료 후 재시도
- `lint`는 기존 경고·오류가 있을 수 있음 — 문서 작업만으로 새 오류를 추가하지 않는다.

## AI / Cursor 작업

1. [`.cursor/rules/`](../.cursor/rules/) — `project-core`, `safety`, `architecture-*`, `coding-standards-*`, `testing`
2. [`docs/README.md`](README.md) — 설계 문서 목록
3. [`AGENTS.md`](../AGENTS.md)

도메인을 섞지 않는다: 자산 변경은 `/api/v1`·`lib/services`, 건강 변경은 `/api`·`lib/care`.

## 문서 수정

구조·API·스키마·화면·스크립트를 바꿀 때 아래를 함께 맞춘다.

| 변경 종류 | 수정할 문서 (우선) |
|-----------|-------------------|
| 새·변경 `/api/v1` route | `docs/API_V1.md`, 필요 시 `DATA_FLOW.md`, `README.md` 요약 |
| 새·변경 건강 `/api` route | `docs/API_CARE.md`, `DATA_FLOW.md` |
| Prisma model / migration | `docs/DATABASE.md` |
| 새 page·네비 | `docs/PROJECT_OVERVIEW.md`, `DIRECTORY_STRUCTURE.md`, `README.md` |
| npm script / `.env.example` | `README.md`, `DEVELOPMENT_GUIDE.md`, `PROJECT_OVERVIEW.md` |
| 아키텍처·정책 결정 | `docs/DECISIONS.md` |
| 설계 전반 | `docs/ARCHITECTURE.md` |

라우트 목록 점검 (선택):

```bash
npx tsx scripts/doc-audit.ts
```

릴리스·큰 PR 전에는 `npm test`와 위 audit 또는 `API_V1` / `API_CARE` 수동 대조를 권장한다.
