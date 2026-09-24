# 아키텍처

## 전체 형태

단일 Next.js 프로세스가 UI와 API를 함께 서빙한다. 두 도메인은 **URL·코드 경로**로 나뉘고 **SQLite 한 파일**을 공유한다.

```
                    ┌─────────────────────────────────────┐
                    │  src/app/layout.tsx + AppLayout      │
                    └─────────────────────────────────────┘
                          │                    │
              ┌───────────┴────────┐    ┌──────┴──────────────┐
              │ 자산 페이지         │    │ 건강 페이지          │
              │ ledger, investment │    │ weight, running…    │
              └───────────┬────────┘    └──────┬──────────────┘
                          │                    │
                   api/client.ts          fetch('/api/...')
                          │                    │
              ┌───────────▼────────┐    ┌──────▼──────────────┐
              │ app/api/v1/*       │    │ app/api/{dashboard, │
              │                    │    │  weight,running…}   │
              └───────────┬────────┘    └──────┬──────────────┘
                          │                    │
              ┌───────────▼────────┐    ┌──────▼──────────────┐
              │ lib/services       │    │ lib/care/services   │
              │ lib/external       │    │ lib/care/calculations│
              │ lib/data           │    │ lib/care/format     │
              │ lib/decimal        │    │ lib/care/integrations│
              └───────────┬────────┘    └──────┬──────────────┘
                          │                    │
                          └────────┬───────────┘
                                   ▼
                          lib/db.ts → Prisma
                                   ▼
                          data/asset.db (SQLite)
```

## 자산 도메인

- **API**: `src/app/api/v1/**/route.ts` — FastAPI 시절과 호환되는 경로·에러 형식(`detail`) 유지.
- **응답**: `jsonOk` / `apiError` (`src/lib/api/route-utils.ts`, `src/lib/api-error.ts`).
- **클라이언트**: `src/lib/api/client.ts` — UI는 `/api/v1`만 사용.
- **서비스** (`src/lib/services/`):
  - `core.ts` — 초기화·공통
  - `bank-transfers.ts`, `card-payments.ts` — 이체·카드 정산
  - `ledger-transactions.ts`, `ledger-comparison.ts` — 가계부
  - `holdings.ts`, `investment-transactions.ts` — 투자
  - `budgets.ts`, `recurring-items.ts` — 예산·반복
  - `dashboard-overview.ts`, `dashboard-insights.ts` — 대시보드 집계·인사이트
- **시세**: `src/lib/external/market-data.ts` (Yahoo chart 등), `toss-invest.ts` (Toss Open API).
- **정적 참조**: `src/lib/data/institutions.ts` → `GET /api/v1/institutions` (DB 모델 없음).
- **표시**: `src/lib/utils/format.ts`, `ledger.ts` 등.
- **시작 시**: `src/instrumentation.ts` — `initializeAll`, `processDueCardPayments`.

## 건강 도메인

- **API**: `src/app/api/dashboard`, `weight`, `running`, `diet`, `settings`, `integrations/google-sheets`.
- **응답**: `jsonResponse` / `errorResponse` (`src/lib/care/utils.ts`).
- **서비스**: `src/lib/care/services/` — `dashboard`, `settings`, `running-types`, `google-sheets-settings`.
- **계산**: `src/lib/care/calculations/` — `weight`, `running`, `diet`, `nutrition-goals`.
- **표시**: `src/lib/care/format/running-text.ts`.
- **기본값**: `running-type-defaults.ts`, `constants.ts`.
- **Sheets**: `src/lib/care/integrations/google-sheets/` — `running-sync`, `header-map`, `service-account` 등.
- **UI**: `src/components/care/*` — 루트 `layout`의 `Providers`(Toast) 포함.

## 통합 UI

- `AppLayout`: 사이드바·모바일 하단 네비, 헤더 순자산(`GET /api/v1/dashboard/overview`), `RefreshContext`로 `POST /api/v1/dashboard/refresh` 후 `dashboard-refreshed` 이벤트.
- `src/app/page.tsx`: 자산 overview + `CareDashboardSection` → `GET /api/dashboard`.

## 설정 화면

- `src/app/settings/[[...slug]]/page.tsx` catch-all.
- `/settings` — 자산·앱 설정.
- `/settings/health` — `HealthSettingsPanel` (건강 프로필·Sheets).

## 인증

없음 (개인 로컬 앱).

## 관련 문서

- [DATA_FLOW.md](DATA_FLOW.md)
- [API.md](API.md)
- [DATABASE.md](DATABASE.md)
