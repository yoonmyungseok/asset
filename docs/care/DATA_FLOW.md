# 데이터 흐름

## 공통 패턴

1. 클라이언트 페이지가 `useEffect` 등에서 `/api/...` 호출
2. Route Handler가 Zod로 body/query 검증
3. `lib/services` 또는 route 내 Prisma 호출
4. 필요 시 `lib/calculations`로 가공 후 JSON 반환

날짜 필드는 대부분 **`yyyy-MM-dd` 문자열** (`formatDate`, `todayString` in `lib/utils.ts`).

## 대시보드

```
GET /api/dashboard
  → getDashboardData() [services/dashboard.ts]
  → prisma: weightRecord, runningRecord, meal(+foodEntries)
  → getSettings(), getRestDayTypeSet(), getRunningTypes()
  → calculations: weight stats, running sums/pace, nutrition summary
  → JSON (targets, weight, running, diet, chart payloads, …)
```

`src/app/page.tsx`가 위 API를 consume.

## 체중

```
GET /api/weight?date= | ?days=
POST /api/weight            → validate → prisma.weightRecord
GET/PUT/DELETE /api/weight/[id]
```

`/weight` 페이지 → 해당 API.

## 러닝

```
GET /api/running?date= | ?days=
POST /api/running         → validateRunningRecord, pace 계산, splits 생성
GET/PUT/DELETE /api/running/[id]

GET/POST /api/running/types
PUT/DELETE /api/running/types/[id]
```

- 통계에서 제외할 타입: `RunningType.excludeFromStats` (예: `rest`)
- `GET /api/running` (days 기본 30): 주/월 거리, 최근 기록 등 집계 포함

## 식단

```
GET /api/diet?date=
POST /api/diet/entries
PUT/DELETE /api/diet/entries/[id]

GET/POST /api/diet/food-items
PUT/DELETE /api/diet/food-items/[id]
```

- `Meal`: `(date, mealType)` unique
- `FoodEntry`: meal에 연결, 칼로리·매크로 저장

## 설정

```
GET/PUT /api/settings  → settingsSchema → getSettings / updateSettings
```

영양 목표는 프로필(키, 몸무게, 활동량 등)과 최근 체중으로 `calculateNutritionGoals` 재계산될 수 있음 (`settings.ts`).

## Google Sheets (러닝 내보내기)

```
GET  /api/integrations/google-sheets/status
GET  /api/integrations/google-sheets/settings
PUT  /api/integrations/google-sheets/settings
GET  /api/integrations/google-sheets/inspect
GET  /api/integrations/google-sheets/presets/daily-log-ko
POST /api/integrations/google-sheets/running/sync
```

흐름 (동기화):

1. `isGoogleSheetsConfigured()` — 서비스 계정 env
2. `getGoogleSheetsSettings()` — spreadsheet ID, 시트 탭명, header map JSON
3. Prisma에서 러닝·스플릿 읽기
4. 시트 1행 헤더와 매핑 → `upsertSheetRows`
5. `googleSheetsLastSyncedAt` 갱신

UI: `src/app/settings/page.tsx`에서 Sheets 관련 설정·동기화 버튼.

## Seed

`npm run db:seed` → `prisma/seed.ts`가 샘플 체중·러닝·음식·식단·설정 생성 (README 설명과 일치).
