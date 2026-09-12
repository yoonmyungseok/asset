'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api/client';
import { PageHeader } from '@/components/layout/AppLayout';
import MonthNavigator from '@/components/ledger/MonthNavigator';
import { useLedgerMonth } from '@/hooks/useLedgerMonth';
import type { Budget, CategoryTree } from '@/types/api';
import { formatMoney } from '@/lib/utils/format';
import Modal from '@/components/common/Modal';

function budgetFillClass(b: Budget) {
  if (b.over_budget) return ' over';
  if (Number(b.usage_rate) >= 90) return ' near';
  return '';
}

function BudgetUsageBar({ budget, compact }: { budget: Budget; compact?: boolean }) {
  return (
    <div className={compact ? 'budget-card-usage' : 'flex flex-wrap items-center gap-2'}>
      <div className={`progress-bar ${compact ? 'w-full' : 'w-full sm:w-[120px]'}`}>
        <div
          className={`progress-bar-fill${budgetFillClass(budget)}`}
          style={{ width: `${Math.min(Number(budget.usage_rate), 100)}%` }}
        />
      </div>
      {!compact && (
        <span className={budget.over_budget ? 'text-danger' : ''}>
          {budget.usage_rate}%{budget.over_budget && ' 🔴'}
        </span>
      )}
    </div>
  );
}

export default function LedgerBudgetPage() {
  const { year, month, monthQuery } = useLedgerMonth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<CategoryTree[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formCategoryId, setFormCategoryId] = useState<number | ''>('');
  const [formAmount, setFormAmount] = useState('');

  const load = () => api.getBudgets(year, month).then(setBudgets);

  useEffect(() => {
    load();
    api.getCategories().then(setCategories);
  }, [year, month]);

  const expenseCategories = categories.filter((c) => c.type === 'expense');

  const handleSave = async () => {
    if (!formCategoryId || !formAmount) return;
    await api.upsertBudget({
      category_id: formCategoryId,
      year,
      month,
      amount: Number(formAmount),
    });
    setShowForm(false);
    setFormAmount('');
    load();
  };

  return (
    <>
      <PageHeader
        title="예산 관리"
        actions={
          <>
            <Link href={`/ledger${monthQuery}`} className="btn btn-secondary">← 거래목록</Link>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ 예산 설정</button>
          </>
        }
      />

      <div className="filters">
        <MonthNavigator />
      </div>

      {budgets.length === 0 ? (
        <div className="empty-state card">
          <h3>설정된 예산이 없습니다</h3>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ 예산 설정</button>
        </div>
      ) : (
        <>
          <div className="budget-list lg:hidden">
            {budgets.map((b) => (
              <div
                key={b.id}
                className={`card budget-card${b.over_budget ? ' budget-card--over' : ''}`}
              >
                <div className="budget-card-header">
                  <span className="budget-card-name">{b.category_name}</span>
                  <span className={b.over_budget ? 'text-danger font-semibold' : 'font-medium'}>
                    {b.usage_rate}%{b.over_budget && ' 🔴'}
                  </span>
                </div>
                <div className="budget-card-stats">
                  <div>
                    <div className="budget-card-stat-label">예산</div>
                    <div>{formatMoney(b.amount)}</div>
                  </div>
                  <div>
                    <div className="budget-card-stat-label">사용</div>
                    <div>{formatMoney(b.spent)}</div>
                  </div>
                  <div>
                    <div className="budget-card-stat-label">잔여</div>
                    <div className={Number(b.remaining) < 0 ? 'text-danger' : ''}>
                      {formatMoney(b.remaining)}
                    </div>
                  </div>
                </div>
                <BudgetUsageBar budget={b} compact />
              </div>
            ))}
          </div>

          <div className="card hidden lg:block">
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>카테고리</th><th>예산</th><th>사용</th><th>잔여</th><th>사용률</th>
                  </tr>
                </thead>
                <tbody>
                  {budgets.map((b) => (
                    <tr key={b.id}>
                      <td>{b.category_name}</td>
                      <td>{formatMoney(b.amount)}</td>
                      <td>{formatMoney(b.spent)}</td>
                      <td className={Number(b.remaining) < 0 ? 'text-danger' : ''}>{formatMoney(b.remaining)}</td>
                      <td>
                        <BudgetUsageBar budget={b} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="예산 설정"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>취소</button>
            <button className="btn btn-primary" onClick={handleSave}>저장</button>
          </>
        }
      >
        <div className="form-group">
          <label>카테고리 (1차)</label>
          <select value={formCategoryId} onChange={(e) => setFormCategoryId(Number(e.target.value))}>
            <option value="">선택</option>
            {expenseCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>예산 금액</label>
          <input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} />
        </div>
      </Modal>
    </>
  );
}
