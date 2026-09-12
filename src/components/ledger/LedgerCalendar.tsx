'use client';

import type { DailyTotal } from '@/lib/utils/ledger';
import { buildCalendarDays } from '@/lib/utils/ledger';
import { formatMoney, toDateISO, todayISO } from '@/lib/utils/format';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface Props {
  year: number;
  month: number;
  dailyTotals: Record<string, DailyTotal>;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

export default function LedgerCalendar({ year, month, dailyTotals, selectedDate, onSelectDate }: Props) {
  const cells = buildCalendarDays(year, month);
  const today = todayISO();

  return (
    <div className="ledger-calendar card">
      <div className="ledger-calendar-weekdays">
        {WEEKDAYS.map((label, index) => (
          <div
            key={label}
            className={`ledger-calendar-weekday${index === 0 ? ' is-sunday' : ''}${index === 6 ? ' is-saturday' : ''}`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="ledger-calendar-grid">
        {cells.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="ledger-calendar-cell is-empty" />;
          }

          const date = toDateISO(year, month, day);
          const totals = dailyTotals[date];
          const income = totals?.income ?? 0;
          const expense = totals?.expense ?? 0;
          const hasActivity = income > 0 || expense > 0;
          const weekday = new Date(year, month - 1, day).getDay();

          return (
            <button
              key={date}
              type="button"
              className={[
                'ledger-calendar-cell',
                hasActivity ? 'has-activity' : '',
                date === today ? 'is-today' : '',
                date === selectedDate ? 'is-selected' : '',
                weekday === 0 ? 'is-sunday' : '',
                weekday === 6 ? 'is-saturday' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => onSelectDate(date)}
            >
              <span className="ledger-calendar-day">{day}</span>
              {income > 0 && (
                <span className="ledger-calendar-income">+{formatMoney(income)}</span>
              )}
              {expense > 0 && (
                <span className="ledger-calendar-expense">-{formatMoney(expense)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
