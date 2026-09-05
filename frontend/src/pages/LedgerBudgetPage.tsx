import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { PageHeader } from '../components/layout/AppLayout';
import type { Budget, CategoryTree } from '../types/api';
import { currentYearMonth, formatMoney } from '../utils/format';
import Modal from '../components/common/Modal';

export default function LedgerBudgetPage() {
  const { year, month } = currentYearMonth();
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
            <Link to="/ledger" className="btn btn-secondary">← 거래목록</Link>
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ 예산 설정</button>
          </>
        }
      />

      <p className="text-muted" style={{ marginBottom: 16 }}>{year}년 {month}월</p>

      {budgets.length === 0 ? (
        <div className="empty-state card">
          <h3>설정된 예산이 없습니다</h3>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ 예산 설정</button>
        </div>
      ) : (
        <div className="card">
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
                    <div className="progress-bar" style={{ width: 120 }}>
                      <div
                        className={`progress-bar-fill${b.over_budget ? ' over' : Number(b.usage_rate) >= 90 ? ' near' : ''}`}
                        style={{ width: `${Math.min(Number(b.usage_rate), 100)}%` }}
                      />
                    </div>
                    <span className={b.over_budget ? 'text-danger' : ''}>{b.usage_rate}%</span>
                    {b.over_budget && ' 🔴'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
