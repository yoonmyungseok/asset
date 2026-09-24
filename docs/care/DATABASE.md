# 데이터베이스

## 연결

- Provider: **SQLite**
- Env: `DATABASE_URL` (예: `file:./dev.db` — 경로는 Prisma 기준 `prisma/` 하위)
- Client: `@prisma/client` via `src/lib/db.ts` (dev hot-reload 싱글톤)

## 스키마 파일

`prisma/schema.prisma`

## 모델 요약

| Model | 용도 | 주요 제약 |
|-------|------|-----------|
| `UserSettings` | 목표 체중·영양·프로필·Google Sheets 설정 | 단일 행 사용 패턴 |
| `WeightRecord` | 일별 체중·생활 지표 | `date` @unique |
| `RunningType` | 러닝 종류 라벨·통계 제외 플래그 | `value` @unique |
| `RunningRecord` | 러닝 세션 | `date` index |
| `RunningSplit` | km 구간 | FK → RunningRecord, cascade delete |
| `Meal` | 날짜+끼니 | `@@unique([date, mealType])` |
| `FoodEntry` | 식사 항목 | FK → Meal |
| `FoodItem` | 음식 마스터 | `name` @unique |

## UserSettings — Google Sheets 필드

- `googleSpreadsheetId`
- `googleRunningSheetName` (default `"러닝"`)
- `googleRunningSplitSheetName` (default `"러닝_스플릿"`)
- `googleRunningHeaderMap`, `googleRunningSplitHeaderMap` (JSON 문자열, nullable)
- `googleRunningUpsertKey`, `googleRunningSplitUpsertKey`
- `googleSheetsLastSyncedAt`

## Seed

`prisma/seed.ts` — `npm run db:seed` / `db:setup` / `db:reset` 후 Prisma seed hook.

## 로컬 파일

- `prisma/dev.db` 등은 `.gitignore` 대상 (생성 후 로컬만 존재).
