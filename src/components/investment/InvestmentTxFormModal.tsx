'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api/client';
import type { Holding, InvestmentTransaction } from '@/types/api';
import { holdingAccruedInterest, holdingMarketValue, type HoldingLike } from '@/lib/utils';
import { formatMoney, formatQuantity, todayISO, INVESTMENT_TX_TYPES } from '@/lib/utils/format';
import Modal from '@/components/common/Modal';
import SymbolInput from './SymbolInput';

function toHoldingLike(holding: Holding): HoldingLike {
  return {
    asset_class: holding.asset_class,
    quantity: holding.quantity,
    interest_rate: holding.interest_rate,
    start_date: holding.start_date ? new Date(holding.start_date) : null,
    maturity_date: holding.maturity_date ? new Date(holding.maturity_date) : null,
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  accountId: number;
  transaction?: InvestmentTransaction | null;
}

const TX_TYPES = ['deposit', 'withdraw', 'buy', 'sell', 'dividend', 'interest', 'fee'];

export default function InvestmentTxFormModal({ open, onClose, onSaved, accountId, transaction }: Props) {
  const isEditing = Boolean(transaction);
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
  const [tax, setTax] = useState('0');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [holdings, setHoldings] = useState<Holding[]>([]);

  useEffect(() => {
    if (!open) return;
    api.getHoldings(accountId).then(setHoldings).catch(() => setHoldings([]));

    if (transaction) {
      setTxType(transaction.type);
      setDate(transaction.transaction_date.slice(0, 10));
      setAmount(String(Number(transaction.amount)));
      setFee(String(Number(transaction.fee)));
      setTax(String(Number(transaction.tax ?? 0)));
      setMemo(transaction.memo ?? '');
      setQuantity(transaction.quantity ? String(Number(transaction.quantity)) : '');
      setPrice(transaction.price ? String(Number(transaction.price)) : '');
      setHoldingId(transaction.holding_id ? String(transaction.holding_id) : '');
      setSymbol(transaction.holding_symbol ?? '');
      setName(transaction.holding_name ?? '');
      if (transaction.holding_symbol?.startsWith('DEP.')) {
        setAssetClass('deposit');
      } else if (['buy', 'sell'].includes(transaction.type)) {
        setAssetClass('stock');
      }
    } else {
      setTxType('deposit');
      setDate(todayISO());
      setAssetClass('stock');
      setHoldingId('');
      setSymbol('');
      setName('');
      setQuantity('');
      setPrice('');
      setAmount('');
      setFee('0');
      setTax('0');
      setMemo('');
    }
  }, [open, accountId, transaction]);

  const needsStock = ['buy', 'sell'].includes(txType);
  const needsStockBuy = txType === 'buy' && assetClass === 'stock';
  const needsStockSell = txType === 'sell' && assetClass === 'stock';
  const needsQtyPrice = needsStock && assetClass === 'stock';
  const needsDepositBuy = txType === 'buy' && assetClass === 'deposit';
  const needsDepositSell = txType === 'sell' && assetClass === 'deposit';
  const needsDepositHolding = needsDepositBuy || needsDepositSell;
  const needsInterestHolding = txType === 'interest';
  const needsTax = (txType === 'sell' && !needsDepositSell)
    || (isEditing && transaction?.type === 'sell' && !transaction?.holding_symbol?.startsWith('DEP.'));
  const cashOnlyType = ['dividend', 'deposit', 'withdraw', 'fee'].includes(txType)
    || (txType === 'interest' && !holdingId);

  const stockHoldings = holdings.filter((holding) => holding.asset_class !== 'deposit');
  const depositHoldings = holdings.filter((holding) => holding.asset_class === 'deposit');
  const selectedStockHolding = holdingId
    ? stockHoldings.find((holding) => holding.id === Number(holdingId))
    : undefined;
  const selectedDepositHolding = holdingId
    ? depositHoldings.find((holding) => holding.id === Number(holdingId))
    : undefined;
  const depositRedemption = useMemo(() => {
    if (!selectedDepositHolding || !needsDepositSell) {
      return null;
    }
    const holdingLike = toHoldingLike(selectedDepositHolding);
    const asOf = new Date(`${date}T00:00:00`);
    const principal = Number(selectedDepositHolding.quantity);
    const interest = Number(holdingAccruedInterest(holdingLike, asOf).toFixed(2));
    const total = Number(holdingMarketValue(holdingLike, asOf).toFixed(2));
    return { principal, interest, total };
  }, [selectedDepositHolding, needsDepositSell, date]);

  useEffect(() => {
    if (needsQtyPrice && quantity && price) {
      setAmount(String(Number(quantity) * Number(price)));
    }
  }, [quantity, price, needsQtyPrice]);

  useEffect(() => {
    if (needsDepositBuy && amount) {
      setQuantity(amount);
      setPrice('1');
    }
  }, [amount, needsDepositBuy]);

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
    if (needsDepositSell && !holdingId) {
      alert('해지할 예금을 선택해주세요.');
      return;
    }
    if (needsStockSell && !holdingId) {
      alert('매도할 종목을 선택해주세요.');
      return;
    }
    if (!needsDepositSell && !amount) return;
    setSaving(true);
    try {
      const resolvedAmount = needsDepositSell && depositRedemption
        ? depositRedemption.total
        : Number(amount);
      const resolvedQuantity = needsDepositSell && selectedDepositHolding
        ? Number(selectedDepositHolding.quantity)
        : needsQtyPrice
          ? Number(quantity)
          : needsDepositBuy
            ? Number(amount)
            : null;
      const resolvedPrice = needsQtyPrice
        ? Number(price)
        : (needsDepositBuy || needsDepositSell)
          ? 1
          : null;
      const resolvedFee = needsDepositSell ? 0 : Number(fee);
      const resolvedTax = needsTax && !needsDepositSell ? Number(tax) : 0;

      if (isEditing && transaction) {
        await api.updateInvestmentTransaction(transaction.id, {
          transaction_date: date,
          quantity: resolvedQuantity,
          price: resolvedPrice,
          amount: resolvedAmount,
          fee: resolvedFee,
          tax: resolvedTax,
          memo: memo || null,
        });
      } else {
        await api.createInvestmentTransaction({
          account_id: accountId,
          type: txType,
          transaction_date: date,
          asset_class: needsStock ? assetClass : null,
          holding_id: holdingId ? Number(holdingId) : null,
          symbol: needsStock && assetClass === 'stock' ? symbol : null,
          name: needsStock || (needsInterestHolding && holdingId) ? name : null,
          quantity: resolvedQuantity,
          price: resolvedPrice,
          amount: resolvedAmount,
          fee: resolvedFee,
          tax: resolvedTax,
          memo: memo || null,
        });
      }
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
      title={isEditing ? '투자 거래 수정' : '투자 거래 추가'}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>취소</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={
              saving
              || (!isEditing && needsDepositSell && !holdingId)
              || (!isEditing && needsStockSell && !holdingId)
            }
          >
            저장
          </button>
        </>
      }
    >
      <div className="form-group">
        <label>유형</label>
        <select
          value={txType}
          disabled={isEditing}
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

      {needsStock && !isEditing && (
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

      {needsInterestHolding && depositHoldings.length > 0 && !isEditing && (
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

      {needsDepositSell && !isEditing && (
        <>
          <div className="form-group">
            <label>해지할 예금</label>
            <select
              value={holdingId}
              onChange={(e) => {
                setHoldingId(e.target.value);
                if (!e.target.value) setName('');
              }}
            >
              <option value="">예금 선택</option>
              {depositHoldings.map((holding) => (
                <option key={holding.id} value={holding.id}>{holding.name}</option>
              ))}
            </select>
          </div>
          {depositRedemption && (
            <p className="text-muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
              해지 금액 {formatMoney(depositRedemption.total)} (원금 {formatMoney(depositRedemption.principal)}
              + 이자 {formatMoney(depositRedemption.interest)})이 예수금으로 입금되고 예금은 삭제됩니다.
            </p>
          )}
          {depositHoldings.length === 0 && (
            <p className="text-muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
              해지할 예금이 없습니다.
            </p>
          )}
        </>
      )}

      {needsDepositBuy && !isEditing && (
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

      {needsStockSell && !isEditing && (
        <>
          <div className="form-group">
            <label>매도 종목</label>
            <select
              value={holdingId}
              onChange={(e) => {
                setHoldingId(e.target.value);
                if (!e.target.value) {
                  setSymbol('');
                  setName('');
                }
              }}
            >
              <option value="">종목 선택</option>
              {stockHoldings.map((holding) => (
                <option key={holding.id} value={holding.id}>
                  {holding.name} ({holding.symbol}) · 보유 {formatQuantity(holding.quantity)}
                </option>
              ))}
            </select>
          </div>
          {stockHoldings.length === 0 && (
            <p className="text-muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
              매도할 보유 종목이 없습니다.
            </p>
          )}
          {selectedStockHolding && (
            <p className="text-muted" style={{ margin: '0 0 12px', fontSize: 13 }}>
              보유 수량 {formatQuantity(selectedStockHolding.quantity)} · 현재가 {formatMoney(selectedStockHolding.current_price)}
            </p>
          )}
        </>
      )}

      {needsStockBuy && !isEditing && (
        <SymbolInput
          symbol={symbol}
          name={name}
          onSymbolChange={setSymbol}
          onNameChange={setName}
        />
      )}

      {isEditing && (transaction?.holding_name || name) && (
        <div className="form-group">
          <label>종목</label>
          <input value={transaction?.holding_name ?? name} disabled />
        </div>
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

      {(!needsDepositSell || isEditing) && (
        <div className="form-row">
          <div className="form-group">
            <label>금액</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="form-group">
            <label>수수료</label>
            <input type="number" value={fee} onChange={(e) => setFee(e.target.value)} />
          </div>
          {needsTax && (
            <div className="form-group">
              <label>제세금</label>
              <input type="number" value={tax} onChange={(e) => setTax(e.target.value)} />
            </div>
          )}
        </div>
      )}
      <div className="form-group">
        <label>메모</label>
        <input value={memo} onChange={(e) => setMemo(e.target.value)} />
      </div>
    </Modal>
  );
}
