# 데이터 흐름

## 공통

- 날짜 키: 자산 가계부는 ISO datetime/날짜 필드 혼용(기존 스키마), 건강은 **`yyyy-MM-dd` 문자열** (`src/lib/care/utils.ts`).
- Prisma 클라이언트: `src/lib/db.ts` 단일 인스턴스.

---

## 통합 홈 `/`

```
page.tsx
  → GET /api/v1/dashboard/overview     (api client)
  → CareDashboardSection → GET /api/dashboard
```

---

## 자산 대시보드

```
GET /api/v1/dashboard/overview
  → dashboard-overview 서비스
  → 계좌·부채·순자산 집계

POST /api/v1/dashboard/refresh
  → 시세·스냅샷 갱신 트리거

GET /api/v1/dashboard/net-worth-trend?…
GET /api/v1/dashboard/cashflow-trend?…
GET /api/v1/dashboard/account-performance?…
```

`AppLayout`은 overview의 `net_worth`를 헤더에 표시한다.

## 가계부

```
GET/POST /api/v1/ledger-transactions
PATCH/DELETE /api/v1/ledger-transactions/[id]
GET /api/v1/ledger-transactions/summary
```

생성·수정 시 `bank-transfers`, `card-payments` 등이 잔액·카드 정산과 연동된다.

## 투자·계좌

```
GET/POST /api/v1/accounts
GET/PATCH/DELETE /api/v1/accounts/[accountId]
GET/POST /api/v1/holdings
POST /api/v1/holdings/refresh-prices
GET/POST /api/v1/investment-transactions
```

## 예산·카드·부채

- `/api/v1/budgets`, `budgets/alerts`
- `/api/v1/cards`, `cards/process-settlements`
- `/api/v1/liabilities`, `…/transactions`

---

## 건강 대시보드

```
GET /api/dashboard
  → lib/care/services/dashboard.getDashboardData
  → WeightRecord, RunningRecord, Meal/FoodEntry
  → calculations (체중·러닝·영양)
```

## 체중·러닝·식단

```
/api/weight, /api/running, /api/running/types
/api/diet, /api/diet/entries, /api/diet/food-items
```

각 `src/app/*/page.tsx`가 동일 prefix API를 호출한다.

## 건강 설정

```
GET/PUT /api/settings  → UserSettings
UI: /settings/health → HealthSettingsPanel
```

## Google Sheets (러닝)

```
PUT /api/integrations/google-sheets/settings
POST /api/integrations/google-sheets/running/sync
  → running-sync: Prisma → 시트 upsert → googleSheetsLastSyncedAt
```

자격 증명: `.env` 서비스 계정 + `UserSettings` 스프레드시트·헤더 매핑.

---

## 시드

`npm run db:seed` → `prisma/seed.ts` (자산 마스터) → `runCareSeed()` (`src/lib/care/seed.ts`).
