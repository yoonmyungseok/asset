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

### 자산 도메인

| Model | 용도 |
|-------|------|
| `AccountType` | 계좌 유형 마스터 |
| `Account` | 계좌·현금 잔액 |
| `Holding` | 보유 종목·예금 등 |
| `InvestmentTransaction` | 매수·매도·입출금 등 |
| `AccountYearlyLimit` | 연간 납입 한도 |
| `Category` | 가계부 카테고리 (트리) |
| `PaymentMethod` | 결제 수단 |
| `LedgerTransaction` | 가계부 거래 |
| `Tag` | 거래 태그 |
| `LedgerTransactionTag` | 거래–태그 M:N |
| `Card` | 카드 |
| `CardSettlement` | 카드 월별 정산 기록 |
| `Liability` | 부채 |
| `LiabilityTransaction` | 부채 거래 |
| `RecurringItem` | 반복 항목 |
| `Budget` | 월별 예산 |
| `DailySnapshot` | 일별 순자산 스냅샷 |
| `AccountSnapshot` | 계좌별 일 스냅샷 |
| `LiabilitySnapshot` | 부채별 일 스냅샷 |

금융기관 목록 API(`GET /api/v1/institutions`)는 Prisma 모델이 아니라 `src/lib/data/institutions.ts` 정적 데이터다.

### 건강 도메인 (`// Self Care` 섹션)

| Model | 용도 |
|-------|------|
| `UserSettings` | 프로필·영양 목표·Google Sheets (단일 행 패턴) |
| `WeightRecord` | 일별 체중 (`date` unique) |
| `RunningType` | 러닝 타입 마스터 |
| `RunningRecord` | 러닝 기록 |
| `RunningSplit` | 러닝 스플릿 |
| `Meal` | 일별 끼니 (`date` + `mealType` unique) |
| `FoodEntry` | 식단 항목 |
| `FoodItem` | 음식 DB |

자산·건강 FK는 **서로 연결하지 않는다** (동일 DB 파일만 공유).

## 마이그레이션

```bash
npm run db:migrate
```

| Migration | 설명 |
|-----------|------|
| `20260910110218_init` | 자산 스키마 초기 |
| `20260910142000_restore_unique_indexes` | 유니크 인덱스 복구 |
| `20260912000000_add_investment_transaction_tax` | `InvestmentTransaction.tax` |
| `20260912100000_add_holding_book_cost` | `Holding.book_cost` |
| `20260924100000_add_self_care_tables` | 건강(Self Care) 테이블 |

개발 중 스키마만 맞출 때: `npm run db:push` (팀 정책에 따름).

## 시드

```bash
npm run db:seed
```

- 자산: `prisma/seed.ts` — 계좌 유형, 카테고리, 결제 수단 등
- 건강: `src/lib/care/seed.ts` (`runCareSeed()`)

## 레거시 이관

| 스크립트 | 용도 |
|----------|------|
| `npm run db:import` | 이전 `asset.db` → Prisma DB |
| `npm run db:migrate-care` | self-care `dev.db` → 통합 DB |

## 로컬 파일

`data/*.db`는 일반적으로 git에 포함하지 않는다.
