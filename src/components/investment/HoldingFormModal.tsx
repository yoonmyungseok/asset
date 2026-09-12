'use client';

import { useEffect, useState } from 'react';
import Modal from '@/components/common/Modal';
import SymbolInput from './SymbolInput';

export interface HoldingFormValues {
  asset_class: 'stock' | 'deposit';
  symbol: string;
  name: string;
  quantity: string;
  avg_cost_price: string;
  book_cost: string;
  interest_rate: string;
  start_date: string;
  maturity_date: string;
}

interface Props {
  open: boolean;
  editing: boolean;
  initialValues: HoldingFormValues;
  onClose: () => void;
  onSave: (values: HoldingFormValues) => void;
}

const EMPTY_VALUES: HoldingFormValues = {
  asset_class: 'stock',
  symbol: '',
  name: '',
  quantity: '',
  avg_cost_price: '',
  book_cost: '',
  interest_rate: '',
  start_date: new Date().toISOString().slice(0, 10),
  maturity_date: '',
};

export function emptyHoldingFormValues(): HoldingFormValues {
  return { ...EMPTY_VALUES };
}

export default function HoldingFormModal({ open, editing, initialValues, onClose, onSave }: Props) {
  const [form, setForm] = useState<HoldingFormValues>(initialValues);

  useEffect(() => {
    if (open) setForm(initialValues);
  }, [open, initialValues]);

  const isDeposit = form.asset_class === 'deposit';

  const handleAssetClassChange = (asset_class: 'stock' | 'deposit') => {
    setForm((prev) => ({
      ...prev,
      asset_class,
      symbol: asset_class === 'deposit' ? '' : prev.symbol,
      avg_cost_price: asset_class === 'deposit' ? '1' : prev.avg_cost_price,
    }));
  };

  const canSave = isDeposit
    ? Boolean(form.name && form.quantity)
    : Boolean(form.symbol && form.name && form.quantity && form.avg_cost_price);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? '보유 수정' : '보유 추가'}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>취소</button>
          <button className="btn btn-primary" onClick={() => onSave(form)} disabled={!canSave}>저장</button>
        </>
      }
    >
      {!editing && (
        <div className="form-group">
          <label>자산 유형</label>
          <select
            value={form.asset_class}
            onChange={(e) => handleAssetClassChange(e.target.value as 'stock' | 'deposit')}
          >
            <option value="stock">주식/ETF</option>
            <option value="deposit">예금</option>
          </select>
        </div>
      )}

      {editing && (
        <div className="form-group">
          <label>자산 유형</label>
          <div>{isDeposit ? '예금' : '주식/ETF'}</div>
        </div>
      )}

      {isDeposit ? (
        <>
          <div className="form-group">
            <label>예금 상품명</label>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="퇴직연금 예금"
              readOnly={editing}
            />
          </div>
          <div className="form-group">
            <label>원금 (원)</label>
            <input
              type="number"
              value={form.quantity}
              onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
              placeholder="10000000"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>가입일 (이자 기산일)</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>연 이자율 (%)</label>
              <input
                type="number"
                step="0.01"
                value={form.interest_rate}
                onChange={(e) => setForm((prev) => ({ ...prev, interest_rate: e.target.value }))}
                placeholder="3.5"
              />
            </div>
            <div className="form-group">
              <label>만기일</label>
              <input
                type="date"
                value={form.maturity_date}
                onChange={(e) => setForm((prev) => ({ ...prev, maturity_date: e.target.value }))}
              />
            </div>
          </div>
          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
            평가금액은 원금에 가입일부터 오늘까지의 월복리 이자를 더해 계산합니다. 이자 거래 입력 시 기산일이 갱신됩니다.
          </p>
        </>
      ) : editing ? (
        <>
          <div className="form-group">
            <label>종목</label>
            <div>
              <strong>{form.name}</strong>
              <div className="text-muted" style={{ fontSize: 13 }}>{form.symbol}</div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>수량</label>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>평단가</label>
              <input
                type="number"
                step="0.01"
                value={form.avg_cost_price}
                onChange={(e) => setForm((prev) => ({ ...prev, avg_cost_price: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>상품잔액 (원금)</label>
              <input
                type="number"
                value={form.book_cost}
                onChange={(e) => setForm((prev) => ({ ...prev, book_cost: e.target.value }))}
                placeholder="퇴직연금 앱 상품잔액"
              />
            </div>
          </div>
          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
            상품잔액을 입력하면 퇴직연금 앱과 원금이 정확히 맞습니다. 비워두면 수량×평단가로 계산합니다.
          </p>
        </>
      ) : (
        <>
          <SymbolInput
            symbol={form.symbol}
            name={form.name}
            onSymbolChange={(symbol) => setForm((prev) => ({ ...prev, symbol }))}
            onNameChange={(name) => setForm((prev) => ({ ...prev, name }))}
          />
          <div className="form-row">
            <div className="form-group">
              <label>수량</label>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>평단가</label>
              <input
                type="number"
                step="0.01"
                value={form.avg_cost_price}
                onChange={(e) => setForm((prev) => ({ ...prev, avg_cost_price: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>상품잔액 (원금)</label>
              <input
                type="number"
                value={form.book_cost}
                onChange={(e) => setForm((prev) => ({ ...prev, book_cost: e.target.value }))}
                placeholder="퇴직연금 앱 상품잔액"
              />
            </div>
          </div>
          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>
            상품잔액을 입력하면 퇴직연금 앱과 원금이 정확히 맞습니다. 비워두면 수량×평단가로 계산합니다.
          </p>
        </>
      )}
    </Modal>
  );
}
