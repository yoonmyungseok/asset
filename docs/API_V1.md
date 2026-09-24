# 자산 HTTP API (`/api/v1`)

응답 헬퍼: `src/lib/api/route-utils.ts`, 오류: `src/lib/api-error.ts`.  
검증: `src/lib/validations/*`.

## System

| Method | Path |
|--------|------|
| GET | `/api/v1/health` |
| POST | `/api/v1/setup/initialize` |
| GET | `/api/v1/backup` |
| POST | `/api/v1/backup/restore` |

## Dashboard

| Method | Path |
|--------|------|
| GET | `/api/v1/dashboard/overview` |
| POST | `/api/v1/dashboard/refresh` |
| GET | `/api/v1/dashboard/net-worth-trend` |
| GET | `/api/v1/dashboard/cashflow-trend` |
| GET | `/api/v1/dashboard/account-performance` |

## Accounts & limits

| Method | Path |
|--------|------|
| GET, POST | `/api/v1/accounts` |
| GET, PATCH, DELETE | `/api/v1/accounts/[accountId]` |
| POST | `/api/v1/accounts/[accountId]/deactivate` |
| GET, POST | `/api/v1/account-types` |
| GET, PUT | `/api/v1/account-limits` |
| DELETE | `/api/v1/account-limits/[limitId]` |

## Holdings & investments

| Method | Path |
|--------|------|
| GET, POST | `/api/v1/holdings` |
| PATCH, DELETE | `/api/v1/holdings/[holdingId]` |
| POST | `/api/v1/holdings/refresh-prices` |
| GET, POST | `/api/v1/investment-transactions` |
| GET, PATCH, DELETE | `/api/v1/investment-transactions/[transactionId]` |

## Ledger

| Method | Path |
|--------|------|
| GET, POST | `/api/v1/ledger-transactions` |
| PATCH, DELETE | `/api/v1/ledger-transactions/[transactionId]` |
| GET | `/api/v1/ledger-transactions/summary` |

## Categories, tags, payment methods

| Method | Path |
|--------|------|
| GET, POST | `/api/v1/categories` |
| PATCH, DELETE | `/api/v1/categories/[categoryId]` |
| POST | `/api/v1/categories/seed` |
| GET, POST | `/api/v1/tags` |
| DELETE | `/api/v1/tags/[tagId]` |
| GET, POST | `/api/v1/payment-methods` |
| DELETE | `/api/v1/payment-methods/[methodId]` |

## Cards & liabilities

| Method | Path |
|--------|------|
| GET, POST | `/api/v1/cards` |
| PATCH, DELETE | `/api/v1/cards/[cardId]` |
| POST | `/api/v1/cards/process-settlements` |
| GET, POST | `/api/v1/liabilities` |
| PATCH, DELETE | `/api/v1/liabilities/[liabilityId]` |
| GET, POST | `/api/v1/liabilities/[liabilityId]/transactions` |

## Budgets & recurring

| Method | Path |
|--------|------|
| GET, PUT | `/api/v1/budgets` |
| DELETE | `/api/v1/budgets/[budgetId]` |
| GET | `/api/v1/budgets/alerts` |
| GET, POST | `/api/v1/recurring-items` |
| PATCH, DELETE | `/api/v1/recurring-items/[itemId]` |
| POST | `/api/v1/recurring-items/generate` |

## Snapshots & reference

| Method | Path |
|--------|------|
| GET, POST | `/api/v1/snapshots/daily` |
| GET | `/api/v1/snapshots/accounts/[accountId]` |
| GET | `/api/v1/institutions` |

`institutions`는 DB가 아니라 `src/lib/data/institutions.ts` 정적 목록을 반환한다.

## Market (Toss)

| Method | Path |
|--------|------|
| GET | `/api/v1/market/status` |
| GET | `/api/v1/market/search` |
| GET | `/api/v1/market/quote/[symbol]` |
| PUT, DELETE | `/api/v1/market/credentials` |

쿼리 파라미터·body 스키마는 각 `route.ts`와 `src/lib/validations`를 참고한다.

라우트 목록은 `src/app/api/v1/**/route.ts` 기준 — **2026-09-24** 검증.
