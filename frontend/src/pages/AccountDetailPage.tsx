import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { api } from '../api/client';
import { PageHeader } from '../components/layout/AppLayout';
import InvestmentTxFormModal from '../components/investment/InvestmentTxFormModal';
import HoldingFormModal, { emptyHoldingFormValues } from '../components/investment/HoldingFormModal';
import type { HoldingFormValues } from '../components/investment/HoldingFormModal';
import InstitutionSelect from '../components/common/InstitutionSelect';
import type { Account, AccountLimit, AccountType, Holding, InvestmentTransaction } from '../types/api';
import { formatMoney, formatPercent, formatQuantity, INVESTMENT_TX_TYPES, ASSET_CLASS_LABELS, formatInterestRate, formatMaturityLabel } from '../utils/format';
import Modal from '../components/common/Modal';

export default function AccountDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const accountId = Number(id);
  const [account, setAccount] = useState<Account | null>(null);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [limit, setLimit] = useState<AccountLimit | null>(null);
  const [snapshots, setSnapshots] = useState<{ snapshot_date: string; balance_value: string }[]>([]);
  const [showTxForm, setShowTxForm] = useState(false);
  const [showHoldingForm, setShowHoldingForm] = useState(false);
  const [editingHoldingId, setEditingHoldingId] = useState<number | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showLimitForm, setShowLimitForm] = useState(false);
  const [editForm, setEditForm] = useState({
    account_type_id: '',
    name: '',
    institution: '',
    cash_balance: '',
    interest_rate: '',
    maturity_date: '',
  });
  const [limitForm, setLimitForm] = useState({ year: String(new Date().getFullYear()), contribution_limit: '' });
  const [holdingForm, setHoldingForm] = useState<HoldingFormValues>(emptyHoldingFormValues());

  const load = async () => {
    const [acc, types, tx, limits, snaps] = await Promise.all([
      api.getAccount(accountId),
      api.getAccountTypes(),
      api.getInvestmentTransactions({ account_id: accountId, page_size: 20 }),
      api.getAccountLimits(new Date().getFullYear()),
      api.getAccountSnapshots(accountId),
    ]);

    const accountType = types.find((t) => t.id === acc.account_type_id);
    const supportsHoldings = accountType?.supports_holdings ?? acc.account_type?.supports_holdings ?? false;

    let holdings: Holding[] = [];
    if (supportsHoldings) {
      holdings = await api.getHoldings(accountId);
      const missingPriceIds = holdings
        .filter((holding) => holding.asset_class !== 'deposit' && !holding.last_market_price)
        .map((holding) => holding.id);
      if (missingPriceIds.length > 0) {
        await api.refreshPrices(missingPriceIds);
        holdings = await api.getHoldings(accountId);
      }
    }

    setAccount(acc);
    setAccountTypes(types);
    setHoldings(holdings);
    setTransactions(tx.items);
    setLimit(limits.find((l) => l.account_id === accountId) ?? null);
    setSnapshots(snaps);
  };

  useEffect(() => { if (accountId) load(); }, [accountId]);

  if (!account) return <div className="loading">로딩 중...</div>;

  const totalValue = Number(account.summary?.total_value ?? account.cash_balance);
  const holdingsValue = Number(account.summary?.holdings_value ?? 0);
  const accountType = accountTypes.find((t) => t.id === account.account_type_id);
  const supportsHoldings = accountType?.supports_holdings ?? account.account_type?.supports_holdings ?? false;
  const supportsLimit = accountType?.supports_contribution_limit ?? false;
  const isDepositAccount = accountType?.category === 'deposit';
  const hasLimit = limit && Number(limit.contribution_limit) > 0;

  const depositPayload = (values: { interest_rate: string; start_date: string; maturity_date: string }) => ({
    interest_rate: values.interest_rate ? Number(values.interest_rate) : null,
    start_date: values.start_date || null,
    maturity_date: values.maturity_date || null,
  });

  const handleAddHolding = async (values: HoldingFormValues) => {
    if (values.asset_class === 'deposit') {
      if (!values.name || !values.quantity) return;
    } else if (!values.symbol || !values.name || !values.quantity || !values.avg_cost_price) {
      return;
    }

    const depositFields = values.asset_class === 'deposit' ? depositPayload(values) : {};

    if (editingHoldingId) {
      await api.updateHolding(editingHoldingId, {
        name: values.name,
        quantity: Number(values.quantity),
        avg_cost_price: values.asset_class === 'deposit' ? 1 : Number(values.avg_cost_price),
        manual_price: values.asset_class === 'deposit' ? 1 : undefined,
        ...depositFields,
      });
    } else {
      await api.createHolding({
        account_id: accountId,
        asset_class: values.asset_class,
        symbol: values.asset_class === 'deposit' ? null : values.symbol,
        name: values.name,
        quantity: Number(values.quantity),
        avg_cost_price: values.asset_class === 'deposit' ? 1 : Number(values.avg_cost_price),
        ...depositFields,
      });
    }
    closeHoldingForm();
    load();
  };

  const openCreateHoldingForm = () => {
    setEditingHoldingId(null);
    setHoldingForm(emptyHoldingFormValues());
    setShowHoldingForm(true);
  };

  const openEditHoldingForm = (holding: Holding) => {
    setEditingHoldingId(holding.id);
    setHoldingForm({
      asset_class: holding.asset_class === 'deposit' ? 'deposit' : 'stock',
      symbol: holding.symbol,
      name: holding.name,
      quantity: holding.asset_class === 'deposit'
        ? String(Math.round(Number(holding.quantity)))
        : String(holding.quantity),
      avg_cost_price: String(holding.avg_cost_price),
      interest_rate: holding.interest_rate ? String(holding.interest_rate) : '',
      start_date: holding.start_date ? holding.start_date.slice(0, 10) : '',
      maturity_date: holding.maturity_date ? holding.maturity_date.slice(0, 10) : '',
    });
    setShowHoldingForm(true);
  };

  const closeHoldingForm = () => {
    setShowHoldingForm(false);
    setEditingHoldingId(null);
    setHoldingForm(emptyHoldingFormValues());
  };

  const handleDeleteHolding = async (holding: Holding) => {
    if (!confirm(`"${holding.name}" 종목을 삭제하시겠습니까?`)) return;
    await api.deleteHolding(holding.id);
    load();
  };

  const openEditForm = () => {
    setEditForm({
      account_type_id: String(account.account_type_id),
      name: account.name,
      institution: account.institution ?? '',
      cash_balance: String(account.cash_balance),
      interest_rate: account.metadata?.interest_rate != null ? String(account.metadata.interest_rate) : '',
      maturity_date: account.metadata?.maturity_date ? String(account.metadata.maturity_date).slice(0, 10) : '',
    });
    setShowEditForm(true);
  };

  const handleUpdateAccount = async () => {
    const selectedType = accountTypes.find((t) => t.id === Number(editForm.account_type_id));
    const payload: Record<string, unknown> = {
      account_type_id: Number(editForm.account_type_id),
      name: editForm.name,
      institution: editForm.institution || null,
      cash_balance: Number(editForm.cash_balance),
    };
    if (selectedType?.category === 'deposit') {
      payload.metadata = {
        ...account.metadata,
        interest_rate: editForm.interest_rate ? Number(editForm.interest_rate) : null,
        maturity_date: editForm.maturity_date || null,
      };
    }
    await api.updateAccount(accountId, payload);
    setShowEditForm(false);
    load();
  };

  const handleRemoveAccount = async () => {
    const hasData = holdings.length > 0 || transactions.length > 0;
    if (hasData) {
      if (!confirm('보유 종목이나 거래 내역이 있어 완전 삭제할 수 없습니다. 계좌를 비활성화하시겠습니까?')) return;
      await api.deactivateAccount(accountId);
    } else {
      if (!confirm('이 계좌를 삭제하시겠습니까?')) return;
      await api.deleteAccount(accountId);
    }
    navigate('/investment');
  };

  const openLimitForm = () => {
    setLimitForm({
      year: String(limit?.year ?? new Date().getFullYear()),
      contribution_limit: limit ? String(limit.contribution_limit) : '',
    });
    setShowLimitForm(true);
  };

  const handleSaveLimit = async () => {
    if (!limitForm.contribution_limit) return;
    await api.upsertAccountLimit({
      account_id: accountId,
      year: Number(limitForm.year),
      contribution_limit: Number(limitForm.contribution_limit),
    });
    setShowLimitForm(false);
    load();
  };

  const handleDeleteLimit = async () => {
    if (!limit) return;
    if (!confirm(`${limit.year}년 연간 한도를 삭제하시겠습니까?`)) return;
    await api.deleteAccountLimit(limit.id);
    load();
  };

  return (
    <>
      <PageHeader
        title={account.name}
        actions={
          <>
            <Link to="/investment" className="btn btn-secondary">← 투자</Link>
            <button className="btn btn-secondary" onClick={openEditForm}>계좌 수정</button>
            <button className="btn btn-danger" onClick={handleRemoveAccount}>삭제</button>
            <button className="btn btn-primary" onClick={() => setShowTxForm(true)}>거래 추가</button>
          </>
        }
      />
      <p className="text-muted" style={{ marginBottom: 16 }}>
        {account.account_type?.name} {account.institution && `· ${account.institution}`}
      </p>

      <div className={`card-grid ${supportsHoldings ? 'card-grid-4' : 'card-grid-1'}`} style={{ marginBottom: 16 }}>
        <div className="card stat-card">
          <div className="stat-label">{supportsHoldings ? '총 평가' : '잔고'}</div>
          <div className="stat-value">{formatMoney(totalValue)}</div>
        </div>
        {supportsHoldings && (
          <>
            <div className="card stat-card">
              <div className="stat-label">예수금</div>
              <div className="stat-value">{formatMoney(account.cash_balance)}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">종목 평가</div>
              <div className="stat-value">{formatMoney(holdingsValue)}</div>
            </div>
            <div className="card stat-card">
              <div className="stat-label">보유 종목</div>
              <div className="stat-value">{holdings.length}개</div>
            </div>
          </>
        )}
      </div>

      {isDepositAccount && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 className="section-title" style={{ marginTop: 0 }}>상품 정보</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <div>
              <div className="text-muted" style={{ fontSize: 13 }}>연 이자율</div>
              <div style={{ fontWeight: 600 }}>{formatInterestRate(account.metadata?.interest_rate as string | number | null)}</div>
            </div>
            <div>
              <div className="text-muted" style={{ fontSize: 13 }}>만기일</div>
              <div style={{ fontWeight: 600 }}>{formatMaturityLabel(account.metadata?.maturity_date as string | undefined)}</div>
            </div>
          </div>
        </div>
      )}

      {supportsLimit && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: hasLimit ? 8 : 0 }}>
            <span style={{ fontWeight: 600 }}>연간 납입 한도</span>
            <span style={{ display: 'flex', gap: 8 }}>
              {hasLimit ? (
                <>
                  <button className="btn btn-sm btn-secondary" onClick={openLimitForm}>수정</button>
                  <button className="btn btn-sm btn-danger" onClick={handleDeleteLimit}>삭제</button>
                </>
              ) : (
                <button className="btn btn-sm btn-primary" onClick={openLimitForm}>+ 한도 설정</button>
              )}
            </span>
          </div>
          {hasLimit && limit && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="text-muted">{limit.year}년</span>
                <span>
                  {formatMoney(limit.contributed_amount)} / {formatMoney(limit.contribution_limit)} ({limit.usage_rate}%)
                </span>
              </div>
              <div className="progress-bar">
                <div className="progress-bar-fill" style={{ width: `${Math.min(Number(limit.usage_rate), 100)}%` }} />
              </div>
              <p className="text-muted" style={{ marginTop: 8, marginBottom: 0, fontSize: 13 }}>
                잔여 {formatMoney(limit.remaining_amount)} · 입금·매수 거래 합계로 납입액 자동 계산
              </p>
            </>
          )}
          {!hasLimit && (
            <p className="text-muted" style={{ margin: '8px 0 0', fontSize: 13 }}>
              ISA·IRP 등 연간 납입 한도가 있는 계좌입니다.
            </p>
          )}
        </div>
      )}

      {supportsHoldings && (
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="section-title" style={{ margin: 0 }}>보유 종목</h3>
          <span style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-sm btn-secondary"
              onClick={async () => {
                const stockIds = holdings.filter((holding) => holding.asset_class !== 'deposit').map((holding) => holding.id);
                if (stockIds.length === 0) return;
                await api.refreshPrices(stockIds);
                load();
              }}
            >
              시세 갱신
            </button>
            <button className="btn btn-sm btn-primary" onClick={openCreateHoldingForm}>+ 보유 추가</button>
          </span>
        </div>
        {holdings.length === 0 ? (
          <p className="text-muted" style={{ padding: '20px 0' }}>보유 종목이 없습니다.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>상품</th>
                <th>유형</th>
                <th>수량/원금</th>
                <th>금리</th>
                <th>가입일</th>
                <th>만기일</th>
                <th>미수이자</th>
                <th>평가금액</th>
                <th>수익률</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {holdings.map((h) => {
                const isDeposit = h.asset_class === 'deposit';
                return (
                <tr key={h.id}>
                  <td>
                    <strong>{h.name}</strong>
                    {!isDeposit && <><br /><span className="text-muted" style={{ fontSize: 12 }}>{h.symbol}</span></>}
                  </td>
                  <td>{ASSET_CLASS_LABELS[h.asset_class] || h.asset_class}</td>
                  <td>{isDeposit ? formatMoney(h.quantity) : formatQuantity(h.quantity)}</td>
                  <td>{isDeposit ? formatInterestRate(h.interest_rate) : '-'}</td>
                  <td>{isDeposit ? formatMaturityLabel(h.start_date) : '-'}</td>
                  <td>{isDeposit ? formatMaturityLabel(h.maturity_date) : '-'}</td>
                  <td>{isDeposit ? formatMoney(h.accrued_interest) : '-'}</td>
                  <td>{formatMoney(h.market_value)}</td>
                  <td className={Number(h.profit_loss_rate) >= 0 ? 'text-success' : 'text-danger'}>
                    {formatPercent(h.profit_loss_rate)}
                  </td>
                  <td>
                    <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button className="btn btn-sm btn-secondary" onClick={() => openEditHoldingForm(h)}>수정</button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDeleteHolding(h)}>삭제</button>
                    </span>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 className="section-title" style={{ marginTop: 0 }}>최근 거래</h3>
        {transactions.length === 0 ? (
          <p className="text-muted">거래 내역이 없습니다.</p>
        ) : (
          <table className="table">
            <thead>
              <tr><th>날짜</th><th>유형</th><th>금액</th><th>메모</th></tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>{tx.transaction_date}</td>
                  <td>{INVESTMENT_TX_TYPES[tx.type] || tx.type}</td>
                  <td>{formatMoney(tx.amount)}</td>
                  <td className="text-muted">{tx.memo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {snapshots.length > 0 && (
        <div className="card">
          <h3 className="section-title" style={{ marginTop: 0 }}>평가 추이</h3>
          <div className="chart-container">
            <ResponsiveContainer>
              <LineChart data={snapshots}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="snapshot_date" tickFormatter={(v) => v.slice(5)} />
                <YAxis tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                <Tooltip formatter={(v: number) => formatMoney(v)} />
                <Line type="monotone" dataKey="balance_value" name="평가금액" stroke="#2563eb" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <InvestmentTxFormModal
        open={showTxForm}
        onClose={() => setShowTxForm(false)}
        onSaved={load}
        accountId={accountId}
      />

      <Modal
        open={showLimitForm}
        onClose={() => setShowLimitForm(false)}
        title={hasLimit ? '연간 한도 수정' : '연간 한도 설정'}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowLimitForm(false)}>취소</button>
            <button className="btn btn-primary" onClick={handleSaveLimit}>저장</button>
          </>
        }
      >
        <div className="form-group">
          <label>연도</label>
          <input
            type="number"
            value={limitForm.year}
            onChange={(e) => setLimitForm({ ...limitForm, year: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label>연간 납입 한도 (원)</label>
          <input
            type="number"
            value={limitForm.contribution_limit}
            onChange={(e) => setLimitForm({ ...limitForm, contribution_limit: e.target.value })}
            placeholder="20000000"
            autoFocus
          />
        </div>
      </Modal>

      <Modal
        open={showEditForm}
        onClose={() => setShowEditForm(false)}
        title="계좌 수정"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowEditForm(false)}>취소</button>
            <button className="btn btn-primary" onClick={handleUpdateAccount}>저장</button>
          </>
        }
      >
        <div className="form-group">
          <label>계좌 유형</label>
          <select
            value={editForm.account_type_id}
            onChange={(e) => setEditForm({ ...editForm, account_type_id: e.target.value })}
          >
            {accountTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>계좌명</label>
          <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
        </div>
        <div className="form-group">
          <label>금융기관</label>
          <InstitutionSelect
            value={editForm.institution}
            onChange={(institution) => setEditForm({ ...editForm, institution })}
          />
        </div>
        <div className="form-group">
          <label>현재 잔고/예수금</label>
          <input
            type="number"
            value={editForm.cash_balance}
            onChange={(e) => setEditForm({ ...editForm, cash_balance: e.target.value })}
          />
        </div>
        {accountTypes.find((t) => t.id === Number(editForm.account_type_id))?.category === 'deposit' && (
          <div className="form-row">
            <div className="form-group">
              <label>연 이자율 (%)</label>
              <input
                type="number"
                step="0.01"
                value={editForm.interest_rate}
                onChange={(e) => setEditForm({ ...editForm, interest_rate: e.target.value })}
                placeholder="3.5"
              />
            </div>
            <div className="form-group">
              <label>만기일</label>
              <input
                type="date"
                value={editForm.maturity_date}
                onChange={(e) => setEditForm({ ...editForm, maturity_date: e.target.value })}
              />
            </div>
          </div>
        )}
      </Modal>

      <HoldingFormModal
        open={showHoldingForm}
        editing={Boolean(editingHoldingId)}
        initialValues={holdingForm}
        onClose={closeHoldingForm}
        onSave={handleAddHolding}
      />
    </>
  );
}
