# 데이터베이스

## 연결

| 항목 | 값 |
|------|-----|
| Provider | SQLite |
| 기본 URL | `file:./data/asset.db` (`.env.example`) |
| 경로 해석 | `src/lib/database-path.ts` |
| CLI | `npm run db:*` → `scripts/run-prisma.ts`가 `DATABASE_URL` 설정 |
| Client | `src/lib/db.ts` (싱글톤) |

## 스키마

파일: `prisma/schema.prisma`

### 자산 도메인 (요약)

| Model | 용도 |
|-------|------|
| `AccountType`, `Account`, `Holding`, `InvestmentTransaction` | 투자·계좌 |
| `Category`, `PaymentMethod`, `LedgerTransaction`, `Tag` | 가계부 |
| `Card`, `CardSettlement` | 카드 |
| `Liability`, `LiabilityTransaction` | 부채 |
| `RecurringItem`, `Budget` | 반복·예산 |
| `DailySnapshot`, `AccountSnapshot`, `LiabilitySnapshot` | 스냅샷 |
| `AccountYearlyLimit` | 연간 한도 |

### 건강 도메인 (`// Self Care` 섹션)

| Model | 용도 |
|-------|------|
| `UserSettings` | 프로필·영양 목표·Google Sheets (단일 행 패턴) |
| `WeightRecord` | 일별 체중 (`date` unique) |
| `RunningType`, `RunningRecord`, `RunningSplit` | 러닝 |
| `Meal`, `FoodEntry`, `FoodItem` | 식단 |

자산·건강 FK는 **서로 연결하지 않는다** (동일 DB 파일만 공유).

## 마이그레이션

```bash
npm run db:migrate
```

건강 테이블 추가 예: `prisma/migrations/20260924100000_add_self_care_tables/`.

개발 중 스키마만 맞출 때: `npm run db:push` (팀 정책에 따름).

## 시드

```bash
npm run db:seed
```

- 자산: 계좌 유형, 카테고리, 결제 수단 등
- 건강: `src/lib/care/seed.ts`

## 레거시 이관

| 스크립트 | 용도 |
|----------|------|
| `npm run db:import` | 이전 `asset.db` → Prisma DB |
| `npm run db:migrate-care` | self-care `dev.db` → 통합 DB |

## 로컬 파일

`data/*.db`는 일반적으로 git에 포함하지 않는다.
