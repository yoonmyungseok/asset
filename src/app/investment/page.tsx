'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { PageHeader } from '@/components/layout/AppLayout';
import type { Account, AccountPerformance } from '@/types/api';
import { CATEGORY_LABELS, formatMoney, formatPercent, toWholeMoney } from '@/lib/utils/format';
import Modal from '@/components/common/Modal';
import InstitutionSelect from '@/components/common/InstitutionSelect';

export default function InvestmentPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [performance, setPerformance] = useState<Record<number, AccountPerformance>>({});
  const [filter, setFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [accountTypes, setAccountTypes] = useState<{ id: number; name: string; category: string; supports_holdings: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    account_type_id: '',
    name: '',
    institution: '',
    cash_balance: '0',
    interest_rate: '',
    maturity_date: '',
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [accs, perf, types] = await Promise.all([
        api.getAccounts({ include_summary: true }),
        api.getAccountPerformance(),
        api.getAccountTypes(),
      ]);
      setAccounts(accs);
      setAccountTypes(types);
      const perfMap: Record<number, AccountPerformance> = {};
      perf.forEach((p) => { perfMap[p.account_id] = p; });
      setPerformance(perfMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : '데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? accounts : accounts.filter((a) => a.account_type?.category === filter);

  const groups = ['investment', 'pension', 'deposit', 'cash'].map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat] || cat,
    accounts: filtered.filter((a) => a.account_type?.category === cat),
    total: filtered
      .filter((a) => a.account_type?.category === cat)
      .reduce((s, a) => s + Number(a.summary?.total_value ?? a.cash_balance), 0),
  })).filter((g) => g.accounts.length > 0 || filter === g.category);

  const grandTotal = accounts.reduce((s, a) => s + Number(a.summary?.total_value ?? a.cash_balance), 0);

  const handleCreate = async () => {
    const selectedType = accountTypes.find((t) => t.id === Number(form.account_type_id));
    const payload: Record<string, unknown> = {
      account_type_id: Number(form.account_type_id),
      name: form.name,
      institution: form.institution || null,
      cash_balance: toWholeMoney(form.cash_balance),
    };
    if (selectedType?.category === 'deposit') {
      payload.metadata = {
        interest_rate: form.interest_rate ? Number(form.interest_rate) : null,
        maturity_date: form.maturity_date || null,
      };
    }
    await api.createAccount(payload);
    setShowForm(false);
    setForm({
      account_type_id: '',
      name: '',
      institution: '',
      cash_balance: '0',
      interest_rate: '',
      maturity_date: '',
    });
    load();
  };

  const handleRefreshPrices = async () => {
    await api.refreshPrices();
    load();
  };

  return (
    <>
      <PageHeader
        title="자산"
        actions={
          <>
            <button className="btn btn-secondary" onClick={handleRefreshPrices}>시세 갱신</button>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ 계좌 추가</button>
          </>
        }
      />

      <div className="filters">
        <div className="filter-chips">
          {['all', 'investment', 'pension', 'deposit', 'cash'].map((f) => (
            <button
              key={f}
              className={`btn btn-sm shrink-0 ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? '전체' : CATEGORY_LABELS[f]}
            </button>
          ))}
        </div>
        <span className="filters-total">총 평가: <strong>{formatMoney(grandTotal)}</strong></span>
      </div>

      {loading ? (
        <div className="loading">로딩 중...</div>
      ) : error ? (
        <div className="empty-state card">
          <h3>데이터를 불러오지 못했습니다</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={load}>다시 시도</button>
        </div>
      ) : accounts.length === 0 ? (
        <div className="empty-state card">
          <h3>등록된 계좌가 없습니다</h3>
          <p>ISA, IRP, 증권, 예적금, 입출금 계좌를 등록해보세요.</p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ 계좌 추가</button>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.category} className="mb-6">
            <div className="group-header">
              <span>▼ {group.label} ({formatMoney(group.total)})</span>
            </div>
            <div className="card p-0">
              {group.accounts.map((account) => {
                const perf = performance[account.id];
                const typeInfo = accountTypes.find((t) => t.id === account.account_type_id);
                const supportsHoldings = typeInfo?.supports_holdings ?? account.account_type?.supports_holdings ?? false;
                return (
                  <div
                    key={account.id}
                    className="account-row"
                    onClick={() => router.push(`/investment/accounts/${account.id}`)}
                  >
                    <div className="account-row-info">
                      <span className="account-row-name">{account.name}</span>
                      <span className="account-row-meta">
                        {account.account_type?.name} {account.institution && `· ${account.institution}`}
                      </span>
                    </div>
                    <div className="account-row-value">
                      <div>{formatMoney(account.summary?.total_value ?? account.cash_balance)}</div>
                      {supportsHoldings && perf && (
                        <div className={`text-[13px] ${Number(perf.profit_loss_rate) >= 0 ? 'text-success' : 'text-danger'}`}>
                          {formatPercent(perf.profit_loss_rate)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="계좌 추가"
        footer={
          <div className="flex w-full items-center gap-2.5">
            <button
              type="button"
              className="flex h-11 flex-1 items-center justify-center rounded-xl bg-gray-100 px-4 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-200 active:scale-95 touch-manipulation sm:h-10 sm:flex-initial sm:text-sm"
              onClick={() => setShowForm(false)}
            >
              취소
            </button>
            <button
              type="button"
              className="flex h-11 flex-1 items-center justify-center rounded-xl bg-blue-600 px-5 text-xs font-bold text-white shadow-md shadow-blue-600/30 transition-all hover:bg-blue-500 active:scale-95 touch-manipulation sm:h-10 sm:flex-initial sm:min-w-[100px] sm:text-sm"
              onClick={handleCreate}
            >
              저장
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">계좌 유형</label>
            <div className="relative">
              <select
                value={form.account_type_id}
                onChange={(e) => setForm({ ...form, account_type_id: e.target.value })}
                className="flex h-12 w-full appearance-none items-center rounded-xl border border-gray-200 bg-white px-3.5 pr-9 text-base text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
              >
                <option value="">계좌 유형 선택</option>
                {accountTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-xs text-gray-400">
                ▼
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">계좌명</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: 키움 ISA, 토스 파킹통장"
              className="flex h-12 w-full items-center rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-gray-600">금융기관</label>
            <InstitutionSelect
              value={form.institution}
              onChange={(institution) => setForm({ ...form, institution })}
              placeholder="금융기관 선택"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-600">현재 잔고 / 예수금</label>
              {Number(form.cash_balance) > 0 && (
                <span className="text-xs font-bold text-blue-600">
                  {formatMoney(form.cash_balance)}
                </span>
              )}
            </div>
            <div className="relative flex items-center">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.cash_balance ? Number(form.cash_balance).toLocaleString() : ''}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setForm({ ...form, cash_balance: raw });
                }}
                placeholder="0"
                className="flex h-12 w-full items-center rounded-xl border border-gray-200 bg-white px-3.5 pr-8 text-base font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              <span className="pointer-events-none absolute right-3 text-sm font-semibold text-gray-400">원</span>
            </div>
          </div>

          {accountTypes.find((t) => t.id === Number(form.account_type_id))?.category === 'deposit' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-2xl border border-gray-100 bg-gray-50/70 p-3.5">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">연 이자율 (%)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.interest_rate}
                  onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
                  placeholder="예: 3.5"
                  className="flex h-12 w-full items-center rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">만기일</label>
                <input
                  type="date"
                  value={form.maturity_date}
                  onChange={(e) => setForm({ ...form, maturity_date: e.target.value })}
                  className="flex h-12 w-full items-center rounded-xl border border-gray-200 bg-white px-3.5 text-base text-gray-900 focus:border-blue-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
