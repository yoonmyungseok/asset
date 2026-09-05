import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { Account, Card, CategoryTree, PaymentMethod } from '../../types/api';
import { CARD_TYPES, todayISO } from '../../utils/format';
import Modal from '../common/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type TransferMode = 'internal' | 'external';

export default function TransactionFormModal({ open, onClose, onSaved }: Props) {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [paymentMethodId, setPaymentMethodId] = useState<number | ''>('');
  const [cardId, setCardId] = useState<number | ''>('');
  const [fromAccountId, setFromAccountId] = useState<number | ''>('');
  const [toAccountId, setToAccountId] = useState<number | ''>('');
  const [transferMode, setTransferMode] = useState<TransferMode>('external');
  const [merchant, setMerchant] = useState('');
  const [memo, setMemo] = useState('');
  const [isFixed, setIsFixed] = useState(false);
  const [categories, setCategories] = useState<CategoryTree[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(todayISO());
    setCardId('');
    setFromAccountId('');
    setToAccountId('');
    setTransferMode('external');
    Promise.all([
      api.getCategories(),
      api.getPaymentMethods(),
      api.getCards(),
      api.getAccounts({ is_active: true }),
    ]).then(([cats, methods, cardList, accountList]) => {
      setCategories(cats);
      setPaymentMethods(methods);
      setCards(cardList);
      setAccounts(accountList);
    });
  }, [open]);

  const filteredCategories = categories.filter((c) => c.type === type);
  const selectedPaymentMethod = paymentMethods.find((m) => m.id === paymentMethodId);
  const isCardPayment = type === 'expense' && selectedPaymentMethod?.name === '카드';
  const isBankTransfer = type === 'expense' && selectedPaymentMethod?.name === '계좌이체';
  const isInternalTransfer = isBankTransfer && transferMode === 'internal';
  const needsCategory = !isInternalTransfer;

  const handleSave = async () => {
    if (!amount) return;
    if (needsCategory && !categoryId) return;
    if (isCardPayment && !cardId) {
      alert('카드를 선택해 주세요.');
      return;
    }
    if (isBankTransfer && !fromAccountId) {
      alert('출금 계좌를 선택해 주세요.');
      return;
    }
    if (isInternalTransfer && !toAccountId) {
      alert('입금 계좌를 선택해 주세요.');
      return;
    }
    if (isInternalTransfer && fromAccountId === toAccountId) {
      alert('출금·입금 계좌가 같을 수 없습니다.');
      return;
    }
    setSaving(true);
    try {
      const ledgerType = isInternalTransfer ? 'transfer' : type;
      await api.createLedgerTransaction({
        transaction_date: date,
        type: ledgerType,
        amount: Number(amount),
        category_id: needsCategory ? categoryId : null,
        payment_method_id: paymentMethodId || null,
        account_id: isBankTransfer ? fromAccountId : null,
        to_account_id: isInternalTransfer ? toAccountId : null,
        card_id: isCardPayment ? cardId : null,
        merchant: merchant || null,
        memo: memo || null,
        is_fixed: isFixed,
      });
      onSaved();
      onClose();
      setAmount('');
      setMerchant('');
      setMemo('');
      setCardId('');
      setFromAccountId('');
      setToAccountId('');
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
      title="거래 추가"
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>취소</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중...' : '저장'}
          </button>
        </>
      }
    >
      <div className="type-toggle">
        <button
          className={type === 'income' ? 'active-income' : ''}
          onClick={() => { setType('income'); setCategoryId(''); setCardId(''); }}
          disabled={isBankTransfer}
        >
          수입
        </button>
        <button
          className={type === 'expense' ? 'active-expense' : ''}
          onClick={() => { setType('expense'); setCategoryId(''); }}
        >
          지출
        </button>
      </div>
      <div className="form-group">
        <label>날짜</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="form-group">
        <label>금액</label>
        <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
      </div>
      {needsCategory && (
        <div className="form-group">
          <label>
            카테고리
            <span className={`category-type-badge category-type-badge--${type}`} style={{ marginLeft: 8 }}>
              {type === 'income' ? '수입' : '지출'}
            </span>
          </label>
          <select value={categoryId} onChange={(e) => setCategoryId(Number(e.target.value))}>
            <option value="">선택</option>
            {filteredCategories.map((parent) => (
              <optgroup key={parent.id} label={`[대분류] ${parent.name}`}>
                {parent.children.map((child) => (
                  <option key={child.id} value={child.id}>{parent.name} › {child.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}
      <div className="form-group">
        <label>결제 수단</label>
        <select
          value={paymentMethodId}
          onChange={(e) => {
            const nextId = Number(e.target.value) || '';
            setPaymentMethodId(nextId);
            setCardId('');
            setFromAccountId('');
            setToAccountId('');
            setTransferMode('external');
            const nextMethod = paymentMethods.find((m) => m.id === nextId);
            if (nextMethod?.name === '계좌이체') {
              setType('expense');
              setCategoryId('');
            }
          }}
        >
          <option value="">선택</option>
          {paymentMethods.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>
      {isBankTransfer && (
        <>
          <div className="form-group">
            <label>이체 유형</label>
            <select
              value={transferMode}
              onChange={(e) => {
                const mode = e.target.value as TransferMode;
                setTransferMode(mode);
                setToAccountId('');
                if (mode === 'internal') setCategoryId('');
              }}
            >
              <option value="external">외부 계좌 (지출)</option>
              <option value="internal">내 계좌 간 이체</option>
            </select>
          </div>
          <div className="form-group">
            <label>출금 계좌</label>
            {accounts.length === 0 ? (
              <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
                등록된 계좌가 없습니다. 투자 화면에서 계좌를 추가해 주세요.
              </p>
            ) : (
              <select value={fromAccountId} onChange={(e) => setFromAccountId(Number(e.target.value) || '')}>
                <option value="">선택</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                    {account.institution ? ` · ${account.institution}` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>
          {isInternalTransfer && (
            <div className="form-group">
              <label>입금 계좌</label>
              <select value={toAccountId} onChange={(e) => setToAccountId(Number(e.target.value) || '')}>
                <option value="">선택</option>
                {accounts
                  .filter((account) => account.id !== fromAccountId)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                      {account.institution ? ` · ${account.institution}` : ''}
                    </option>
                  ))}
              </select>
            </div>
          )}
        </>
      )}
      {isCardPayment && (
        <div className="form-group">
          <label>카드 선택</label>
          {cards.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
              등록된 카드가 없습니다. 설정 → 내 카드에서 추가해 주세요.
            </p>
          ) : (
            <select value={cardId} onChange={(e) => setCardId(Number(e.target.value) || '')}>
              <option value="">선택</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.name} — {CARD_TYPES[card.card_type]}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
      <div className="form-group">
        <label>가맹점/적요</label>
        <input value={merchant} onChange={(e) => setMerchant(e.target.value)} />
      </div>
      <div className="form-group">
        <label>메모</label>
        <input value={memo} onChange={(e) => setMemo(e.target.value)} />
      </div>
      {!isInternalTransfer && (
        <label className="checkbox-label">
          <input type="checkbox" checked={isFixed} onChange={(e) => setIsFixed(e.target.checked)} />
          고정지출
        </label>
      )}
    </Modal>
  );
}
