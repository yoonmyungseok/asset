<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 통합 앱 (자산 + 건강)

- 자산 API: `/api/v1/*`, 건강 API: `/api/*` (체중·러닝·식단·dashboard)
- 건강 코드: `src/lib/care/`, UI: `src/components/care/`
- 설계 문서 읽는 순서: [docs/README.md](docs/README.md) → `PROJECT_OVERVIEW` → `ARCHITECTURE` / `API_*` / `DATABASE` / `DATA_FLOW`
- 코드 변경 시 문서: [DEVELOPMENT_GUIDE.md §문서 수정](docs/DEVELOPMENT_GUIDE.md#문서-수정)
- Cursor 규칙 (`.cursor/rules/`): `project-core`, `safety`, `architecture-asset`, `architecture-care`, `coding-standards-asset`, `coding-standards-care`, `testing`
