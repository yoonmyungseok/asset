# 디렉터리 구조

저장소 루트 기준 (주요 경로만).

```text
self-care/
├── .cursor/
│   └── rules/              # Cursor Agent 규칙 (*.mdc)
├── docs/                   # 설계 문서 (본 디렉터리)
├── prisma/
│   ├── schema.prisma       # SQLite 스키마
│   └── seed.ts             # 개발용 seed
├── public/                 # 정적 파일 (현재 비어 있거나 최소)
├── scripts/
│   ├── import-running.ts   # 로컬 Excel→DB 일회성 import (수동 실행)
│   └── restart-launch.ps1  # restart.bat 보조
├── src/
│   ├── app/
│   │   ├── api/            # REST Route Handlers
│   │   ├── diet/
│   │   ├── food-settings/
│   │   ├── running/
│   │   ├── running-settings/
│   │   ├── settings/
│   │   ├── weight/
│   │   ├── layout.tsx
│   │   ├── page.tsx        # 대시보드
│   │   └── globals.css
│   ├── components/
│   │   ├── charts/
│   │   ├── layout/         # AppLayout, Sidebar
│   │   └── ui/
│   └── lib/
│       ├── calculations/
│       ├── format/
│       ├── integrations/google-sheets/
│       ├── services/
│       ├── validations/
│       ├── constants.ts
│       ├── db.ts
│       ├── running-type-defaults.ts
│       └── utils.ts
├── .env.example
├── AGENTS.md               # Next.js 에이전트 + 프로젝트 포인터
├── CLAUDE.md               # @AGENTS.md re-export
├── README.md
├── restart.bat             # Windows dev 서버 재시작
├── next.config.ts
├── vitest.config.ts
├── eslint.config.mjs
├── tsconfig.json
└── package.json
```

## gitignore / cursorignore

- DB: `prisma/*.db*`
- env: `.env` (`.env.example`은 추적)
- 빌드: `.next/`, `node_modules/`
- `.cursorignore`: `package-lock.json` 등 AI 컨텍스트에서 제외

## 마이그레이션

`prisma/migrations` 디렉터리는 없다. README·scripts는 `db:push` / `db:migrate`를 안내하나, 저장소에는 `schema.prisma` + `seed.ts`만 확인된다.
