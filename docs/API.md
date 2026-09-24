# HTTP API 개요

## 두 개의 API 표면

| | 자산 | 건강 |
|---|------|------|
| Base path | `/api/v1` | `/api` |
| 호환성 | FastAPI 앱과 경로·에러 형식 유지 | self-care 단독 앱과 동일 prefix |
| 성공 응답 | `jsonOk` | `jsonResponse` |
| 오류 | `apiError` (`detail`) | `errorResponse` (한국어 메시지) |
| Zod | `src/lib/validations/*` | `src/lib/care/validations/schemas.ts` |

건강 API를 `/api/v1` 아래에 두지 않는다 (자산 라우트와 충돌·호환 분리).

## 상세 문서

- [API_V1.md](API_V1.md) — 자산·가계부·투자 전체 라우트
- [API_CARE.md](API_CARE.md) — 체중·러닝·식단·Sheets

## 헬스체크

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/health` | `{ "status": "ok" }` |

## 클라이언트 사용

- **자산 UI**: `src/lib/api/client.ts` — 모든 메서드가 `/api/v1` prefix.
- **건강 UI**: 각 페이지 `fetch('/api/...')` — client wrapper 없음.

## 금액 직렬화 (자산)

`Decimal` / `Prisma.Decimal`은 JSON에서 **문자열**로 직렬화된다 (`src/lib/decimal.ts`, `route-utils` replacer).

라우트 상세 목록: [API_V1.md](API_V1.md), [API_CARE.md](API_CARE.md) — **2026-09-24** 검증.
