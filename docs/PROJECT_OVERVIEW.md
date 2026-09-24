# 프로젝트 개요

## 목적

**생활·자산 관리**는 한 사람의 일상 데이터를 한 곳에서 다루는 로컬 웹 앱이다.

- **자산**: 계좌·보유종목·가계부·예산·카드·부채·스냅샷·대시보드
- **건강**: 체중·러닝·식단·영양 목표·(선택) Google Sheets 러닝 동기화

브라우저에서 `http://localhost:4000`으로 접속한다. 인증·멀티 사용자는 없다.

## 기술 스택

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| DB | SQLite + Prisma 6 |
| 검증 | Zod 4 |
| 차트 | Recharts 3 |
| 테스트 | Vitest 3 |
| 자산 금액 | `decimal.js` + `Prisma.Decimal` |
| 건강 연동 | `googleapis` (서비스 계정, 선택) |
| 시장 데이터 | Toss Invest Open API + Yahoo chart (`src/lib/external/market-data.ts`, 선택·env) |

## npm scripts

| script | 설명 |
|--------|------|
| `dev` / `start` | 포트 **4000** |
| `build` | `prisma generate` + `next build` |
| `test` / `test:watch` | Vitest |
| `lint` | ESLint |
| `postinstall` | `prisma generate` |
| `db:migrate` | Prisma migrate dev (`scripts/run-prisma.ts`) |
| `db:push` | Prisma db push |
| `db:seed` | 자산 + 건강 시드 |
| `db:studio` | Prisma Studio |
| `db:import` | 레거시 자산 DB 이관 |
| `db:migrate-care` | 레거시 self-care SQLite → 통합 DB |

## 화면

### 사이드바 (`AppLayout` NAV_ITEMS)

| 경로 | 영역 |
|------|------|
| `/` | 통합 대시보드 (자산 요약 + 건강 `CareDashboardSection`) |
| `/ledger` | 가계부 |
| `/ledger/budget` | 예산 |
| `/investment` | 자산·투자 목록 |
| `/weight` | 체중 |
| `/running` | 러닝 |
| `/diet` | 식단 |
| `/settings` | 자산·앱 설정 (catch-all) |

### 서브 페이지 (직접 URL·링크)

| 경로 | 영역 |
|------|------|
| `/ledger/analysis` | 가계부 분석 |
| `/investment/accounts/[id]` | 계좌 상세 |
| `/running-settings` | 러닝 타입 등 |
| `/food-settings` | 음식 DB 관리 |
| `/settings/health` | 건강 프로필·목표·Google Sheets (`HealthSettingsPanel`) |

## HTTP API (요약)

| 영역 | Base | 클라이언트 |
|------|------|------------|
| 자산 | `/api/v1` | `src/lib/api/client.ts` |
| 건강 | `/api` (v1 아님) | 페이지에서 `fetch('/api/...')` |

상세: [API.md](API.md).

## 코드 네임스페이스

| 영역 | 라이브러리 | UI |
|------|------------|-----|
| 자산 | `src/lib/services`, `src/lib/api`, `src/lib/validations`, `src/lib/external`, `src/lib/data` | `src/app/ledger`, `investment`, `components/layout` |
| 건강 | `src/lib/care/**` | `src/components/care/**`, `src/app/weight` 등 |

공유: `src/lib/db.ts`, `prisma/schema.prisma`, `AppLayout`.
