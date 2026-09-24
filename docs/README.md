# 설계 문서 (생활·자산 통합 앱)

개인용 **자산·가계부**와 **건강(체중·러닝·식단)** 을 하나의 Next.js 앱으로 운영한다. 이 디렉터리는 통합 이후의 **현재 구조**를 설명한다.

## 읽는 순서

| 문서 | 내용 |
|------|------|
| [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) | 목적, 스택, 화면·API 요약 |
| [ARCHITECTURE.md](ARCHITECTURE.md) | 두 도메인 레이어, 공유 DB·레이아웃 |
| [DIRECTORY_STRUCTURE.md](DIRECTORY_STRUCTURE.md) | 저장소 트리 |
| [DATA_FLOW.md](DATA_FLOW.md) | 대표 요청 흐름 |
| [DATABASE.md](DATABASE.md) | Prisma 모델·마이그레이션·시드 |
| [API.md](API.md) | HTTP API 개요 (자산 vs 건강) |
| [API_V1.md](API_V1.md) | 자산·가계부 `/api/v1/*` 상세 |
| [API_CARE.md](API_CARE.md) | 건강 `/api/*` 상세 |
| [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) | 설치, 스크립트, 검증, AI 작업 |
| [DECISIONS.md](DECISIONS.md) | 주요 설계 결정 |

## 아카이브 (역사)

| 경로 | 내용 |
|------|------|
| [MIGRATION.md](MIGRATION.md) | FastAPI+Vite → Next.js 자산 앱 전환 체크리스트 |
| `migration-api-samples/` | 전환 시 API 응답 샘플 JSON |
| `migration-baseline-tests.txt` | 전환 전 pytest baseline |

레거시 **self-care** 단독 앱 DB 이관은 [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md#레거시-self-care-db)를 본다.

## 에이전트

- Cursor 규칙: [`.cursor/rules/`](../.cursor/rules/)
- 진입점: [`AGENTS.md`](../AGENTS.md)
- 사용자 설치 요약: [`README.md`](../README.md)
