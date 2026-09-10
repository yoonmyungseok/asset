'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { currentYearMonth } from '@/lib/utils/format';

export function shiftYearMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function useLedgerMonth() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { year: nowYear, month: nowMonth } = currentYearMonth();

  const rawYear = Number(searchParams.get('year'));
  const rawMonth = Number(searchParams.get('month'));
  const year = rawYear >= 2000 && rawYear <= 2100 ? rawYear : nowYear;
  const month = rawMonth >= 1 && rawMonth <= 12 ? rawMonth : nowMonth;

  const setYearMonth = (y: number, m: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', String(y));
    params.set('month', String(m));
    router.replace(`${pathname}?${params.toString()}`);
  };

  const goPrev = () => {
    const next = shiftYearMonth(year, month, -1);
    setYearMonth(next.year, next.month);
  };

  const goNext = () => {
    const next = shiftYearMonth(year, month, 1);
    setYearMonth(next.year, next.month);
  };

  const goToday = () => setYearMonth(nowYear, nowMonth);

  const isCurrentMonth = year === nowYear && month === nowMonth;
  const monthQuery = `?year=${year}&month=${month}`;

  return { year, month, goPrev, goNext, goToday, isCurrentMonth, monthQuery };
}
