'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import type { Holding } from '@/types/api';
import { todayISO, INVESTMENT_TX_TYPES } from '@/lib/utils/format';
import Modal from '@/components/common/Modal';
import SymbolInput from './SymbolInput';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  accountId: number;
}

const TX_TYPES = ['deposit', 'withdraw', 'buy', 'sell', 'dividend', 'interest', 'fee'];

export default function InvestmentTxFormModal({ open, onClose, onSaved, accountId }: Props) {
  const [txType, setTxType] = useState('deposit');
  const [date, setDate] = useState(todayISO());
  const [assetClass, setAssetClass] = useState<'stock' | 'deposit'>('stock');
  const [holdingId, setHoldingId] = useState('');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [fee, setFee] = useState('0');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [holdings, setHoldings] = useState<Holding[]>([]);

  useEffect(() => {
    if (!open) return;
    setDate(todayISO());
    api.getHoldings(accountId).then(setHoldings).catch(() => setHoldings([]));
  }, [open, accountId]);

  const needsStock = ['buy', 'sell'].includes(txType);
  const needsQtyPrice = needsStock && assetClass === 'stock';
  const needsDepositHolding = needsStock && assetClass === 'deposit';
  const needsInterestHolding = txType === 'interest';
  const cashOnlyType = ['dividend', 'deposit', 'withdraw', 'fee'].includes(txType)
    || (txType === 'interest' && !holdingId);

  const depositHoldings = holdings.filter((holding) => holding.asset_class === 'deposit');

  useEffect(() => {
    if (needsQtyPrice && quantity && price) {
      setAmount(String(Number(quantity) * Number(price)));
    }
  }, [quantity, price, needsQtyPrice]);

  useEffect(() => {
    if (needsDepositHolding && amount) {
      setQuantity(amount);
      setPrice('1');
    }
  }, [amount, needsDepositHolding]);

  useEffect(() => {
    if (holdingId) {
      const holding = holdings.find((item) => item.id === Number(holdingId));
      if (holding) {
        setName(holding.name);
        setSymbol(holding.symbol);
        setAssetClass(holding.asset_class === 'deposit' ? 'deposit' : 'stock');
      }
    }
  }, [holdingId, holdings]);

  const resetTradeFields = () => {
    setHoldingId('');
    setSymbol('');
    setName('');
    setQuantity('');
    setPrice('');
    setAmount('');
  };

  const handleSave = async () => {
    if (!amount) return;
    setSaving(true);
    try {
      await api.createInvestmentTransaction({
        account_id: accountId,
        type: txType,
        transaction_date: date,
        asset_class: needsStock ? assetClass : null,
        holding_id: holdingId ? Number(holdingId) : null,
        symbol: needsStock && assetClass === 'stock' ? symbol : null,
        name: needsStock || (needsInterestHolding && holdingId) ? name : null,
        quantity: needsQtyPrice ? Number(quantity) : needsDepositHolding ? Number(amount) : null,
        price: needsQtyPrice ? Number(price) : needsDepositHolding ? 1 : null,
        amount: Number(amount),
        fee: Number(fee),
        memo: memo || null,
      });
      onSaved();
      onClose();
      resetTradeFields();
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="투자 거래 추가"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>취소</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>저장</button>
        </>
      }
    >
      <div className="form-group">
        <label>유형</label>
        <select
          value={txType}
          onChange={(e) => {
            setTxType(e.target.value);
            resetTradeFields();
          }}
        >
          {TX_TYPES.map((t) => (
            <option key={t} value={t}>{INVESTMENT_TX_TYPES[t]}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>날짜</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {needsStock && (
        <div className="form-group">
          <label>자산 유형</label>
          <select
            value={assetClass}
            onChange={(e) => {
              setAssetClass(e.target.value as 'stock' | 'deposit');
              setHoldingId('');
              setSymbol('');
              setName('');
              setQuantity('');
              setPrice('');
            }}
          >
            <option value="stock">주식/ETF</option>
            <option value="deposit">예금</option>
          </select>
        </div>
      )}

      {needsInterestHolding && depositHoldings.length > 0 && (
        <div className="form-group">
          <label>예금 상품 (선택)</label>
          <select
            value={holdingId}
            onChange={(e) => setHoldingId(e.target.value)}
          >
            <option value="">예수금으로 이자 수령</option>
            {depositHoldings.map((holding) => (
              <option key={holding.id} value={holding.id}>{holding.name}</option>
            ))}
          </select>
          <p className="text-muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
            예금을 선택하면 이자가 해당 예금 원금에 반영됩니다.
          </p>
        </div>
      )}

      {cashOnlyType && (
        <p className="text-muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
          {txType === 'dividend'
            ? '배당은 예수금만 증가합니다. 보유 종목의 현재가나 수량은 변하지 않습니다.'
            : txType === 'interest'
              ? '이자는 예수금만 증가합니다.'
              : '이 거래는 예수금만 변경합니다.'}
        </p>
      )}

      {needsDepositHolding && (
        <>
          {depositHoldings.length > 0 && (
            <div className="form-group">
              <label>기존 예금</label>
              <select
                value={holdingId}
                onChange={(e) => {
                  setHoldingId(e.target.value);
                  if (!e.target.value) setName('');
                }}
              >
                <option value="">새 예금 상품</option>
                {depositHoldings.map((holding) => (
                  <option key={holding.id} value={holding.id}>{holding.name}</option>
                ))}
              </select>
            </div>
          )}
          {!holdingId && (
            <div className="form-group">
              <label>예금 상품명</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="퇴직연금 예금" />
            </div>
          )}
        </>
      )}

      {needsStock && assetClass === 'stock' && !holdingId && (
        <SymbolInput
          symbol={symbol}
          name={name}
          onSymbolChange={setSymbol}
          onNameChange={setName}
        />
      )}

      {needsQtyPrice && (
        <div className="form-row">
          <div className="form-group">
            <label>수량</label>
            <input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>
          <div className="form-group">
            <label>단가</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label>금액</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="form-group">
          <label>수수료</label>
          <input type="number" value={fee} onChange={(e) => setFee(e.target.value)} />
        </div>
      </div>
      <div className="form-group">
        <label>메모</label>
        <input value={memo} onChange={(e) => setMemo(e.target.value)} />
      </div>
    </Modal>
  );
}
