# 설계 결정

## 통합 앱 (자산 + 건강)

- **한 저장소·한 DB·한 dev 서버** (포트 4000).
- 건강 코드는 `src/lib/care/`, UI는 `src/components/care/`로 네임스페이스 격리.
- HTTP: 자산 `/api/v1/*`, 건강 `/api/*` — 경로·클라이언트·에러 헬퍼를 도메인별로 유지.
- 홈 `/`는 자산 대시보드와 건강 `CareDashboardSection`을 함께 표시.
- 건강 설정 UI는 `/settings/health` (자산 `/settings`와 분리).

## 자산: FastAPI 호환

- Next 전환 후에도 `/api/v1` 응답·`detail` 오류 형식 유지 ([MIGRATION.md](MIGRATION.md)).
- 금액은 `Decimal` + API 문자열 직렬화.
- 서버 기동 시 `instrumentation.ts`에서 초기화·카드 정산 처리.

## 건강: self-care 계승

- REST Route Handler, 세션 없음, 한국어 오류 메시지.
- `UserSettings` 단일 행, Google Sheets는 서비스 계정 JWT.
- 러닝 타입 `excludeFromStats`로 집계 제외.

## 데이터베이스

- SQLite 단일 파일 (`data/asset.db`).
- Prisma **migrate** 워크플로 (`npm run db:migrate`).
- 자산·건강 모델은 스키마 한 파일, **FK로 묶지 않음**.

## UI 데이터 로딩

- 자산: `src/lib/api/client.ts`.
- 건강: Client Component + `fetch('/api/...')` (Server Actions 미사용).

## Next.js 에이전트

- `AGENTS.md` 상단 블록은 `next dev`가 재생성할 수 있음 — 커밋 시 함께 두거나 재생성 허용.

## 문서

- 현재 구조: `docs/` (본 디렉터리, [README.md](README.md)).
- 역사: `docs/MIGRATION.md`, `migration-api-samples/` — **현행 앱 설명은 docs/README·PROJECT_OVERVIEW를 본다.**
- 에이전트 진입: `AGENTS.md` + `.cursor/rules/` — 상세 설계는 `docs/`에만 두고 rules에는 경계·경로만 유지.
- 코드 변경 시 문서 매트릭스: [DEVELOPMENT_GUIDE.md §문서 수정](DEVELOPMENT_GUIDE.md#문서-수정).
- API 표는 `src/app/api/**/route.ts`와 `API_V1` / `API_CARE`를 동기화한다 (`scripts/doc-audit.ts`로 목록 추출 가능).
