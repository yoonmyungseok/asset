import { roundAvgCostPrice, roundAvgCostPriceDisplay } from '@/lib/decimal';

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

export function toAvgCostPriceString(value: string | number | null | undefined): string {
  if (value === '' || value === null || value === undefined) return '';
  const num = Number(value);
  if (!Number.isFinite(num)) return '';
  return roundAvgCostPriceDisplay(value).toFixed();
}

export function formatAvgCostPrice(value: string | number | null | undefined): string {
  const raw = toAvgCostPriceString(value);
  if (!raw) return '-';
  const num = Number(raw);
  if (!Number.isFinite(num)) return '-';
  const [integerPart, fractionPart] = raw.split('.');
  const formattedInteger = new Intl.NumberFormat('ko-KR').format(Number(integerPart));
  return fractionPart ? `${formattedInteger}.${fractionPart}` : formattedInteger;
}

/** 국내 주식·ETF 1주 가격(원). 지수(S&P 500 등)와 혼동하지 않도록 원 단위로 표시 */
export function formatStockUnitPrice(value: string | number | null | undefined): string {
  const raw = toAvgCostPriceString(value);
  if (!raw) return '-';
  return formatMoney(raw);
}

export function formatMarketPriceUpdatedAt(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('month')}/${get('day')} ${get('hour')}:${get('minute')} 기준`;
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

export function formatChartDate(value: string | number | Date | null | undefined): string {
  if (value == null || value === '') return '';
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const datePart = raw.slice(0, 10);
  const [, month, day] = datePart.split('-');
  if (!month || !day) return datePart;
  return `${month}-${day}`;
}

export function compareByDate(
  a: string | number | Date | null | undefined,
  b: string | number | Date | null | undefined,
): number {
  return new Date(String(a ?? 0)).getTime() - new Date(String(b ?? 0)).getTime();
}

export function chartDateKey(value: string | number | Date | null | undefined): string {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' || /^\d+$/.test(String(value))) {
    const date = new Date(Number(value));
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return raw.slice(0, 10);
}

export function dedupeByChartDate<T>(
  items: T[],
  getDate: (item: T) => string | Date | null | undefined,
): T[] {
  const sorted = [...items].sort((a, b) => compareByDate(getDate(a), getDate(b)));
  const byDate = new Map<string, T>();
  for (const item of sorted) {
    const key = chartDateKey(getDate(item));
    if (!key) continue;
    byDate.set(key, item);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, item]) => item);
}

export function normalizeChartDate(value: Date): Date {
  return new Date(`${value.toISOString().slice(0, 10)}T00:00:00.000Z`);
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

export function formatAccountMeta(account: {
  account_type?: { name: string } | null;
  institution?: string | null;
}): string {
  return [account.account_type?.name, account.institution].filter(Boolean).join(' · ');
}

export const ASSET_CLASS_LABELS: Record<string, string> = {
  stock: '주식/ETF',
  deposit: '예금',
};

/** 시세 API 캐시 TTL과 동일하게 유지 */
export const MARKET_PRICE_REFRESH_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function needsMarketPriceRefresh(lastUpdatedAt: string | Date | null | undefined): boolean {
  if (!lastUpdatedAt) return true;
  const updated = lastUpdatedAt instanceof Date ? lastUpdatedAt : new Date(lastUpdatedAt);
  if (Number.isNaN(updated.getTime())) return true;
  return Date.now() - updated.getTime() > MARKET_PRICE_REFRESH_MAX_AGE_MS;
}
