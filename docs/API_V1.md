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

암호화폐 거래소 계좌 유형은 `CRYPTO_EXCHANGE`이며 기관은 `빗썸` 또는 `업비트`를 사용한다. 해당 계좌의 보유 종목은 `asset_class: crypto`, 심볼은 `BTC`처럼 원화 마켓 코인을 사용한다. 은행과 거래소 사이의 원화 이동은 가계부 내부이체로 기록한다.

거래소 매수는 수수료를 취득원가에 포함하며 매도는 수수료와 세금을 현금 수령액에서 차감한다. 코인별 거래 이력을 보존하기 위해 이후 매매가 있는 거래는 수정·삭제할 수 없고, 거래는 날짜순으로 입력한다. 거래 내역이 있는 코인의 수량과 원가는 보유 수정이 아닌 거래 수정으로 변경한다.

시세 갱신은 계좌에 지정된 거래소의 공개 원화 현재가를 사용하고 실패 시 기존 시세를 유지한다. 보유 종목에 수동 현재가를 설정하면 자동 시세보다 우선하며, 수동 현재가를 비우면 자동 시세를 사용한다. 코인 입출금, 코인 수수료와 자동 잔고 동기화는 지원하지 않는다.

| Method | Path |
|--------|------|
| GET, POST | `/api/v1/holdings` |
| PATCH, DELETE | `/api/v1/holdings/[holdingId]` |
| POST | `/api/v1/holdings/refresh-prices` |

보유 종목 추가 시 같은 계좌에 동일한 종목코드의 주식이 있으면 기존 보유 수량에 합산하고 평균 매입단가를 수량 가중 평균으로 계산한다. 장부금액을 입력한 보유분은 해당 금액을 합산하며, 입력하지 않은 보유분은 수량과 평균 매입단가로 추정한다. 예금은 금리와 만기 구분을 위해 별도로 추가한다.
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

## Recurring items

| Method | Path |
|--------|------|
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
