export function formatMoney(value: string | number | null | undefined): string {
  const num = Number(value ?? 0);
  return new Intl.NumberFormat('ko-KR').format(Math.round(num)) + '원';
}

export function toWholeMoney(value: string | number | null | undefined): number {
  return Math.round(Number(value ?? 0));
}

export function toWholeMoneyString(value: string | number | null | undefined): string {
  if (value === '' || value === null || value === undefined) return '';
  const num = Math.round(Number(value));
  return Number.isFinite(num) ? String(num) : '';
}

export function formatMoneyCompact(value: string | number | null | undefined): string {
  const num = Math.round(Number(value ?? 0));
  if (num === 0) return '0';
  const abs = Math.abs(num);
  if (abs >= 100000000) {
    const scaled = num / 100000000;
    return `${scaled % 1 === 0 ? scaled.toFixed(0) : scaled.toFixed(1)}억`;
  }
  if (abs >= 10000) {
    const scaled = num / 10000;
    return `${scaled % 1 === 0 ? scaled.toFixed(0) : scaled.toFixed(1)}만`;
  }
  return new Intl.NumberFormat('ko-KR').format(num);
}

export function formatQuantity(value: string | number | null | undefined): string {
  const num = Math.round(Number(value ?? 0));
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(num);
}

export function formatPercent(value: string | number | null | undefined): string {
  const num = Number(value ?? 0);
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}%`;
}

export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.slice(0, 10).split('-');
  return `${year}.${month}.${day}`;
}

export function formatInterestRate(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  return `${Number(value).toFixed(2)}%`;
}

export function formatMaturityLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maturity = new Date(dateStr.slice(0, 10));
  maturity.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((maturity.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const dateLabel = formatDate(dateStr);
  if (diffDays < 0) return `${dateLabel} (만기)`;
  if (diffDays === 0) return `${dateLabel} (D-Day)`;
  return `${dateLabel} (D-${diffDays})`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function monthDateRange(year: number, month: number) {
  const mm = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  const dd = String(lastDay).padStart(2, '0');
  return {
    from_date: `${year}-${mm}-01`,
    to_date: `${year}-${mm}-${dd}`,
  };
}

export function toDateISO(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export const LEDGER_TX_TYPES: Record<string, string> = {
  income: '수입',
  expense: '지출',
  transfer: '이체',
  reimbursement_out: '반환예정',
  reimbursement_in: '반환입금',
};

export type LedgerFormType = 'income' | 'expense' | 'reimbursement_out' | 'reimbursement_in';

export const INVESTMENT_TX_TYPES: Record<string, string> = {
  buy: '매수',
  sell: '매도',
  deposit: '입금',
  withdraw: '출금',
  dividend: '배당',
  interest: '이자',
  fee: '수수료',
};

export const LIABILITY_TYPES: Record<string, string> = {
  loan: '대출',
  credit_card: '신용카드',
  other: '기타',
};

export const CARD_TYPES: Record<string, string> = {
  debit: '체크카드',
  credit: '신용카드',
};

export const CATEGORY_LABELS: Record<string, string> = {
  investment: '투자',
  pension: '연금',
  deposit: '예적금',
  cash: '입출금',
};

export const ASSET_CLASS_LABELS: Record<string, string> = {
  stock: '주식/ETF',
  deposit: '예금',
};
