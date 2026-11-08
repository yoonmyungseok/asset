-- 매도 취소 시 원 단위 반올림 손실 없이 기존 원가를 복원한다.
ALTER TABLE "investment_transactions" ADD COLUMN "crypto_cost_before" DECIMAL;
ALTER TABLE "investment_transactions" ADD COLUMN "crypto_avg_before" DECIMAL;
