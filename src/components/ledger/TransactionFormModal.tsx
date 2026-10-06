'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import type { Account, Card, CategoryTree, LedgerTransaction, PaymentMethod } from '@/types/api';
import { CARD_TYPES, type LedgerFormType, formatMoney, todayISO } from '@/lib/utils/format';
import Modal from '@/components/common/Modal';

interface Props {
  open: boolean;
  transaction?: LedgerTransaction | null;
  presetAccountId?: number;
  presetDate?: string;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (id: number) => void;
}

type TransferMode = 'internal' | 'external';

function formatKoreanAmount(numStr: string): string {
  const num = Number(numStr);
  if (!num || isNaN(num)) return '';
  if (num >= 100000000) {
    const eok = Math.floor(num / 100000000);
    const man = Math.floor((num % 100000000) / 10000);
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`;
  }
  if (num >= 10000) {
    const man = Math.floor(num / 10000);
    const rest = num % 10000;
    return rest > 0 ? `${man.toLocaleString()}만 ${rest.toLocaleString()}원` : `${man.toLocaleString()}만원`;
  }
  return `${num.toLocaleString()}원`;
}

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
  defaultDate: string,
) {
  setters.setType('expense');
  setters.setDate(defaultDate);
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

function applyNewTransactionAccountPreset(
  presetAccountId: number,
  type: LedgerFormType,
  transferMode: TransferMode,
  setFromAccountId: (v: number | '') => void,
) {
  if (type === 'income' || type === 'reimbursement_in') {
    setFromAccountId(presetAccountId);
    return;
  }
  if (type === 'expense' && transferMode === 'internal') {
    setFromAccountId(presetAccountId);
    return;
  }
  if (type === 'expense' || type === 'reimbursement_out') {
    setFromAccountId(presetAccountId);
  }
}

export default function TransactionFormModal({
  open,
  transaction,
  presetAccountId,
  presetDate,
  onClose,
  onSaved,
  onDelete,
}: Props) {
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
        resetForm(setters, presetDate || todayISO());
        if (presetAccountId != null) {
          applyNewTransactionAccountPreset(presetAccountId, 'expense', 'external', setFromAccountId);
        }
      }
    });
  }, [open, transaction, presetAccountId, presetDate]);

  const filteredCategories = categories.filter((c) => c.type === type);
  const selectedPaymentMethod = paymentMethods.find((m) => m.id === paymentMethodId);
  const isCardPayment = type === 'expense' && selectedPaymentMethod?.name === '카드';
  const isBankTransfer = type === 'expense' && selectedPaymentMethod?.name === '계좌이체';
  const isInternalTransfer = isBankTransfer && transferMode === 'internal';
  const needsCategory = !isInternalTransfer && !isReimbursement;
  const showCategory = needsCategory && (type !== 'expense' || Boolean(paymentMethodId));
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

  const handleAddQuickAmount = (increment: number) => {
    const current = Number(amount) || 0;
    setAmount(String(current + increment));
  };

  const handleClearAmount = () => {
    setAmount('');
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
      merchant: merchant.trim() || null,
      memo: memo.trim() || null,
      is_fixed: isReimbursement || isInternalTransfer ? false : isFixed,
    };
  };

  const handleSave = async () => {
    if (!amount || Number(amount) <= 0) {
      alert('금액을 올바르게 입력해 주세요.');
      return;
    }
    if (needsCategory && !categoryId) {
      alert('카테고리를 선택해 주세요.');
      return;
    }
    if (isCardPayment && !cardId) {
      alert('카드를 선택해 주세요.');
      return;
    }
    if (needsWithdrawAccount && !fromAccountId) {
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
  const canSwitchType =
    !isEditing ||
    (editingType !== 'transfer' && (editingType ? !isReimbursementType(editingType) : true));

  const koreanAmountText = formatKoreanAmount(amount);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? '거래 수정' : '거래 추가'}
      theme="dark"
      footer={
        <div className="flex w-full items-center gap-2.5">
          {isEditing && onDelete && (
            <button
              type="button"
              className="flex h-11 items-center justify-center rounded-xl border border-red-500/30 px-3.5 text-xs font-semibold text-red-400 transition-colors hover:bg-red-500/10 active:scale-95 touch-manipulation sm:h-10 sm:text-sm"
              onClick={() => {
                if (confirm('이 거래 내역을 삭제하시겠습니까?')) {
                  onDelete(transaction!.id);
                  onClose();
                }
              }}
            >
              삭제
            </button>
          )}
          <button
            type="button"
            className="flex h-11 flex-1 items-center justify-center rounded-xl bg-[#252832] px-4 text-xs font-semibold text-gray-300 transition-colors hover:bg-[#2e323e] hover:text-white active:scale-95 touch-manipulation sm:h-10 sm:flex-initial sm:text-sm"
            onClick={onClose}
          >
            취소
          </button>
          <button
            type="button"
            className="flex h-11 flex-1 items-center justify-center rounded-xl bg-blue-600 px-5 text-xs font-bold text-white shadow-lg shadow-blue-600/30 transition-all hover:bg-blue-500 active:scale-95 touch-manipulation disabled:opacity-50 sm:h-10 sm:flex-initial sm:min-w-[100px] sm:text-sm"
            onClick={handleSave}
            disabled={saving || !amount}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 거래 유형 메인 탭 */}
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[#121316] p-1.5 border border-[#232630]">
          <button
            type="button"
            onClick={() => switchType('expense')}
            disabled={!canSwitchType || (isEditing && editingType !== 'expense')}
            className={`flex h-11 items-center justify-center rounded-xl text-sm font-bold transition-all active:scale-[0.98] touch-manipulation ${
              type === 'expense'
                ? 'bg-[#2b181e] text-[#ff5370] shadow-sm shadow-rose-950/50 border border-rose-500/30'
                : 'text-gray-400 hover:text-gray-200'
            } disabled:opacity-40`}
          >
            지출
          </button>
          <button
            type="button"
            onClick={() => switchType('income')}
            disabled={!canSwitchType || isBankTransfer || (isEditing && editingType !== 'income')}
            className={`flex h-11 items-center justify-center rounded-xl text-sm font-bold transition-all active:scale-[0.98] touch-manipulation ${
              type === 'income'
                ? 'bg-[#152a20] text-[#00d282] shadow-sm shadow-emerald-950/50 border border-emerald-500/30'
                : 'text-gray-400 hover:text-gray-200'
            } disabled:opacity-40`}
          >
            수입
          </button>
        </div>

        {/* 특수 거래(반환) 보조 선택 */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => switchType('reimbursement_out')}
            disabled={!canSwitchType || (isEditing && editingType !== 'reimbursement_out')}
            className={`flex-1 rounded-xl py-2 px-2 text-center text-xs font-semibold transition-all active:scale-95 touch-manipulation border ${
              type === 'reimbursement_out'
                ? 'border-amber-500/50 bg-[#292214] text-amber-300'
                : 'border-[#252832] bg-[#16181f] text-gray-400 hover:text-gray-200'
            } disabled:opacity-40`}
          >
            반환예정 이체
          </button>
          <button
            type="button"
            onClick={() => switchType('reimbursement_in')}
            disabled={!canSwitchType || (isEditing && editingType !== 'reimbursement_in')}
            className={`flex-1 rounded-xl py-2 px-2 text-center text-xs font-semibold transition-all active:scale-95 touch-manipulation border ${
              type === 'reimbursement_in'
                ? 'border-cyan-500/50 bg-[#14262b] text-cyan-300'
                : 'border-[#252832] bg-[#16181f] text-gray-400 hover:text-gray-200'
            } disabled:opacity-40`}
          >
            반환 입금
          </button>
        </div>

        {/* 금액 입력 영역 (Hero Input) */}
        <div className="rounded-2xl border border-[#272b36] bg-[#13151a] p-3.5 sm:p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-semibold text-gray-400 tracking-wider">금액</span>
            {koreanAmountText && (
              <span className="text-xs font-bold text-blue-400 animate-fadeIn">
                {koreanAmountText}
              </span>
            )}
          </div>
          <div className="relative flex items-center">
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={amount ? Number(amount).toLocaleString() : ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                setAmount(raw);
              }}
              placeholder="0"
              className="w-full bg-transparent text-2xl sm:text-3xl font-extrabold text-white placeholder-gray-600 focus:outline-none pr-8 tracking-tight"
              autoFocus={!isEditing}
            />
            <span className="absolute right-0 text-base sm:text-lg font-bold text-gray-400">원</span>
          </div>

          {/* 모바일 퀵 금액 증액 칩 */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#1f222b]">
            <button
              type="button"
              onClick={() => handleAddQuickAmount(10000)}
              className="rounded-lg bg-[#20232c] px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:bg-[#2b303d] hover:text-white active:scale-90 touch-manipulation transition-all"
            >
              +1만
            </button>
            <button
              type="button"
              onClick={() => handleAddQuickAmount(50000)}
              className="rounded-lg bg-[#20232c] px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:bg-[#2b303d] hover:text-white active:scale-90 touch-manipulation transition-all"
            >
              +5만
            </button>
            <button
              type="button"
              onClick={() => handleAddQuickAmount(100000)}
              className="rounded-lg bg-[#20232c] px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:bg-[#2b303d] hover:text-white active:scale-90 touch-manipulation transition-all"
            >
              +10만
            </button>
            <button
              type="button"
              onClick={() => handleAddQuickAmount(500000)}
              className="rounded-lg bg-[#20232c] px-2.5 py-1.5 text-xs font-medium text-gray-300 hover:bg-[#2b303d] hover:text-white active:scale-90 touch-manipulation transition-all"
            >
              +50만
            </button>
            {amount && (
              <button
                type="button"
                onClick={handleClearAmount}
                className="ml-auto rounded-lg bg-red-950/40 border border-red-500/20 px-2 py-1.5 text-xs font-medium text-red-400 hover:bg-red-900/50 active:scale-90 touch-manipulation transition-all"
              >
                지우기
              </button>
            )}
          </div>
        </div>

        {/* 날짜 입력 */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-gray-400">날짜</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-[#272b36] bg-[#13151a] px-3.5 py-2.5 text-sm sm:text-base text-white focus:border-blue-500 focus:outline-none transition-colors"
          />
        </div>

        {/* 결제 수단 (지출일 때) */}
        {type === 'expense' && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-400">결제 수단</label>
            <div className="relative">
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
                className="w-full appearance-none rounded-xl border border-[#272b36] bg-[#13151a] px-3.5 py-2.5 pr-8 text-sm sm:text-base text-white focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
              >
                <option value="">결제 수단 선택</option>
                {paymentMethods.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#181a20] text-white">
                    {m.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                ▾
              </div>
            </div>
          </div>
        )}

        {/* 카테고리 선택 */}
        {showCategory && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-400">카테고리</label>
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  type === 'income'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                }`}
              >
                {type === 'income' ? '수입' : '지출'}
              </span>
            </div>
            <div className="relative">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(Number(e.target.value) || '')}
                className="w-full appearance-none rounded-xl border border-[#272b36] bg-[#13151a] px-3.5 py-2.5 pr-8 text-sm sm:text-base text-white focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
              >
                <option value="">카테고리 선택</option>
                {filteredCategories.map((parent) => (
                  <optgroup key={parent.id} label={`[대분류] ${parent.name}`} className="bg-[#1f222b] text-gray-300 font-bold">
                    {parent.children.map((child) => (
                      <option key={child.id} value={child.id} className="bg-[#181a20] text-white">
                        {parent.name} › {child.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                ▾
              </div>
            </div>
          </div>
        )}

        {/* 계좌이체 상세 (이체 유형 및 계좌 선택) */}
        {isBankTransfer && (
          <div className="space-y-3 rounded-2xl border border-[#2b2e3a] bg-[#161820] p-3.5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-400">이체 유형</label>
              <div className="relative">
                <select
                  value={transferMode}
                  onChange={(e) => {
                    const mode = e.target.value as TransferMode;
                    setTransferMode(mode);
                    setToAccountId('');
                    if (mode === 'internal') setCategoryId('');
                  }}
                  className="w-full appearance-none rounded-xl border border-[#272b36] bg-[#13151a] px-3.5 py-2.5 pr-8 text-sm sm:text-base text-white focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="external">외부 계좌 (지출)</option>
                  <option value="internal">내 계좌 간 이체</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                  ▾
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-400">출금 계좌</label>
              {accounts.length === 0 ? (
                <p className="text-xs text-gray-400">
                  등록된 계좌가 없습니다. 자산 화면에서 계좌를 추가해 주세요.
                </p>
              ) : (
                <div className="relative">
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(Number(e.target.value) || '')}
                    className="w-full appearance-none rounded-xl border border-[#272b36] bg-[#13151a] px-3.5 py-2.5 pr-8 text-sm sm:text-base text-white focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
                  >
                    <option value="">출금 계좌 선택</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id} className="bg-[#181a20] text-white">
                        {account.name}
                        {account.institution ? ` · ${account.institution}` : ''}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                    ▾
                  </div>
                </div>
              )}
            </div>

            {isInternalTransfer && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-400">입금 계좌</label>
                <div className="relative">
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(Number(e.target.value) || '')}
                    className="w-full appearance-none rounded-xl border border-[#272b36] bg-[#13151a] px-3.5 py-2.5 pr-8 text-sm sm:text-base text-white focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
                  >
                    <option value="">입금 계좌 선택</option>
                    {accounts
                      .filter((account) => account.id !== fromAccountId)
                      .map((account) => (
                        <option key={account.id} value={account.id} className="bg-[#181a20] text-white">
                          {account.name}
                          {account.institution ? ` · ${account.institution}` : ''}
                        </option>
                      ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                    ▾
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 반환예정 이체 출금 계좌 */}
        {type === 'reimbursement_out' && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-400">출금 계좌</label>
            {accounts.length === 0 ? (
              <p className="text-xs text-gray-400">
                등록된 계좌가 없습니다. 자산 화면에서 계좌를 추가해 주세요.
              </p>
            ) : (
              <div className="relative">
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(Number(e.target.value) || '')}
                  className="w-full appearance-none rounded-xl border border-[#272b36] bg-[#13151a] px-3.5 py-2.5 pr-8 text-sm sm:text-base text-white focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="">출금 계좌 선택</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id} className="bg-[#181a20] text-white">
                      {account.name}
                      {account.institution ? ` · ${account.institution}` : ''}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                  ▾
                </div>
              </div>
            )}
          </div>
        )}

        {/* 수입 또는 반환 입금 계좌 */}
        {needsDepositAccount && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-400">입금 계좌</label>
            {accounts.length === 0 ? (
              <p className="text-xs text-gray-400">
                등록된 계좌가 없습니다. 자산 화면에서 계좌를 추가해 주세요.
              </p>
            ) : (
              <div className="relative">
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(Number(e.target.value) || '')}
                  className="w-full appearance-none rounded-xl border border-[#272b36] bg-[#13151a] px-3.5 py-2.5 pr-8 text-sm sm:text-base text-white focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="">입금 계좌 선택</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id} className="bg-[#181a20] text-white">
                      {account.name}
                      {account.institution ? ` · ${account.institution}` : ''}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                  ▾
                </div>
              </div>
            )}
          </div>
        )}

        {/* 카드 결제일 때 카드 선택 */}
        {isCardPayment && (
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-400">카드 선택</label>
            {cards.length === 0 ? (
              <p className="text-xs text-gray-400">
                등록된 카드가 없습니다. 설정 → 내 카드에서 추가해 주세요.
              </p>
            ) : (
              <div className="relative">
                <select
                  value={cardId}
                  onChange={(e) => setCardId(Number(e.target.value) || '')}
                  className="w-full appearance-none rounded-xl border border-[#272b36] bg-[#13151a] px-3.5 py-2.5 pr-8 text-sm sm:text-base text-white focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
                >
                  <option value="">카드 선택</option>
                  {cards.map((card) => (
                    <option key={card.id} value={card.id} className="bg-[#181a20] text-white">
                      {card.name} — {CARD_TYPES[card.card_type]}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">
                  ▾
                </div>
              </div>
            )}
          </div>
        )}

        {/* 가맹점 / 적요 */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-gray-400">
            {isReimbursement ? '내용/적요' : '가맹점/적요'}
          </label>
          <input
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder={
              type === 'reimbursement_out'
                ? '예: 팀 회식비, 출장비'
                : type === 'reimbursement_in'
                  ? '예: 회식비 1/N 정산 환급'
                  : '예: 스타벅스, 쿠팡, 배달의민족'
            }
            className="w-full rounded-xl border border-[#272b36] bg-[#13151a] px-3.5 py-2.5 text-sm sm:text-base text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
          />
        </div>

        {/* 메모 */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-gray-400">메모 (선택)</label>
          <input
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="추가 메모 입력"
            className="w-full rounded-xl border border-[#272b36] bg-[#13151a] px-3.5 py-2.5 text-sm sm:text-base text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none transition-colors"
          />
        </div>

        {/* 고정지출 체크 */}
        {!isInternalTransfer && !isReimbursement && (
          <label className="flex items-center gap-3 rounded-xl border border-[#272b36] bg-[#13151a] p-3 cursor-pointer select-none active:bg-[#1a1d24] transition-colors">
            <input
              type="checkbox"
              checked={isFixed}
              onChange={(e) => setIsFixed(e.target.checked)}
              className="h-4 w-4 rounded border-gray-600 bg-[#252832] text-blue-600 focus:ring-0 focus:ring-offset-0"
            />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-white">매월 고정지출</span>
              <span className="text-xs text-gray-400">구독료, 통신비, 월세 등 매달 나가는 지출</span>
            </div>
          </label>
        )}
      </div>
    </Modal>
  );
}
