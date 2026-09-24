'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { PageHeader } from '@/components/layout/AppLayout';
import type { Account, Card, CategoryTree, Liability, MarketProviderStatus, PaymentMethod, RecurringItem } from '@/types/api';
import { formatMoney, CARD_TYPES, LIABILITY_TYPES } from '@/lib/utils/format';
import { formatRecurringItemLabel, formatRecurringPayment, sumRecurringTotals } from '@/lib/utils/ledger';
import Modal from '@/components/common/Modal';
import InstitutionSelect from '@/components/common/InstitutionSelect';
import { HealthSettingsPanel } from '@/components/care/HealthSettingsPanel';

function CategoriesPanel() {
  const [categories, setCategories] = useState<CategoryTree[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: '', type: 'expense', parent_id: '' });

  const load = () => api.getCategories().then(setCategories);
  useEffect(() => { load(); }, []);

  const income = categories.filter((c) => c.type === 'income');
  const expense = categories.filter((c) => c.type === 'expense');

  const openCreate = (type: string, parentId?: number) => {
    setEditingId(null);
    setForm({ name: '', type, parent_id: parentId ? String(parentId) : '' });
    setShowForm(true);
  };

  const openEdit = (id: number, name: string, type: string, parentId: number | null) => {
    setEditingId(id);
    setForm({ name, type, parent_id: parentId ? String(parentId) : '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (editingId) {
      await api.updateCategory(editingId, { name: form.name.trim() });
    } else {
      await api.createCategory({
        name: form.name.trim(),
        type: form.type,
        parent_id: form.parent_id ? Number(form.parent_id) : null,
      });
    }
    setShowForm(false);
    load();
  };

  const handleDelete = async (id: number, name: string, isSystem: boolean) => {
    if (isSystem) {
      if (!confirm(`"${name}" 카테고리를 비활성화하시겠습니까?`)) return;
      await api.updateCategory(id, { is_active: false });
    } else {
      if (!confirm(`"${name}" 카테고리를 삭제하시겠습니까?`)) return;
      try {
        await api.deleteCategory(id);
      } catch (e) {
        alert(e instanceof Error ? e.message : '삭제 실패');
        return;
      }
    }
    load();
  };

  const childCount = (items: CategoryTree[]) =>
    items.reduce((sum, p) => sum + p.children.length, 0);

  const renderGroup = (items: CategoryTree[], label: string, type: 'income' | 'expense') => (
    <div className={`category-group category-group--${type}`}>
      <div className="category-group-header">
        <div className="category-group-title">
          <span className={`category-type-badge category-type-badge--${type}`}>{label}</span>
          <span className="category-group-count">
            대분류 {items.length} · 소분류 {childCount(items)}
          </span>
        </div>
        <button className="btn btn-sm btn-primary" onClick={() => openCreate(type)}>+ 대분류</button>
      </div>
      <div className="category-tree">
        {items.length === 0 ? (
          <p className="category-empty">등록된 {label} 카테고리가 없습니다.</p>
        ) : (
          items.map((p) => (
            <div key={p.id} className={`category-block category-block--${type}`}>
              <div className={`category-parent category-parent--${type}`}>
                <span className="category-name">
                  <span className="category-level">대분류</span>
                  {p.name}
                  {!p.is_active && <span className="text-muted"> (비활성)</span>}
                </span>
                <span className="category-actions">
                  <button className="btn btn-sm btn-secondary" onClick={() => openCreate(type, p.id)}>+ 소분류</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(p.id, p.name, p.type, p.parent_id)}>수정</button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDelete(p.id, p.name, p.is_system)}>삭제</button>
                </span>
              </div>
              {p.children.map((c) => (
                <div key={c.id} className={`category-child category-child--${type}`}>
                  <span className="category-name">
                    <span className="category-level">소분류</span>
                    <span className="category-child-path">{p.name}</span>
                    <span className="category-child-sep">›</span>
                    {c.name}
                    {!c.is_active && <span className="text-muted"> (비활성)</span>}
                  </span>
                  <span className="category-actions">
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(c.id, c.name, c.type, c.parent_id)}>수정</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDelete(c.id, c.name, c.is_system)}>삭제</button>
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );

  const formType = form.parent_id
    ? categories.find((c) => c.id === Number(form.parent_id))?.type ?? form.type
    : form.type;

  return (
    <div className="category-panels">
      {renderGroup(income, '수입', 'income')}
      {renderGroup(expense, '지출', 'expense')}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editingId ? '카테고리 수정' : '카테고리 추가'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>취소</button>
            <button className="btn btn-primary" onClick={handleSave}>저장</button>
          </>
        }
      >
        <div className="form-group">
          <label>유형</label>
          {!editingId && !form.parent_id ? (
            <div className="type-toggle type-toggle--compact">
              <button
                type="button"
                className={form.type === 'income' ? 'active-income' : ''}
                onClick={() => setForm({ ...form, type: 'income' })}
              >
                수입
              </button>
              <button
                type="button"
                className={form.type === 'expense' ? 'active-expense' : ''}
                onClick={() => setForm({ ...form, type: 'expense' })}
              >
                지출
              </button>
            </div>
          ) : (
            <span className={`category-type-badge category-type-badge--${formType}`}>
              {formType === 'income' ? '수입' : '지출'}
            </span>
          )}
        </div>
        <div className="form-group">
          <label>이름</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder={form.parent_id ? '소분류 이름' : '대분류 이름'}
            autoFocus
          />
        </div>
      </Modal>
    </div>
  );
}

function RecurringPanel() {
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [categories, setCategories] = useState<CategoryTree[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState({
    type: 'expense',
    amount: '',
    category_id: '',
    payment_method_id: '',
    card_id: '',
    account_id: '',
    day_of_month: '1',
    merchant: '',
    memo: '',
  });

  const load = () => api.getRecurringItems().then(setItems);

  useEffect(() => {
    load();
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
  }, []);

  const selectedPaymentMethod = paymentMethods.find((m) => m.id === Number(form.payment_method_id));
  const isCardPayment = form.type === 'expense' && selectedPaymentMethod?.name === '카드';
  const isBankTransfer = form.type === 'expense' && selectedPaymentMethod?.name === '계좌이체';
  const needsAccount = isBankTransfer || form.type === 'income';
  const filteredCategories = categories.filter((c) => c.type === form.type);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      type: 'expense',
      amount: '',
      category_id: '',
      payment_method_id: '',
      card_id: '',
      account_id: '',
      day_of_month: '1',
      merchant: '',
      memo: '',
    });
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (item: RecurringItem) => {
    setEditingId(item.id);
    setForm({
      type: item.type,
      amount: String(Number(item.amount)),
      category_id: String(item.category.id),
      payment_method_id: item.type === 'income' ? '' : (item.payment_method ? String(item.payment_method.id) : ''),
      card_id: item.card ? String(item.card.id) : '',
      account_id: item.account_id ? String(item.account_id) : '',
      day_of_month: String(item.day_of_month),
      merchant: item.merchant ?? '',
      memo: item.memo ?? '',
    });
    setShowForm(true);
  };

  const buildPayload = () => ({
    type: form.type,
    amount: Number(form.amount),
    category_id: Number(form.category_id),
    payment_method_id: form.type === 'income' ? null : (form.payment_method_id ? Number(form.payment_method_id) : null),
    card_id: isCardPayment && form.card_id ? Number(form.card_id) : null,
    account_id: needsAccount && form.account_id ? Number(form.account_id) : null,
    day_of_month: Number(form.day_of_month),
    merchant: form.merchant || null,
    memo: form.memo || null,
  });

  const handleSave = async () => {
    if (!form.amount || !form.category_id) {
      alert('금액과 카테고리를 입력해 주세요.');
      return;
    }
    if (isCardPayment && !form.card_id) {
      alert('카드를 선택해 주세요.');
      return;
    }
    if (needsAccount && !form.account_id) {
      alert(form.type === 'income' ? '입금 계좌를 선택해 주세요.' : '출금 계좌를 선택해 주세요.');
      return;
    }
    const payload = buildPayload();
    if (editingId) {
      await api.updateRecurringItem(editingId, payload);
    } else {
      await api.createRecurringItem(payload);
    }
    setShowForm(false);
    resetForm();
    load();
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  const totals = sumRecurringTotals(items);

  return (
    <div>
      {items.length > 0 && (
        <div className="card-grid card-grid-2" style={{ marginBottom: 16 }}>
          <div className="card stat-card">
            <div className="stat-label">월 정기 수입</div>
            <div className="stat-value text-success">{formatMoney(totals.income)}</div>
          </div>
          <div className="card stat-card">
            <div className="stat-label">월 정기 지출</div>
            <div className="stat-value text-danger">{formatMoney(totals.expense)}</div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={openCreate}>+ 정기 항목 추가</button>
      </div>
      {items.length === 0 ? (
        <p className="text-muted">등록된 정기 항목이 없습니다.</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>항목</th>
                <th>유형</th>
                <th>결제</th>
                <th>금액</th>
                <th>일자</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{formatRecurringItemLabel(item)}</td>
                  <td>{item.type === 'income' ? '수입' : '지출'}</td>
                  <td>{formatRecurringPayment(item)}</td>
                  <td>{formatMoney(item.amount)}</td>
                  <td>매월 {item.day_of_month}일</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(item)}>수정</button>
                    {' '}
                    <button className="btn btn-sm btn-danger" onClick={async () => { await api.deleteRecurringItem(item.id); load(); }}>
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal
        open={showForm}
        onClose={closeForm}
        title={editingId ? '정기 항목 수정' : '정기 항목 추가'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeForm}>취소</button>
            <button className="btn btn-primary" onClick={handleSave}>저장</button>
          </>
        }
      >
        <div className="form-group">
          <label>유형</label>
          <div className="type-toggle type-toggle--compact">
            <button
              type="button"
              className={form.type === 'income' ? 'active-income' : ''}
              onClick={() => setForm({ ...form, type: 'income', category_id: '', card_id: '', account_id: '', payment_method_id: '' })}
            >
              수입
            </button>
            <button
              type="button"
              className={form.type === 'expense' ? 'active-expense' : ''}
              onClick={() => setForm({ ...form, type: 'expense', category_id: '' })}
            >
              지출
            </button>
          </div>
        </div>
        <div className="form-group">
          <label>금액</label>
          <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="0" />
        </div>
        <div className="form-group">
          <label>카테고리</label>
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
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
        {form.type === 'expense' && (
          <div className="form-group">
            <label>결제 수단</label>
            <select
              value={form.payment_method_id}
              onChange={(e) => setForm({
                ...form,
                payment_method_id: e.target.value,
                card_id: '',
                account_id: '',
              })}
            >
              <option value="">선택</option>
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
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
              <select value={form.card_id} onChange={(e) => setForm({ ...form, card_id: e.target.value })}>
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
        {needsAccount && (
          <div className="form-group">
            <label>{form.type === 'income' ? '입금 계좌' : '출금 계좌'}</label>
            {accounts.length === 0 ? (
              <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
                등록된 계좌가 없습니다. 자산 화면에서 계좌를 추가해 주세요.
              </p>
            ) : (
              <select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
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
        <div className="form-group">
          <label>매월 며칠</label>
          <input type="number" min={1} max={28} value={form.day_of_month} onChange={(e) => setForm({ ...form, day_of_month: e.target.value })} />
        </div>
        <div className="form-group">
          <label>가맹점/적요</label>
          <input value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} placeholder="예: 넷플릭스, 월세" />
        </div>
        <div className="form-group">
          <label>메모</label>
          <input value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}

function CardsPanel() {
  const [items, setItems] = useState<Card[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    card_type: 'debit' as 'debit' | 'credit',
    name: '',
    linked_account_id: '',
    settlement_account_id: '',
    due_day: '10',
  });

  const load = () => {
    api.getCards().then(setItems);
    api.getAccounts({ category: 'cash' }).then(setAccounts);
  };
  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      card_type: 'debit',
      name: '',
      linked_account_id: '',
      settlement_account_id: '',
      due_day: '10',
    });
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (card: Card) => {
    setEditingId(card.id);
    setForm({
      card_type: card.card_type,
      name: card.name,
      linked_account_id: card.linked_account_id ? String(card.linked_account_id) : '',
      settlement_account_id: card.settlement_account_id ? String(card.settlement_account_id) : '',
      due_day: card.due_day ? String(card.due_day) : '10',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
    };
    if (form.card_type === 'debit') {
      if (!form.linked_account_id) {
        alert('연결 계좌를 선택해 주세요.');
        return;
      }
      payload.linked_account_id = Number(form.linked_account_id);
    } else {
      if (!form.settlement_account_id || !form.due_day) {
        alert('결제 계좌와 결제일을 입력해 주세요.');
        return;
      }
      payload.settlement_account_id = Number(form.settlement_account_id);
      payload.due_day = Number(form.due_day);
    }
    if (editingId) {
      await api.updateCard(editingId, payload);
    } else {
      await api.createCard({ ...payload, card_type: form.card_type });
    }
    setShowForm(false);
    resetForm();
    load();
  };

  const closeForm = () => {
    setShowForm(false);
    resetForm();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 12 }}>
        <button className="btn btn-secondary" onClick={async () => { await api.processCardSettlements(); load(); }}>
          결제일 처리
        </button>
        <button className="btn btn-primary" onClick={openCreate}>+ 카드 추가</button>
      </div>
      {items.length === 0 ? (
        <p className="text-muted">등록된 카드가 없습니다.</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>이름</th>
                <th>유형</th>
                <th>연결</th>
                <th>결제일</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((card) => (
                <tr key={card.id}>
                  <td>{card.name}</td>
                  <td>{CARD_TYPES[card.card_type] || card.card_type}</td>
                  <td>
                    {card.card_type === 'debit'
                      ? card.linked_account_name
                      : `${card.settlement_account_name || '-'} → 부채`}
                  </td>
                  <td>{card.card_type === 'credit' && card.due_day ? `매월 ${card.due_day}일` : '-'}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEdit(card)}>수정</button>
                    {' '}
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={async () => {
                        if (!confirm(`"${card.name}" 카드를 삭제하시겠습니까?`)) return;
                        await api.deleteCard(card.id);
                        load();
                      }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal
        open={showForm}
        onClose={closeForm}
        title={editingId ? '카드 수정' : '카드 추가'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={closeForm}>취소</button>
            <button className="btn btn-primary" onClick={handleSave}>저장</button>
          </>
        }
      >
        <div className="form-group">
          <label>카드 유형</label>
          <select
            value={form.card_type}
            disabled={editingId !== null}
            onChange={(e) => setForm({ ...form, card_type: e.target.value as 'debit' | 'credit' })}
          >
            <option value="debit">체크카드</option>
            <option value="credit">신용카드</option>
          </select>
        </div>
        <div className="form-group">
          <label>카드 이름</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="KB국민 체크카드" />
        </div>
        {form.card_type === 'debit' ? (
          <div className="form-group">
            <label>연결 계좌</label>
            <select
              value={form.linked_account_id}
              onChange={(e) => setForm({ ...form, linked_account_id: e.target.value })}
            >
              <option value="">선택</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.institution}) — {formatMoney(account.cash_balance)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label>결제 계좌</label>
              <select
                value={form.settlement_account_id}
                onChange={(e) => setForm({ ...form, settlement_account_id: e.target.value })}
              >
                <option value="">선택</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} ({account.institution}) — {formatMoney(account.cash_balance)}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>결제일 (매월)</label>
              <input
                type="number"
                min={1}
                max={31}
                value={form.due_day}
                onChange={(e) => setForm({ ...form, due_day: e.target.value })}
              />
            </div>
            <p className="text-muted" style={{ fontSize: 13 }}>
              신용카드 지출은 부채로 누적되며, 결제일에 결제 계좌에서 자동 차감됩니다.
            </p>
          </>
        )}
      </Modal>
    </div>
  );
}

function LiabilitiesPanel() {
  const [items, setItems] = useState<Liability[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'loan', name: '', institution: '', current_balance: '', interest_rate: '' });

  const load = () => api.getLiabilities().then(setItems);
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    await api.createLiability({
      type: form.type,
      name: form.name,
      institution: form.institution || null,
      current_balance: Number(form.current_balance),
      interest_rate: form.interest_rate ? Number(form.interest_rate) : null,
    });
    setShowForm(false);
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ 부채 추가</button>
      </div>
      {items.length === 0 ? (
        <p className="text-muted">등록된 부채가 없습니다.</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead><tr><th>이름</th><th>유형</th><th>기관</th><th>잔액</th><th></th></tr></thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id}>
                  <td>{l.name}</td>
                  <td>{LIABILITY_TYPES[l.type] || l.type}</td>
                  <td>{l.institution}</td>
                  <td className="text-danger">{formatMoney(l.current_balance)}</td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={async () => { await api.deleteLiability(l.id); load(); }}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="부채 추가"
        footer={<><button className="btn btn-secondary" onClick={() => setShowForm(false)}>취소</button><button className="btn btn-primary" onClick={handleSave}>저장</button></>}>
        <div className="form-group">
          <label>유형</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="loan">대출</option>
            <option value="credit_card">신용카드</option>
            <option value="other">기타</option>
          </select>
        </div>
        <div className="form-group">
          <label>이름</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label>기관</label>
          <InstitutionSelect
            value={form.institution}
            onChange={(institution) => setForm({ ...form, institution })}
          />
        </div>
        <div className="form-group">
          <label>현재 잔액</label>
          <input type="number" value={form.current_balance} onChange={(e) => setForm({ ...form, current_balance: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}

function MarketPanel() {
  const [status, setStatus] = useState<MarketProviderStatus | null>(null);
  const [form, setForm] = useState({ client_id: '', client_secret: '' });
  const [saving, setSaving] = useState(false);

  const load = () => api.getMarketStatus().then(setStatus);
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.client_id.trim() || !form.client_secret.trim()) return;
    setSaving(true);
    try {
      const next = await api.saveMarketCredentials({
        client_id: form.client_id.trim(),
        client_secret: form.client_secret.trim(),
      });
      setStatus(next);
      setForm({ client_id: '', client_secret: '' });
    } catch (e) {
      alert(e instanceof Error ? e.message : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('토스증권 API 설정을 삭제하시겠습니까?')) return;
    const next = await api.deleteMarketCredentials();
    setStatus(next);
  };

  return (
    <div className="card">
      <h3 className="section-title" style={{ marginTop: 0 }}>증권 시세 API</h3>
      <p className="text-muted" style={{ marginBottom: 16 }}>
        종목명·현재가 조회에 토스증권 Open API를 사용합니다.
        {' '}<a href="https://developers.tossinvest.com" target="_blank" rel="noreferrer">개발자 콘솔</a>에서 Client ID/Secret을 발급받으세요.
      </p>

      {status && (
        <div className={`market-status market-status--${status.connected ? 'ok' : status.configured ? 'warn' : 'off'}`}>
          <strong>{status.provider === 'toss' ? '토스증권 API' : '폴백 모드'}</strong>
          <span>{status.message}</span>
        </div>
      )}

      <div className="form-group">
        <label>Client ID</label>
        <input
          value={form.client_id}
          onChange={(e) => setForm({ ...form, client_id: e.target.value })}
          placeholder="토스증권 Client ID"
          autoComplete="off"
        />
      </div>
      <div className="form-group">
        <label>Client Secret</label>
        <input
          type="password"
          value={form.client_secret}
          onChange={(e) => setForm({ ...form, client_secret: e.target.value })}
          placeholder="토스증권 Client Secret"
          autoComplete="new-password"
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
        <button className="btn btn-primary w-full sm:w-auto" onClick={handleSave} disabled={saving}>
          {saving ? '연결 확인 중...' : '저장 및 연결 테스트'}
        </button>
        {status?.configured && (
          <button className="btn btn-danger w-full sm:w-auto" onClick={handleDelete}>설정 삭제</button>
        )}
      </div>
      <p className="text-muted" style={{ marginTop: 16, fontSize: 13, marginBottom: 0 }}>
        환경변수 <code>TOSS_CLIENT_ID</code>, <code>TOSS_CLIENT_SECRET</code>로도 설정할 수 있습니다.
        API 미설정 시 네이버/야후 폴백을 사용합니다.
      </p>
    </div>
  );
}

function BackupPanel() {
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('현재 데이터가 백업 파일로 교체됩니다. 계속하시겠습니까?')) return;
    setRestoring(true);
    try {
      await api.restoreBackup(file);
      alert('복구 완료. 페이지를 새로고침합니다.');
      window.location.reload();
    } catch {
      alert('복구 실패');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="card">
      <h3 className="section-title" style={{ marginTop: 0 }}>데이터 백업</h3>
      <p className="text-muted" style={{ marginBottom: 20 }}>DB 파일: data/asset.db</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-3">
        <button className="btn btn-primary w-full sm:w-auto" onClick={() => api.downloadBackup()}>📥 백업 다운로드</button>
        <label className="btn btn-secondary w-full cursor-pointer sm:w-auto">
          {restoring ? '복구 중...' : '📤 백업 복구'}
          <input type="file" accept=".db" style={{ display: 'none' }} onChange={handleRestore} />
        </label>
      </div>
      <p className="text-muted" style={{ marginTop: 16, fontSize: 13 }}>
        ⚠ 복구 시 현재 데이터는 .bak으로 자동 백업됩니다.
      </p>
    </div>
  );
}

const SETTINGS_NAV = [
  { href: '/settings', label: '카테고리', exact: true },
  { href: '/settings/health', label: '건강' },
  { href: '/settings/recurring', label: '정기 항목' },
  { href: '/settings/cards', label: '내 카드' },
  { href: '/settings/liabilities', label: '부채' },
  { href: '/settings/market', label: '증권 API' },
  { href: '/settings/backup', label: '백업' },
];

function SettingsContent() {
  const pathname = usePathname();
  if (pathname === '/settings/health') return <HealthSettingsPanel />;
  if (pathname === '/settings/recurring') return <RecurringPanel />;
  if (pathname === '/settings/cards') return <CardsPanel />;
  if (pathname === '/settings/liabilities') return <LiabilitiesPanel />;
  if (pathname === '/settings/market') return <MarketPanel />;
  if (pathname === '/settings/backup') return <BackupPanel />;
  return <CategoriesPanel />;
}

export default function SettingsPage() {
  const pathname = usePathname();

  return (
    <>
      <PageHeader title="설정" />
      <div className="settings-layout">
        <nav className="settings-nav">
          {SETTINGS_NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? 'active' : ''}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="settings-content">
          <SettingsContent />
        </div>
      </div>
    </>
  );
}
