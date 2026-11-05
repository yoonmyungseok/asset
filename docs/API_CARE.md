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
| POST | `/api/integrations/google-sheets/running/sync` | DB → 시트 동기화 (Daily_Log: 전 날짜 upsert + 오늘 2행 pin) |

미설정 시 sync는 **503** + 한국어 메시지.

라우트 목록은 `src/app/api/{dashboard,weight,running,diet,settings,integrations}/**/route.ts` 기준 — **2026-09-24** 검증.

## 로컬 AI 러닝 보고서

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/running/insights` | 저장된 최신 분석·계획과 러닝 목표 조회. 보고서가 없으면 각각 null |
| PUT | `/api/running/insights` | `goal` 문자열(최대 500자) 저장. 빈 문자열로 삭제 |
| POST | `/api/running/insights` | `kind` (`analysis` 또는 `plan`), 선택 `context` (최대 2000자)로 생성 및 저장 |

분석은 오늘의 러닝과 구간 기록을, 계획은 최근 28일 기록을 Ollama에 전달한다. 페이스와 통계는 서버에서 계산하며 해당 범위에 활동 기록이 없거나 Ollama에 연결할 수 없으면 오류를 반환한다. 기본 모델은 `running-coach`, 서버 환경 변수 `OLLAMA_MODEL`로 변경 가능하다. Ollama는 `127.0.0.1:11434`에서 실행되어야 한다.
