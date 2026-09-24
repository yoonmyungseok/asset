# Big Bang 전환: FastAPI + Vite → Next.js 16 + Prisma + Tailwind

> **현재 앱 구조**(건강 통합 포함)는 루트 [README.md](../README.md)와 [docs/README.md](README.md)를 본다. 이 파일은 **자산 앱 전환** 당시 체크리스트·아카이브다.


**목표:** FastAPI + Vite + SQLAlchemy → Next.js 16 (App Router) + Prisma + Tailwind v4 단일 앱으로 **한 번에** 교체  
**브랜치:** `feat/nextjs-migration`  
**롤백 태그:** `pre-nextjs-migration`  
**DB 백업:** `data/asset.db.pre-migration.bak`, `data/asset.db.cutover.bak`, `data/toss_credentials.json.bak`

---

## 전환 원칙

| 원칙 | 내용 |
|------|------|
| 기능 동등성 | 기존 24개 통합 테스트 + 20개 단위 테스트가 모두 통과할 때까지 완료 아님 |
| API 호환 | `/api/v1/*` 경로·응답 형식 유지 |
| 데이터 보존 | 기존 `data/asset.db` 이관 스크립트 + 롤백용 백업 필수 |
| 금액 정밀도 | `Decimal` → `Prisma.Decimal` + `decimal.js`, API는 문자열 직렬화 유지 |
| 단일 배포 | `next build` + `next start` 하나로 프론트·API 동시 서빙 |

---

## Baseline 아티팩트 (Phase 0)

| 파일 | 설명 |
|------|------|
| `docs/migration-baseline-tests.txt` | pytest 전체 실행 결과 |
| `docs/migration-api-samples/*.json` | 주요 API 응답 샘플 8개 |
| `data/asset.db.pre-migration.bak` | 롤백용 DB 백업 |
| `data/toss_credentials.json.bak` | Toss API 인증 정보 백업 |

---

## Phase 0: 준비 (Day 0)

- [x] `feat/nextjs-migration` 브랜치 생성
- [x] `data/asset.db` → `data/asset.db.pre-migration.bak` 백업
- [x] `data/toss_credentials.json` → `data/toss_credentials.json.bak` 백업
- [x] `git tag pre-nextjs-migration` 생성
- [x] `pytest tests/ -v` 실행 → `docs/migration-baseline-tests.txt` 저장
- [x] API 응답 샘플 8개 → `docs/migration-api-samples/` 저장
- [x] `docs/MIGRATION.md` 생성

**완료 기준:** 롤백용 DB 백업 확보, baseline 테스트·API 샘플 저장 ✅

---

## Phase 1: 프로젝트 셋업 (Week 1, Day 1~2)

- [x] Next.js 16 프로젝트 초기화 (`create-next-app`)
- [x] 의존성 설치: `prisma`, `@prisma/client`, `zod`, `decimal.js`, `date-fns`, `recharts`, `vitest`
- [x] 환경 변수 설정 (`.env`: `DATABASE_URL`, Toss API)
- [x] `src/lib/db.ts` — Prisma Client 싱글톤
- [x] `src/lib/decimal.ts` — 금액 연산 헬퍼
- [x] `src/lib/api-error.ts` — FastAPI 호환 에러 응답
- [x] `src/instrumentation.ts` — 서버 시작 시 `initializeAll` + `processDueCardPayments`

**완료 기준:** `npm run dev` 정상 기동, `/api/v1/health` → `{ "status": "ok" }` ✅

---

## Phase 2: Prisma 스키마 + 데이터 이관 (Week 1, Day 3~5)

- [x] `prisma/schema.prisma` 작성 (18개 모델, SQLAlchemy 1:1 매핑)
- [x] `prisma/seed.ts` — account_types, categories, payment_methods 시드
- [x] `scripts/migrate-db.ts` — 기존 `asset.db` → Prisma DB 이관
- [x] FK 의존성 순서대로 테이블 이관 (account_types → categories → accounts → ...)
- [x] 이관 후 row count·금액·카테고리 트리 검증

**완료 기준:** `npx prisma db seed` 성공, 기존 데이터 무손실 확인 ✅

---

## Phase 3: 서비스 레이어 포팅 (Week 2)

- [x] `lib/decimal.ts` + `lib/utils.ts` (`app/utils.py` 포팅)
- [x] `lib/services/core.ts` — 계좌 평가, 매수/매도, 스냅샷, 예산
- [x] `lib/services/bank-transfers.ts` — 가계부 잔액 반영, 이체, 환급 (**최우선**)
- [x] `lib/services/card-payments.ts` — 카드 지출, 자동 정산 (**최우선**)
- [x] `lib/external/market-data.ts`, `toss-invest.ts`
- [x] `lib/validations/*.ts` — Pydantic → Zod 스키마 포팅

**완료 기준:** bank-transfers, card-payments가 Python 테스트 케이스와 동일 결과 ✅

---

## Phase 4: API Route Handlers (Week 3)

20개 라우터를 `/api/v1/*` Route Handler로 포팅. 응답 JSON·HTTP 상태코드·에러 메시지 기존과 동일 유지.

| 일차 | 라우터 |
|------|--------|
| D1 | health, setup, account-types, institutions, categories, payment-methods, tags |
| D2 | accounts, account-limits, holdings, investment-transactions |
| D3 | cards, ledger-transactions |
| D4 | recurring-items, budgets, liabilities, snapshots |
| D5 | dashboard, market, backup |

**완료 기준:** 40+ 엔드포인트 smoke test, 기존 `api/client.ts`로 동작 확인 ✅

---

## Phase 5: 프론트엔드 이전 + Tailwind (Week 4)

- [x] App Router 라우팅 매핑 (`/` → Dashboard, `/ledger` → Ledger, ...)
- [x] 컴포넌트 26개 이전 (`'use client'`, `next/link`, `useRouter`)
- [x] `api/client.ts` 유지 (`BASE = '/api/v1'`)
- [x] CSS ~1,200줄 → Tailwind 유틸리티 클래스 전환
- [x] Recharts v2 → v3 업그레이드 (3곳)

**완료 기준:** 모든 페이지 UI 기능 동등, `npm run build` 성공 ✅

---

## Phase 6: 테스트 포팅 + QA (Week 5, Day 1~3)

- [x] Vitest 설정 (`vitest.config.ts`, `tests/setup.ts`)
- [x] 테스트 헬퍼: `tests/helpers/test-db.ts`, `tests/helpers/api-client.ts`, `tests/helpers/seed-ids.ts`
- [x] 통합 테스트 24개 포팅 (`tests/integration/api.test.ts`)
- [x] 단위 테스트 20개 포팅 (`tests/unit/deposit-interest.test.ts`, `tests/unit/market-data.test.ts`)
- [x] 수동 QA: 아래 체크리스트 (UI·실데이터)

**자동 테스트 결과 (2026-09-10):**

```bash
npm test -- --run
# Test Files  4 passed (4)
# Tests       47 passed (47)  ← 포팅 44 + decimal 3
```

**완료 기준:** Vitest 44개 테스트 100% pass ✅ · 수동 QA 체크리스트 100% ✅

---

## Phase 7: Cutover (Week 5, Day 4~5)

### Cutover 전 (D-1)

- [x] `feat/nextjs-migration` 브랜치 최종 merge 준비
- [x] 프로덕션 DB 최종 백업 (`data/asset.db.cutover.bak`)
- [x] 이관 스크립트 최종 실행 + 검증
- [x] `npm run build` 성공 확인

### Cutover 실행 (D-Day)

```bash
# 1. 서비스 중단
# 2. DB 최종 백업
cp data/asset.db data/asset.db.cutover.bak

# 3. 브랜치 교체
git checkout main
git merge feat/nextjs-migration

# 4. 의존성 + DB
npm install
npx prisma migrate deploy
npx tsx scripts/migrate-db.ts
npx prisma db seed

# 5. 빌드 + 시작
npm run build
npm run start

# 6. 헬스체크
curl http://localhost:4000/api/v1/health
```

### Cutover 후 정리

삭제 완료: `app/`, `frontend/`, `requirements.txt`, `pytest.ini`, `*.bat`, Python 테스트, Python 캐시

**완료 기준:** `npm run build && npm run start` 단일 명령으로 앱 실행, 44개 테스트 pass ✅

---

## 롤백 절차 (15분 내)

Next.js 전환 후 문제 발생 시:

```bash
# 1. Next.js 서버 중단
# Ctrl+C 또는 npm run start 프로세스 종료

# 2. DB 복원
cp data/asset.db.cutover.bak data/asset.db

# 3. 코드 복원
git checkout pre-nextjs-migration
```

추가 DB 백업이 필요한 경우:

```bash
cp data/asset.db.pre-migration.bak data/asset.db
cp data/toss_credentials.json.bak data/toss_credentials.json
```

---

## Definition of Done

- [x] Python 코드(`app/`, `frontend/`, `requirements.txt`) 전부 제거
- [x] `npm run build && npm run start` 단일 명령으로 앱 실행
- [x] Vitest 44개 테스트 100% pass (`npm test -- --run`)
- [x] 기존 `data/asset.db` 이관 후 모든 페이지 정상 동작
- [x] 카드 정산, 환급, 이체, 투자 매수/매도 등 핵심 금융 로직 검증
- [x] DB 백업/복구 동작
- [x] Toss/Yahoo 시세 조회 동작

---

## 핵심 파일 매핑

| Python (레거시) | TypeScript (신규) |
|-----------------|-------------------|
| `app/models/__init__.py` | `prisma/schema.prisma` |
| `app/services/bank_transfers.py` | `src/lib/services/bank-transfers.ts` |
| `app/services/card_payments.py` | `src/lib/services/card-payments.ts` |
| `app/routers/*.py` (20개) | `src/app/api/v1/*/route.ts` |
| `frontend/src/pages/*.tsx` | `src/app/**/page.tsx` |
| `frontend/src/components/**` | `src/components/**` |
