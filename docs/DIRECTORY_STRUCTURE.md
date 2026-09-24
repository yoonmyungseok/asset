# 디렉터리 구조

저장소 루트 `asset/` 기준 (주요 경로).

```text
asset/
├── .cursor/rules/              # Agent 규칙 (자산·건강 분리)
├── data/                       # SQLite (기본 asset.db)
├── docs/                       # 설계 문서 (본 디렉터리)
├── prisma/
│   ├── schema.prisma           # 자산 + 건강 모델
│   ├── migrations/
│   └── seed.ts                 # 자산 시드 + runCareSeed()
├── scripts/
│   ├── run-prisma.ts           # DATABASE_URL 정규화, db CLI
│   ├── migrate-db.ts           # 레거시 자산 DB
│   ├── migrate-self-care-db.ts # self-care → 통합 DB
│   ├── fix-decimal-schema.ts   # 개발용 스키마 수정
│   ├── fix-datetime.ts         # 개발용 datetime 수정
│   ├── port-self-care.mjs      # 일회성 self-care 소스 포팅
│   ├── doc-audit.ts            # API route·page 목록 (문서 동기화 점검)
│   └── restart-launch.ps1      # dev 서버 재시작 (Windows)
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/             # 자산 API
│   │   │   ├── dashboard/      # 건강 대시보드
│   │   │   ├── weight/, running/, diet/, settings/
│   │   │   └── integrations/google-sheets/
│   │   ├── page.tsx            # 통합 홈
│   │   ├── ledger/             # page, budget/, analysis/
│   │   ├── investment/         # page, accounts/[id]/
│   │   ├── weight/, running/, running-settings/
│   │   ├── diet/, food-settings/
│   │   └── settings/[[...slug]]/
│   ├── components/
│   │   ├── layout/             # AppLayout, AppInitializer
│   │   └── care/               # 건강 UI
│   │       ├── ui/             # Button, Modal, Toast, …
│   │       ├── charts/
│   │       ├── CareDashboardSection.tsx
│   │       └── HealthSettingsPanel.tsx
│   ├── lib/
│   │   ├── db.ts
│   │   ├── database-path.ts
│   │   ├── decimal.ts, config.ts, api-error.ts, service-error.ts
│   │   ├── api/                # client.ts, route-utils, serializers
│   │   ├── services/           # 자산 도메인 서비스 (*.ts)
│   │   ├── validations/        # 자산 Zod
│   │   ├── external/           # toss-invest, market-data
│   │   ├── data/               # institutions (정적 목록)
│   │   ├── utils/              # format, ledger, account-*
│   │   └── care/
│   │       ├── services/
│   │       ├── calculations/
│   │       ├── format/
│   │       ├── validations/
│   │       ├── integrations/google-sheets/
│   │       ├── seed.ts, utils.ts, constants.ts
│   │       └── **/__tests__/   # 건강 단위 테스트
│   └── instrumentation.ts
├── tests/
│   ├── setup.ts, helpers/
│   ├── integration/            # api.test.ts
│   └── unit/                   # 자산 단위 테스트
├── vitest.config.ts
├── .env.example
├── AGENTS.md
├── README.md
├── restart.bat
└── package.json
```

## 무시·로컬 only

- `.env`, `data/*.db`, Google 서비스 계정 JSON — 커밋 금지
- `.next/`, `node_modules/`

## 레거시 저장소

- `self-care/` (별도 git): 이전 단독 건강 앱. 통합 코드는 `src/lib/care`에만 유지한다.
