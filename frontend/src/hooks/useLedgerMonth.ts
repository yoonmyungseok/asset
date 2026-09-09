import { useSearchParams } from 'react-router-dom';
import { currentYearMonth } from '../utils/format';

export function shiftYearMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function useLedgerMonth() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { year: nowYear, month: nowMonth } = currentYearMonth();

  const rawYear = Number(searchParams.get('year'));
  const rawMonth = Number(searchParams.get('month'));
  const year = rawYear >= 2000 && rawYear <= 2100 ? rawYear : nowYear;
  const month = rawMonth >= 1 && rawMonth <= 12 ? rawMonth : nowMonth;

  const setYearMonth = (y: number, m: number) => {
    setSearchParams({ year: String(y), month: String(m) }, { replace: true });
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
