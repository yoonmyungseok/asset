'use client';

import type { Holding } from '@/types/api';
import {
  ASSET_CLASS_LABELS,
  formatAvgCostPrice,
  formatInterestRate,
  formatMaturityLabel,
  formatMoney,
  formatPercent,
  formatQuantity,
} from '@/lib/utils/format';

interface Props {
  holding: Holding;
  onEdit: (holding: Holding) => void;
  onDelete: (holding: Holding) => void;
}

export default function HoldingCard({ holding, onEdit, onDelete }: Props) {
  const isDeposit = holding.asset_class === 'deposit';
  const plPositive = Number(holding.profit_loss_rate) >= 0;
  const plClass = plPositive ? 'text-success' : 'text-danger';

  return (
    <div className="holding-card">
      <div className="holding-card-header">
        <div className="holding-card-title">
          <span className="holding-card-name">{holding.name}</span>
          {!isDeposit && holding.symbol && (
            <span className="holding-card-symbol">{holding.symbol}</span>
          )}
          <span className="holding-card-type">
            {ASSET_CLASS_LABELS[holding.asset_class] || holding.asset_class}
          </span>
        </div>
        <div className="holding-card-value">
          <div className="holding-card-market">{formatMoney(holding.market_value)}</div>
          <div className={`text-sm font-semibold ${plClass}`}>
            {formatPercent(holding.profit_loss_rate)}
          </div>
        </div>
      </div>

      <div className="holding-card-details">
        {isDeposit ? (
          <div className="holding-card-detail-grid">
            <div>
              <span className="holding-card-label">원금</span>
              <span>{formatMoney(holding.quantity)}</span>
            </div>
            <div>
              <span className="holding-card-label">금리</span>
              <span>{formatInterestRate(holding.interest_rate)}</span>
            </div>
            <div>
              <span className="holding-card-label">만기</span>
              <span>{formatMaturityLabel(holding.maturity_date)}</span>
            </div>
          </div>
        ) : (
          <div className="holding-card-stock-detail">
            {formatQuantity(holding.quantity)}좌 · 평단 {formatAvgCostPrice(holding.avg_cost_price)} · 현재{' '}
            {formatAvgCostPrice(holding.current_price)}
          </div>
        )}
      </div>

      <div className="holding-card-footer">
        <span className={`text-sm ${plClass}`}>
          수익 {formatMoney(holding.profit_loss)}
        </span>
        <span className="holding-card-actions">
          <button className="btn btn-sm btn-secondary" onClick={() => onEdit(holding)}>수정</button>
          <button className="btn btn-sm btn-danger" onClick={() => onDelete(holding)}>삭제</button>
        </span>
      </div>
    </div>
  );
}
