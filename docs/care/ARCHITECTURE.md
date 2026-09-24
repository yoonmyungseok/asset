# 아키텍처

## 전체 형태

브라우저의 클라이언트 페이지가 **동일 출처 REST API** (`/api/*`)를 호출하고, API 라우트가 **서비스 레이어**와 **Prisma**로 SQLite에 접근한다. 통계·집계는 **calculations** 모듈의 순수 함수로 처리한다.

```
[page.tsx (client)] --fetch--> [app/api/*/route.ts]
                                      |
                                      v
                            [lib/services/*]
                                      |
                    +-----------------+------------------+
                    v                 v                  v
            [lib/calculations/*]  [prisma]    [google-sheets/*]
                    |                 |
                    +--------+--------+
                             v
                      SQLite (dev.db)
```

## API 라우트

- 파일 기반 라우팅: `src/app/api/<segment>/route.ts`
- 공통 패턴: `try/catch`, Zod `safeParse`, `jsonResponse` / `errorResponse`
- Google Sheets: `src/app/api/integrations/google-sheets/**`

## 서비스 레이어 (`src/lib/services`)

| 모듈 | 역할 |
|------|------|
| `dashboard.ts` | 대시보드 집계(체중·러닝·식단·차트 데이터) |
| `settings.ts` | `UserSettings` CRUD, 영양 목표 계산 연동 |
| `google-sheets-settings.ts` | 스프레드시트 ID·시트명·헤더 매핑 필드 |
| `running-types.ts` | `RunningType` 목록, 휴식/통계 제외 타입 |

## 계산 레이어 (`src/lib/calculations`)

- `weight.ts`, `running.ts`, `diet.ts`, `nutrition-goals.ts`
- API/서비스에서 Prisma 결과를 넘겨 받아 통계·페이스·영양 합산 등을 계산

## Google Sheets 통합

- `client.ts`: googleapis Sheets 클라이언트
- `service-account.ts`: env / JSON 파일에서 서비스 계정 로드
- `running-sync.ts`: DB 러닝·스플릿 → 시트 upsert, `syncRunningToGoogleSheets`
- `header-map.ts`, `sheet-upsert.ts`, `running-sheet-export.ts`: 헤더·행 매핑

설정 값은 `UserSettings`의 `google*` 필드와 `.env` 자격 증명을 함께 사용한다.

## UI 구성

- `src/app/layout.tsx`: Geist 폰트, `Providers`(Toast)
- `AppLayout`: 고정 사이드바 + 모바일 하단 네비
- `components/ui/*`: Button, Input, Modal, Card 등 공통 UI
- `components/charts/Charts.tsx`: Recharts 래퍼

## 설정 파일

- `next.config.ts`: `allowedDevOrigins` (개발용 호스트)
- `vitest.config.ts`: Node 환경, `@` alias
- `eslint.config.mjs`: eslint-config-next

## 인증

앱 코드베이스에 사용자 로그인/세션 레이어는 없다 (로컬 개인용 전제).
