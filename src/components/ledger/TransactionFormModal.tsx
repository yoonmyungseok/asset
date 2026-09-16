'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import type { Account, Card, CategoryTree, LedgerTransaction, PaymentMethod } from '@/types/api';
import { CARD_TYPES, type LedgerFormType, todayISO } from '@/lib/utils/format';
import Modal from '@/components/common/Modal';

interface Props {
  open: boolean;
  transaction?: LedgerTransaction | null;
  onClose: () => void;
  onSaved: () => void;
}

type TransferMode = 'internal' | 'external';

function resetForm(
  setters: {
    setType: (v: LedgerFormType) => void;
    setDate: (v: string) => void;
    setAmount: (v: string) => void;
    setCategoryId: (v: number | '') => void;
    setPaymentMethodId: (v: number | '') => void;
    setCardId: (v: number | '') => void;
    setFromAccountId: (v: number | '') => void;
    setToAccountId: (v: number | '') => void;
    setTransferMode: (v: TransferMode) => void;
    setMerchant: (v: string) => void;
    setMemo: (v: string) => void;
    setIsFixed: (v: boolean) => void;
  },
) {
  setters.setType('expense');
  setters.setDate(todayISO());
  setters.setAmount('');
  setters.setCategoryId('');
  setters.setPaymentMethodId('');
  setters.setCardId('');
  setters.setFromAccountId('');
  setters.setToAccountId('');
  setters.setTransferMode('external');
  setters.setMerchant('');
  setters.setMemo('');
  setters.setIsFixed(false);
}

function isReimbursementType(type: LedgerFormType | LedgerTransaction['type']) {
  return type === 'reimbursement_out' || type === 'reimbursement_in';
}

export default function TransactionFormModal({ open, transaction, onClose, onSaved }: Props) {
  const [type, setType] = useState<LedgerFormType>('expense');
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

  const isEditing = Boolean(transaction);
  const isReimbursement = isReimbursementType(type);

  useEffect(() => {
    if (!open) return;

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

      const setters = {
        setType,
        setDate,
        setAmount,
        setCategoryId,
        setPaymentMethodId,
        setCardId,
        setFromAccountId,
        setToAccountId,
        setTransferMode,
        setMerchant,
        setMemo,
        setIsFixed,
      };

      if (transaction) {
        const bankTransferMethod = methods.find((m) => m.name === '계좌이체');
        const isTransfer = transaction.type === 'transfer';
        const isBankTransferExpense =
          transaction.type === 'expense' && transaction.payment_method?.name === '계좌이체';

        setDate(transaction.transaction_date);
        setAmount(String(Number(transaction.amount)));
        setMerchant(transaction.merchant ?? '');
        setMemo(transaction.memo ?? '');
        setIsFixed(transaction.is_fixed);
        setPaymentMethodId(transaction.payment_method?.id ?? '');
        setCardId(transaction.card?.id ?? '');
        setFromAccountId(transaction.account_id ?? '');
        setToAccountId(transaction.to_account_id ?? '');

        if (isTransfer) {
          setType('expense');
          setTransferMode('internal');
          setCategoryId('');
          setPaymentMethodId(bankTransferMethod?.id ?? transaction.payment_method?.id ?? '');
        } else if (isBankTransferExpense) {
          setType('expense');
          setTransferMode('external');
          setCategoryId(transaction.category.id);
        } else if (isReimbursementType(transaction.type)) {
          setType(transaction.type);
          setTransferMode('external');
          setCategoryId('');
          setPaymentMethodId('');
          setCardId('');
        } else {
          setType(transaction.type === 'income' ? 'income' : 'expense');
          setTransferMode('external');
          setCategoryId(transaction.category.id);
          if (transaction.type === 'income') {
            setPaymentMethodId('');
            setCardId('');
          }
        }
      } else {
        resetForm(setters);
      }
    });
  }, [open, transaction]);

  const filteredCategories = categories.filter((c) => c.type === type);
  const selectedPaymentMethod = paymentMethods.find((m) => m.id === paymentMethodId);
  const isCardPayment = type === 'expense' && selectedPaymentMethod?.name === '카드';
  const isBankTransfer = type === 'expense' && selectedPaymentMethod?.name === '계좌이체';
  const isInternalTransfer = isBankTransfer && transferMode === 'internal';
  const needsCategory = !isInternalTransfer && !isReimbursement;
  const needsDepositAccount = type === 'income' || type === 'reimbursement_in';
  const needsWithdrawAccount = isBankTransfer || type === 'reimbursement_out';

  const switchType = (nextType: LedgerFormType) => {
    setType(nextType);
    setCategoryId('');
    setCardId('');
    setFromAccountId('');
    setToAccountId('');
    setPaymentMethodId('');
    setTransferMode('external');
  };

  const buildPayload = () => {
    const ledgerType = isInternalTransfer ? 'transfer' : type;
    return {
      transaction_date: date,
      type: ledgerType,
      amount: Number(amount),
      category_id: needsCategory ? categoryId : null,
      payment_method_id: type === 'income' || isReimbursement ? null : (paymentMethodId || null),
      account_id: needsWithdrawAccount || needsDepositAccount ? (fromAccountId || null) : null,
      to_account_id: isInternalTransfer ? toAccountId : null,
      card_id: isCardPayment ? cardId : null,
      merchant: merchant || null,
      memo: memo || null,
      is_fixed: isReimbursement || isInternalTransfer ? false : isFixed,
    };
  };

  const handleSave = async () => {
    if (!amount) return;
    if (needsCategory && !categoryId) return;
    if (isCardPayment && !cardId) {
      alert('카드를 선택해 주세요.');
      return;
    }
    if (needsWithdrawAccount && !fromAccountId) {
      alert(type === 'reimbursement_out' ? '출금 계좌를 선택해 주세요.' : '출금 계좌를 선택해 주세요.');
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
    if (needsDepositAccount && !fromAccountId) {
      alert('입금 계좌를 선택해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      if (transaction) {
        await api.updateLedgerTransaction(transaction.id, payload);
      } else {
        await api.createLedgerTransaction(payload);
      }
      onSaved();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const editingType = transaction?.type;
  const canSwitchType = !isEditing || (editingType !== 'transfer' && (editingType ? !isReimbursementType(editingType) : true));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? '거래 수정' : '거래 추가'}
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
          onClick={() => switchType('income')}
          disabled={!canSwitchType || isBankTransfer || (isEditing && editingType !== 'income')}
        >
          수입
        </button>
        <button
          className={type === 'expense' ? 'active-expense' : ''}
          onClick={() => switchType('expense')}
          disabled={!canSwitchType || (isEditing && editingType !== 'expense')}
        >
          지출
        </button>
      </div>
      <div className="type-toggle type-toggle--compact">
        <button
          className={type === 'reimbursement_out' ? 'active-reimbursement-out' : ''}
          onClick={() => switchType('reimbursement_out')}
          disabled={!canSwitchType || (isEditing && editingType !== 'reimbursement_out')}
        >
          반환예정 이체
        </button>
        <button
          className={type === 'reimbursement_in' ? 'active-reimbursement-in' : ''}
          onClick={() => switchType('reimbursement_in')}
          disabled={!canSwitchType || (isEditing && editingType !== 'reimbursement_in')}
        >
          반환 입금
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
      {type === 'expense' && (
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
            }}
          >
            <option value="">선택</option>
            {paymentMethods.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}
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
                등록된 계좌가 없습니다. 자산 화면에서 계좌를 추가해 주세요.
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
      {type === 'reimbursement_out' && (
        <div className="form-group">
          <label>출금 계좌</label>
          {accounts.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
              등록된 계좌가 없습니다. 자산 화면에서 계좌를 추가해 주세요.
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
      )}
      {needsDepositAccount && (
        <div className="form-group">
          <label>입금 계좌</label>
          {accounts.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
              등록된 계좌가 없습니다. 자산 화면에서 계좌를 추가해 주세요.
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
        <label>{isReimbursement ? '내용/적요' : '가맹점/적요'}</label>
        <input
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder={type === 'reimbursement_out' ? '예: 회의비, 출장비' : type === 'reimbursement_in' ? '예: 3월 회의비 환급' : undefined}
        />
      </div>
      <div className="form-group">
        <label>메모</label>
        <input value={memo} onChange={(e) => setMemo(e.target.value)} />
      </div>
      {!isInternalTransfer && !isReimbursement && (
        <label className="checkbox-label">
          <input type="checkbox" checked={isFixed} onChange={(e) => setIsFixed(e.target.checked)} />
          고정지출
        </label>
      )}
    </Modal>
  );
}
