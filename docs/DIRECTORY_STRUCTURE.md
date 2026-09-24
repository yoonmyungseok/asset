# 디렉터리 구조

저장소 루트 `asset/` 기준 (주요 경로).

```text
asset/
├── .cursor/rules/           # Agent 규칙 (자산·건강 분리)
├── data/                    # SQLite (기본 asset.db)
├── docs/                    # 설계 문서 (본 디렉터리)
├── prisma/
│   ├── schema.prisma        # 자산 + 건강 모델
│   ├── migrations/
│   └── seed.ts              # 자산 시드 + runCareSeed()
├── scripts/
│   ├── run-prisma.ts        # DATABASE_URL 정규화
│   ├── migrate-db.ts        # 레거시 자산 DB
│   ├── migrate-self-care-db.ts
│   └── restart-launch.ps1
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/          # 자산 API
│   │   │   ├── dashboard/   # 건강 대시보드
│   │   │   ├── weight|running|diet|settings/
│   │   │   └── integrations/google-sheets/
│   │   ├── page.tsx         # 통합 홈
│   │   ├── ledger/
│   │   ├── investment/
│   │   ├── weight|running|diet|…
│   │   └── settings/[[...slug]]/
│   ├── components/
│   │   ├── layout/          # AppLayout, AppInitializer
│   │   └── care/            # 건강 UI
│   ├── lib/
│   │   ├── db.ts
│   │   ├── api/             # v1 클라이언트, route-utils
│   │   ├── services/        # 자산 서비스
│   │   ├── validations/     # 자산 Zod
│   │   ├── external/        # Toss, 시세
│   │   ├── decimal.ts
│   │   └── care/            # 건강 전용 레이어
│   └── instrumentation.ts
├── tests/                   # 자산 통합·단위 테스트
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
