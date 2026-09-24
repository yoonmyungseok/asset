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
PATCH/DELETE /api/v1/ledger-transactions/[transactionId]
GET /api/v1/ledger-transactions/summary
```

생성·수정 시 `bank-transfers`, `card-payments` 등이 잔액·카드 정산과 연동된다.

### 가계부 분석 `/ledger/analysis`

```
ledger/analysis/page.tsx
  → GET /api/v1/ledger-transactions/summary?year=&month=
```

## 투자·계좌

```
/investment/page.tsx
  → GET /api/v1/accounts (목록)

/investment/accounts/[id]/page.tsx
  → GET /api/v1/accounts/[id]
  → GET /api/v1/account-types
  → GET /api/v1/investment-transactions?account_id=
  → GET /api/v1/ledger-transactions?account_id=
  → GET /api/v1/account-limits
  → GET /api/v1/snapshots/accounts/[id]
  → GET /api/v1/holdings (보유 지원 계좌)
  → POST /api/v1/holdings/refresh-prices (필요 시)
  → PATCH/POST/DELETE holdings, transactions, account, limits …
```

## 예산·카드·부채

- `/ledger/budget` → `/api/v1/budgets`, `budgets/alerts`
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
/weight        → /api/weight
/running       → /api/running, /api/running/types
/running-settings → /api/running/types (CRUD)
/diet          → /api/diet, /api/diet/entries
/food-settings → /api/diet/food-items
```

각 페이지는 Client Component에서 `fetch('/api/...')` (공용 API client 없음).

## 건강 설정

```
GET/PUT /api/settings  → UserSettings
/settings/health → HealthSettingsPanel
```

## Google Sheets (러닝)

```
GET  /api/integrations/google-sheets/status
GET  /api/integrations/google-sheets/settings
PUT  /api/integrations/google-sheets/settings
GET  /api/integrations/google-sheets/inspect
GET  /api/integrations/google-sheets/presets/daily-log-ko
POST /api/integrations/google-sheets/running/sync
  → running-sync: Prisma → 시트 upsert → UserSettings.googleSheetsLastSyncedAt
```

자격 증명: `.env` 서비스 계정 + `UserSettings` 스프레드시트·헤더 매핑.

---

## 시드

`npm run db:seed` → `prisma/seed.ts` (자산 마스터) → `runCareSeed()` (`src/lib/care/seed.ts`).
