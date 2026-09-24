# 건강 HTTP API (`/api`)

응답 헬퍼: `src/lib/care/utils.ts`. 검증: `src/lib/care/validations/schemas.ts`.

## Dashboard

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/dashboard` | 건강 대시보드 집계 |

## Settings

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/settings` | `UserSettings` |
| PUT | `/api/settings` | `settingsSchema` |

## Weight

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/weight` | `?date=` 또는 `?days=`(기본 30) |
| POST | `/api/weight` | 생성 |
| GET | `/api/weight/[id]` | 단건 |
| PUT | `/api/weight/[id]` | 수정 |
| DELETE | `/api/weight/[id]` | 삭제 |

## Running

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/running` | `?date=` 또는 `?days=` |
| POST | `/api/running` | 생성 (splits 가능) |
| GET | `/api/running/[id]` | 단건 + splits |
| PUT | `/api/running/[id]` | 수정 |
| DELETE | `/api/running/[id]` | 삭제 |
| GET | `/api/running/types` | 타입 목록 |
| POST | `/api/running/types` | 타입 추가 |
| PUT | `/api/running/types/[id]` | 수정 |
| DELETE | `/api/running/types/[id]` | 삭제 |

## Diet

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/diet` | `?date=` |
| POST | `/api/diet/entries` | 항목 추가 |
| PUT | `/api/diet/entries/[id]` | 수정 |
| DELETE | `/api/diet/entries/[id]` | 삭제 |
| GET | `/api/diet/food-items` | 음식 DB |
| POST | `/api/diet/food-items` | 추가 |
| PUT | `/api/diet/food-items/[id]` | 수정 |
| DELETE | `/api/diet/food-items/[id]` | 삭제 |

## Google Sheets

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/integrations/google-sheets/status` | 자격·설정 상태 |
| GET | `/api/integrations/google-sheets/settings` | UI 설정 조회 |
| PUT | `/api/integrations/google-sheets/settings` | 설정 저장 |
| GET | `/api/integrations/google-sheets/inspect` | 시트 구조 점검 |
| GET | `/api/integrations/google-sheets/presets/daily-log-ko` | 헤더 프리셋 |
| POST | `/api/integrations/google-sheets/running/sync` | DB → 시트 동기화 |

미설정 시 sync는 **503** + 한국어 메시지.
