# HTTP API

Base path: `/api`. 응답은 JSON (`Content-Type: application/json`). 공통 헬퍼: `jsonResponse`, `errorResponse` (`src/lib/utils.ts`).

## Dashboard

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/dashboard` | 대시보드 집계 (`getDashboardData`) |

## Settings

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/settings` | `UserSettings` |
| PUT | `/api/settings` | body: `settingsSchema` |

## Weight

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/weight` | `?date=` 단일일 또는 전체 목록+stats+chart (`?days=` 기본 30) |
| POST | `/api/weight` | 생성 |
| GET | `/api/weight/[id]` | 단건 |
| PUT | `/api/weight/[id]` | 수정 |
| DELETE | `/api/weight/[id]` | 삭제 |

## Running

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/running` | `?date=` 단일일 목록 또는 `?days=`(기본 30) + 통계 |
| POST | `/api/running` | 기록 생성 (splits 포함 가능) |
| GET | `/api/running/[id]` | 단건 + splits |
| PUT | `/api/running/[id]` | 수정 |
| DELETE | `/api/running/[id]` | 삭제 |
| GET | `/api/running/types` | 타입 목록 |
| POST | `/api/running/types` | 타입 추가 |
| PUT | `/api/running/types/[id]` | 타입 수정 |
| DELETE | `/api/running/types/[id]` | 타입 삭제 |

## Diet

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/diet` | `?date=` 식단 |
| POST | `/api/diet/entries` | 음식 항목 추가 |
| PUT | `/api/diet/entries/[id]` | 항목 수정 |
| DELETE | `/api/diet/entries/[id]` | 항목 삭제 |
| GET | `/api/diet/food-items` | 음식 DB |
| POST | `/api/diet/food-items` | 음식 추가 |
| PUT | `/api/diet/food-items/[id]` | 수정 |
| DELETE | `/api/diet/food-items/[id]` | 삭제 |

## Google Sheets

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/integrations/google-sheets/status` | 설정·자격 증명 상태 |
| GET | `/api/integrations/google-sheets/settings` | Sheets UI 설정 |
| PUT | `/api/integrations/google-sheets/settings` | `googleSheetsSettingsSchema` |
| GET | `/api/integrations/google-sheets/inspect` | 스프레드시트/시트 구조 점검 |
| GET | `/api/integrations/google-sheets/presets/daily-log-ko` | 한국어 daily log 프리셋 |
| POST | `/api/integrations/google-sheets/running/sync` | DB → Sheets 동기화 |

동기화 미설정 시 POST sync는 503 + 한국어 메시지 (`running/sync/route.ts`).

## 검증

Request body 스키마: `src/lib/validations/schemas.ts` (`settingsSchema`, `validateRunningRecord`, `googleSheetsSettingsSchema`, …).
