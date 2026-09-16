'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { PageHeader } from '@/components/layout/AppLayout';
import type { Account, AccountPerformance } from '@/types/api';
import { CATEGORY_LABELS, formatAccountMeta, formatMoney, formatPercent, toWholeMoney } from '@/lib/utils/format';
import Modal from '@/components/common/Modal';
import InstitutionSelect from '@/components/common/InstitutionSelect';
import InstitutionIcon from '@/components/common/InstitutionIcon';

export default function InvestmentPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [performance, setPerformance] = useState<Record<number, AccountPerformance>>({});
  const [filter, setFilter] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [accountTypes, setAccountTypes] = useState<{ id: number; name: string; category: string; supports_holdings: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priceRefreshing, setPriceRefreshing] = useState(false);
  const [priceMessage, setPriceMessage] = useState<string | null>(null);
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
    setPriceRefreshing(true);
    setPriceMessage(null);
    try {
      const result = await api.refreshPrices();
      await load();
      if (result.failed.length > 0) {
        const detail = result.failed.slice(0, 2).map((f) => `${f.symbol}: ${f.reason}`).join(', ');
        setPriceMessage(`${result.updated}건 갱신, ${result.failed.length}건 실패 (${detail})`);
      } else if (result.updated === 0) {
        setPriceMessage('갱신할 주식·ETF 보유 종목이 없습니다.');
      } else {
        setPriceMessage(`${result.updated}건 시세를 갱신했습니다.`);
      }
    } catch (e) {
      setPriceMessage(e instanceof Error ? e.message : '시세 갱신에 실패했습니다.');
    } finally {
      setPriceRefreshing(false);
    }
  };

  return (
    <>
      <PageHeader
        title="자산"
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleRefreshPrices}
              disabled={priceRefreshing || loading}
            >
              {priceRefreshing ? '시세 갱신 중...' : '시세 갱신'}
            </button>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ 계좌 추가</button>
          </>
        }
      />

      {priceMessage && (
        <p className="mb-4 text-sm text-gray-600" role="status">{priceMessage}</p>
      )}

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
                      <div className="account-row-title">
                        <InstitutionIcon institution={account.institution} />
                        <span className="account-row-name">{account.name}</span>
                      </div>
                      <span className="account-row-meta">
                        {formatAccountMeta(account)}
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
          <>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>취소</button>
            <button className="btn btn-primary" onClick={handleCreate}>저장</button>
          </>
        }
      >
        <div className="form-group">
          <label>계좌 유형</label>
          <select value={form.account_type_id} onChange={(e) => setForm({ ...form, account_type_id: e.target.value })}>
            <option value="">선택</option>
            {accountTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>계좌명</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="키움 ISA" />
        </div>
        <div className="form-group">
          <label>금융기관</label>
          <InstitutionSelect
            value={form.institution}
            onChange={(institution) => setForm({ ...form, institution })}
          />
        </div>
        <div className="form-group">
          <label>현재 잔고/예수금</label>
          <input
            type="number"
            step="1"
            min="0"
            value={form.cash_balance}
            onChange={(e) => setForm({ ...form, cash_balance: e.target.value })}
          />
        </div>
        {accountTypes.find((t) => t.id === Number(form.account_type_id))?.category === 'deposit' && (
          <div className="form-row">
            <div className="form-group">
              <label>연 이자율 (%)</label>
              <input
                type="number"
                step="0.01"
                value={form.interest_rate}
                onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
                placeholder="3.5"
              />
            </div>
            <div className="form-group">
              <label>만기일</label>
              <input
                type="date"
                value={form.maturity_date}
                onChange={(e) => setForm({ ...form, maturity_date: e.target.value })}
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
