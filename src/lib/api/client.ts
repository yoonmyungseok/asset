const BASE = '/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail;
    const message = typeof detail === 'string'
      ? detail
      : Array.isArray(detail)
        ? detail.map((d: { msg?: string }) => d.msg).join(', ')
        : res.statusText || '요청 실패';
    throw new Error(message || '요청 실패');
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

function qs(params: Record<string, string | number | boolean | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const api = {
  health: () => request<{ status: string }>('/health'),
  initialize: () => request('/setup/initialize', { method: 'POST' }),

  getAccountTypes: () => request<import('@/types/api').AccountType[]>('/account-types'),
  getInstitutions: () => request<import('@/types/api').InstitutionGroup[]>('/institutions'),
  getAccounts: (params?: Record<string, string | number | boolean>) =>
    request<import('@/types/api').Account[]>(`/accounts${qs(params || {})}`),
  getAccount: (id: number) => request<import('@/types/api').Account>(`/accounts/${id}`),
  createAccount: (data: object) =>
    request<import('@/types/api').Account>('/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id: number, data: object) =>
    request(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteAccount: (id: number) =>
    request(`/accounts/${id}`, { method: 'DELETE' }),
  deactivateAccount: (id: number) =>
    request(`/accounts/${id}/deactivate`, { method: 'POST' }),

  getHoldings: (accountId?: number) =>
    request<import('@/types/api').Holding[]>(`/holdings${qs({ account_id: accountId })}`),
  createHolding: (data: object) =>
    request('/holdings', { method: 'POST', body: JSON.stringify(data) }),
  updateHolding: (id: number, data: object) =>
    request(`/holdings/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteHolding: (id: number) =>
    request(`/holdings/${id}`, { method: 'DELETE' }),
  refreshPrices: (holdingIds?: number[]) =>
    request('/holdings/refresh-prices', {
      method: 'POST',
      body: JSON.stringify({ holding_ids: holdingIds }),
    }),

  getInvestmentTransactions: (params?: Record<string, string | number>) =>
    request<import('@/types/api').Paginated<import('@/types/api').InvestmentTransaction>>(
      `/investment-transactions${qs(params || {})}`,
    ),
  createInvestmentTransaction: (data: object) =>
    request('/investment-transactions', { method: 'POST', body: JSON.stringify(data) }),
  deleteInvestmentTransaction: (id: number) =>
    request(`/investment-transactions/${id}`, { method: 'DELETE' }),

  getAccountLimits: (year?: number) =>
    request<import('@/types/api').AccountLimit[]>(`/account-limits${qs({ year })}`),
  upsertAccountLimit: (data: object) =>
    request('/account-limits', { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccountLimit: (id: number) =>
    request(`/account-limits/${id}`, { method: 'DELETE' }),

  getCategories: (includeChildren = true) =>
    request<import('@/types/api').CategoryTree[]>(
      `/categories${qs({ include_children: includeChildren })}`,
    ),
  createCategory: (data: object) =>
    request('/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: number, data: object) =>
    request(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCategory: (id: number) =>
    request(`/categories/${id}`, { method: 'DELETE' }),

  getPaymentMethods: () =>
    request<import('@/types/api').PaymentMethod[]>('/payment-methods'),

  getCards: () => request<import('@/types/api').Card[]>('/cards'),
  createCard: (data: object) =>
    request<import('@/types/api').Card>('/cards', { method: 'POST', body: JSON.stringify(data) }),
  updateCard: (id: number, data: object) =>
    request<import('@/types/api').Card>(`/cards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteCard: (id: number) =>
    request(`/cards/${id}`, { method: 'DELETE' }),
  processCardSettlements: () =>
    request<import('@/types/api').CardSettlement[]>('/cards/process-settlements', { method: 'POST' }),

  getLedgerTransactions: (params?: Record<string, string | number | boolean>) =>
    request<import('@/types/api').Paginated<import('@/types/api').LedgerTransaction>>(
      `/ledger-transactions${qs(params || {})}`,
    ),
  createLedgerTransaction: (data: object) =>
    request('/ledger-transactions', { method: 'POST', body: JSON.stringify(data) }),
  updateLedgerTransaction: (id: number, data: object) =>
    request(`/ledger-transactions/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteLedgerTransaction: (id: number) =>
    request(`/ledger-transactions/${id}`, { method: 'DELETE' }),
  getLedgerSummary: (year: number, month: number) =>
    request<import('@/types/api').LedgerSummary>(
      `/ledger-transactions/summary${qs({ year, month, group_by: 'category' })}`,
    ),

  getBudgets: (year: number, month: number) =>
    request<import('@/types/api').Budget[]>(`/budgets${qs({ year, month })}`),
  upsertBudget: (data: object) =>
    request('/budgets', { method: 'PUT', body: JSON.stringify(data) }),
  getBudgetAlerts: (year: number, month: number) =>
    request(`/budgets/alerts${qs({ year, month })}`),

  getRecurringItems: () =>
    request<import('@/types/api').RecurringItem[]>('/recurring-items'),
  createRecurringItem: (data: object) =>
    request('/recurring-items', { method: 'POST', body: JSON.stringify(data) }),
  updateRecurringItem: (id: number, data: object) =>
    request(`/recurring-items/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteRecurringItem: (id: number) =>
    request(`/recurring-items/${id}`, { method: 'DELETE' }),

  getLiabilities: () => request<import('@/types/api').Liability[]>('/liabilities'),
  createLiability: (data: object) =>
    request('/liabilities', { method: 'POST', body: JSON.stringify(data) }),
  deleteLiability: (id: number) =>
    request(`/liabilities/${id}`, { method: 'DELETE' }),

  getDashboardOverview: () =>
    request<import('@/types/api').DashboardOverview>('/dashboard/overview'),
  getNetWorthTrend: (from?: string, to?: string) =>
    request<{ data: import('@/types/api').TrendPoint[] }>(
      `/dashboard/net-worth-trend${qs({ from_date: from, to_date: to })}`,
    ),
  getCashflowTrend: (months = 6) =>
    request<{ data: import('@/types/api').CashflowTrendPoint[] }>(
      `/dashboard/cashflow-trend${qs({ months })}`,
    ),
  getAccountPerformance: (accountId?: number) =>
    request<import('@/types/api').AccountPerformance[]>(
      `/dashboard/account-performance${qs({ account_id: accountId })}`,
    ),
  refreshDashboard: () =>
    request('/dashboard/refresh', { method: 'POST' }),

  searchMarket: (q: string) =>
    request<import('@/types/api').MarketSearchItem[]>(`/market/search${qs({ q })}`),
  getMarketQuote: (symbol: string) =>
    request<import('@/types/api').MarketQuote>(`/market/quote/${encodeURIComponent(symbol)}`),
  getMarketStatus: () =>
    request<import('@/types/api').MarketProviderStatus>('/market/status'),
  saveMarketCredentials: (data: { client_id: string; client_secret: string }) =>
    request<import('@/types/api').MarketProviderStatus>('/market/credentials', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteMarketCredentials: () =>
    request<import('@/types/api').MarketProviderStatus>('/market/credentials', { method: 'DELETE' }),

  getAccountSnapshots: (accountId: number) =>
    request<import('@/types/api').AccountSnapshotPoint[]>(`/snapshots/accounts/${accountId}`),

  downloadBackup: () => window.open(`${BASE}/backup`, '_blank'),
  restoreBackup: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/backup/restore`, { method: 'POST', body: form });
    if (!res.ok) throw new Error('복구 실패');
    return res.json();
  },
};
