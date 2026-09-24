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
- **서비스**: `src/lib/services/*` — 가계부 이체·카드 정산·스냅샷·예산 등.
- **시작 시**: `src/instrumentation.ts` — `initializeAll`, `processDueCardPayments`.

## 건강 도메인

- **API**: `src/app/api/dashboard`, `weight`, `running`, `diet`, `settings`, `integrations/google-sheets`.
- **응답**: `jsonResponse` / `errorResponse` (`src/lib/care/utils.ts`).
- **서비스·계산**: `src/lib/care/services`, `src/lib/care/calculations`.
- **UI 격리**: `src/components/care/*` (Toast `Providers`는 루트 layout에 포함).

## 통합 UI

- `src/components/layout/AppLayout.tsx`: 자산·건강 공통 사이드바·모바일 네비.
- `src/app/page.tsx`: 자산 API + `CareDashboardSection` → `/api/dashboard`.

## 설정 화면

- 자산: `src/app/settings/[[...slug]]/page.tsx` (catch-all).
- 건강: 동일 파일 내 `/settings/health` → `HealthSettingsPanel`.

## 인증

없음 (개인 로컬 앱).

## 관련 문서

- [DATA_FLOW.md](DATA_FLOW.md)
- [API.md](API.md)
- [DATABASE.md](DATABASE.md)
