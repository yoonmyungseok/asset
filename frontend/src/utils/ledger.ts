import type { LedgerTransaction, RecurringItem } from '../types/api';

export interface DailyTotal {
  income: number;
  expense: number;
  transactions: LedgerTransaction[];
}

export function aggregateDailyTotals(transactions: LedgerTransaction[]): Record<string, DailyTotal> {
  return transactions.reduce<Record<string, DailyTotal>>((acc, tx) => {
    const day = acc[tx.transaction_date] ?? { income: 0, expense: 0, transactions: [] };
    day.transactions.push(tx);
    if (tx.type === 'income') day.income += Number(tx.amount);
    else if (tx.type === 'expense') day.expense += Number(tx.amount);
    acc[tx.transaction_date] = day;
    return acc;
  }, {});
}

export function buildCalendarDays(year: number, month: number): (number | null)[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const lastDay = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = Array(firstWeekday).fill(null);
  for (let day = 1; day <= lastDay; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function formatRecurringCategory(item: RecurringItem): string {
  const { category } = item;
  return category.parent_name ? `${category.parent_name} › ${category.name}` : category.name;
}

export function formatRecurringPayment(item: RecurringItem): string {
  if (!item.payment_method) return '—';
  const { name } = item.payment_method;
  if (name === '카드' && item.card) return `카드 · ${item.card.name}`;
  if (name === '계좌이체') {
    if (item.account_name) return `계좌이체 · ${item.account_name}`;
    return '계좌이체';
  }
  return name;
}

export function formatRecurringItemLabel(item: RecurringItem): string {
  const category = formatRecurringCategory(item);
  const detail = item.merchant || item.memo;
  return detail ? `${category} (${detail})` : category;
}

export function sumRecurringTotals(items: RecurringItem[]): { income: number; expense: number } {
  return items.reduce(
    (acc, item) => {
      if (!item.is_active) return acc;
      const amount = Number(item.amount);
      if (item.type === 'income') acc.income += amount;
      else if (item.type === 'expense') acc.expense += amount;
      return acc;
    },
    { income: 0, expense: 0 },
  );
}
