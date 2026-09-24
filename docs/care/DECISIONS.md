# 설계·운영 결정 (코드에서 확인된 내용)

## SQLite + db push

- `datasource` provider `sqlite`, URL은 `DATABASE_URL`.
- 저장소에 migration 히스토리 폴더 없음; 개발 워크플로는 `npm run db:push` / `db:seed` 중심 (README).

## 단일 사용자 설정 행

- `UserSettings`는 앱 전역 설정 1건 패턴 (`findFirst`, 없으면 create).
- Google Sheets 연동 필드도 동일 모델에 colocated (`googleSpreadsheetId`, sheet names, header map JSON strings, …).

## 러닝 타입

- DB `RunningType` + 기본 시드 값 `DEFAULT_RUNNING_TYPES` (`running-type-defaults.ts`).
- `excludeFromStats`: 거리·페이스 집계에서 제외 (예: 휴식).

## API 스타일

- RESTful Route Handlers, 세션/인증 미들웨어 없음.
- 오류 메시지 한국어, HTTP status 400/500/503 등 route별 사용.

## Google Sheets

- OAuth 사용자 로그인이 아니라 **서비스 계정** (`googleapis` JWT).
- 기존 스프레드시트 탭·1행 헤더를 존중; 헤더 alias JSON으로 열 매핑.
- Upsert 키: `googleRunningUpsertKey` / `googleRunningSplitUpsertKey` (기본 `record_id`, `record_id_split`).

## UI 데이터 로딩

- 주요 CRUD 페이지는 Client Component + `fetch('/api/...')` + local state (Server Actions 미사용).

## Next.js 에이전트 파일

- `AGENTS.md` 상단 블록은 `next dev`가 재생성할 수 있음 (`generate-agent-files.js` 주석).
- `CLAUDE.md`는 `@AGENTS.md`만 참조.

## 문서 중복 방지

- 설치·seed 요약: `README.md`
- 에이전트 행동 규칙: `.cursor/rules/`
- 구조·흐름: `docs/` (본 디렉터리)
