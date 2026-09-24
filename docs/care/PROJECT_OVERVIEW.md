# 프로젝트 개요

## 목적

**Self Care**는 개인용 건강 관리 웹 대시보드다. 체중, 러닝, 식단을 기록하고 요약·차트로 확인한다.

## 기술 스택 (package.json 기준)

| 구분 | 기술 |
|------|------|
| 프레임워크 | Next.js 16.3.4 (App Router) |
| UI | React 19, Tailwind CSS 4 |
| DB | SQLite (`DATABASE_URL`, 기본 `file:./dev.db`) |
| ORM | Prisma 6 |
| 차트 | Recharts |
| 검증 | Zod 4 |
| 테스트 | Vitest 3 |
| 외부 연동 | Google Sheets API (`googleapis`) — 러닝 기록 내보내기 |

## 실행 요구사항 (README.md)

- Node.js 20+, npm 10+

## 주요 npm scripts

| script | 동작 |
|--------|------|
| `dev` | `next dev` |
| `build` | `prisma generate && next build` |
| `start` | `next start` |
| `test` | `vitest run` |
| `lint` | `eslint` |
| `db:push` | `prisma db push` |
| `db:seed` | `tsx prisma/seed.ts` |
| `db:setup` | push + seed |

## 화면 (Sidebar 기준)

| 경로 | 설명 |
|------|------|
| `/` | 대시보드 |
| `/weight` | 체중 |
| `/running` | 러닝 |
| `/running-settings` | 러닝 종류 |
| `/diet` | 식단 |
| `/food-settings` | 음식 DB |
| `/settings` | 목표·프로필·Google Sheets 설정 |

## 에이전트·문서 진입점

- Cursor 규칙: `.cursor/rules/*.mdc`
- 설계 문서: `docs/` (본 파일 포함)
- Next.js 에이전트 안내: `AGENTS.md` (자동 생성 블록 포함)
- 사용자 README: `README.md` (설치·seed 요약)
