export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface InstitutionGroup {
  category: string;
  label: string;
  institutions: string[];
}

export interface AccountType {
  id: number;
  code: string;
  name: string;
  category: string;
  supports_holdings: boolean;
  supports_contribution_limit: boolean;
  sort_order: number;
  is_system: boolean;
}

export interface AccountSummary {
  holdings_count: number;
  holdings_value: string;
  total_value: string;
}

export interface Account {
  id: number;
  account_type_id: number;
  account_type?: { id: number; code: string; name: string; category: string; supports_holdings?: boolean };
  name: string;
  institution: string | null;
  cash_balance: string;
  metadata: Record<string, unknown>;
  is_active: boolean;
  summary?: AccountSummary;
}

export interface MarketSearchItem {
  symbol: string;
  name: string;
}

export interface MarketQuote {
  symbol: string;
  name: string | null;
  price: string;
  currency: string;
  updated_at: string | null;
}

export interface MarketProviderStatus {
  provider: 'toss' | 'fallback';
  configured: boolean;
  connected: boolean;
  message: string | null;
}

export interface Holding {
  id: number;
  account_id: number;
  account_name?: string;
  asset_class: string;
  symbol: string;
  name: string;
  quantity: string;
  avg_cost_price: string;
  manual_price: string | null;
  last_market_price: string | null;
  last_price_updated_at: string | null;
  current_price: string;
  market_value: string;
  cost_basis: string;
  profit_loss: string;
  profit_loss_rate: string;
  interest_rate: string | null;
  start_date: string | null;
  maturity_date: string | null;
  accrued_interest: string | null;
}

export interface InvestmentTransaction {
  id: number;
  account_id: number;
  holding_id: number | null;
  holding_name?: string | null;
  holding_symbol?: string | null;
  type: string;
  transaction_date: string;
  quantity: string | null;
  price: string | null;
  amount: string;
  fee: string;
  tax: string;
  memo: string | null;
}

export interface AccountLimit {
  id: number;
  account_id: number;
  account_name?: string;
  year: number;
  contribution_limit: string;
  contributed_amount: string;
  remaining_amount: string;
  usage_rate: string;
}

export interface CategoryChild {
  id: number;
  name: string;
  parent_id: number | null;
  type: string;
  sort_order: number;
  is_system: boolean;
  is_active: boolean;
}

export interface CategoryTree {
  id: number;
  name: string;
  type: string;
  parent_id: number | null;
  sort_order: number;
  is_system: boolean;
  is_active: boolean;
  children: CategoryChild[];
}

export interface PaymentMethod {
  id: number;
  name: string;
  is_system: boolean;
}

export interface Card {
  id: number;
  name: string;
  card_type: 'debit' | 'credit';
  institution: string | null;
  last_four: string | null;
  linked_account_id: number | null;
  linked_account_name: string | null;
  linked_liability_id: number | null;
  linked_liability_name: string | null;
  settlement_account_id: number | null;
  settlement_account_name: string | null;
  due_day: number | null;
  is_active: boolean;
}

export interface LedgerTransaction {
  id: number;
  transaction_date: string;
  type: 'income' | 'expense' | 'transfer' | 'reimbursement_out' | 'reimbursement_in';
  amount: string;
  category: { id: number; name: string; parent_name: string | null };
  payment_method: { id: number; name: string } | null;
  account_id: number | null;
  to_account_id: number | null;
  account_name: string | null;
  to_account_name: string | null;
  card: { id: number; name: string; card_type: string; institution: string | null; last_four: string | null } | null;
  merchant: string | null;
  memo: string | null;
  is_fixed: boolean;
  tags: string[];
}

export interface LedgerSummary {
  period: { year: number; month: number };
  total_income: string;
  total_expense: string;
  net_cashflow: string;
  by_category: {
    category_id: number;
    category_name: string;
    parent_name: string | null;
    amount: string;
    ratio: string;
    budget: string | null;
    over_budget: boolean;
  }[];
  by_card: {
    card_id: number;
    card_name: string;
    card_type: string;
    institution: string | null;
    last_four: string | null;
    amount: string;
    ratio: string;
  }[];
  comparison: {
    prev_month_expense: string;
    expense_change_rate: string;
  } | null;
}

export interface Budget {
  id: number;
  category_id: number;
  category_name: string;
  year: number;
  month: number;
  amount: string;
  spent: string;
  remaining: string;
  usage_rate: string;
  over_budget: boolean;
}

export interface RecurringItem {
  id: number;
  type: string;
  amount: string;
  category: { id: number; name: string; parent_name: string | null };
  payment_method: { id: number; name: string } | null;
  account_id: number | null;
  to_account_id: number | null;
  account_name: string | null;
  to_account_name: string | null;
  card: { id: number; name: string; card_type: string; institution: string | null; last_four: string | null } | null;
  merchant: string | null;
  memo: string | null;
  frequency: string;
  day_of_month: number;
  is_active: boolean;
}

export interface Liability {
  id: number;
  type: string;
  name: string;
  institution: string | null;
  original_amount: string;
  current_balance: string;
  interest_rate: string | null;
  due_day: number | null;
  notes: string | null;
  is_active: boolean;
}

export interface CardSettlement {
  id: number;
  card_id: number;
  card_name: string;
  year: number;
  month: number;
  amount: string;
  settlement_date: string;
}

export interface DashboardOverview {
  as_of: string;
  net_worth: {
    total_assets: string;
    total_liabilities: string;
    net_worth: string;
  };
  net_worth_delta: {
    previous_date: string;
    change_amount: string;
    change_rate: string;
  } | null;
  asset_breakdown: {
    investment: string;
    cash: string;
    investment_ratio: string;
    cash_ratio: string;
  };
  cashflow: {
    year: number;
    month: number;
    total_income: string;
    total_expense: string;
    net: string;
  };
  cashflow_comparison: {
    prev_month_income: string;
    prev_month_expense: string;
    income_change_rate?: string;
    expense_change_rate: string;
  } | null;
  accounts_summary: {
    account_id: number;
    name: string;
    type: string;
    category: string;
    total_value: string;
    ratio: string;
  }[];
  budget_alerts: BudgetAlertItem[];
  budget_alerts_count: number;
  limit_alerts: { account_name: string; usage_rate: string; remaining: string }[];
  insights: {
    savings_rate: string | null;
    emergency_months: string | null;
    debt_ratio: string | null;
  };
}

export interface BudgetAlertItem {
  category_name: string;
  budget: string;
  spent: string;
  over_amount?: string | null;
  usage_rate?: string | null;
}

export interface TrendPoint {
  date: string;
  total_assets: string;
  total_liabilities: string;
  net_worth: string;
}

export interface CashflowTrendPoint {
  year: number;
  month: number;
  income: string;
  expense: string;
  net: string;
}

export interface AccountPerformance {
  account_id: number;
  name: string;
  cost_basis: string;
  market_value: string;
  profit_loss: string;
  profit_loss_rate: string;
}

export interface AccountSnapshotPoint {
  snapshot_date: string;
  balance_value: string;
}
