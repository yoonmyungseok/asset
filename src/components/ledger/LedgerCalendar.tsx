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
  darkMode?: boolean;
}

export default function LedgerCalendar({
  year,
  month,
  dailyTotals,
  selectedDate,
  onSelectDate,
  darkMode = false,
}: Props) {
  const cells = buildCalendarDays(year, month);
  const today = todayISO();

  if (darkMode) {
    return (
      <div className="rounded-2xl border border-[#272a33] bg-[#1c1e24] p-3 text-white shadow-sm">
        <div className="mb-2 grid grid-cols-7 gap-1">
          {WEEKDAYS.map((label, index) => (
            <div
              key={label}
              className={`py-1 text-center text-xs font-semibold ${
                index === 0 ? 'text-rose-400' : index === 6 ? 'text-blue-400' : 'text-[#7e8494]'
              }`}
            >
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, index) => {
            if (day === null) {
              return <div key={`empty-${index}`} className="min-h-[56px] border-transparent bg-transparent" />;
            }

            const date = toDateISO(year, month, day);
            const totals = dailyTotals[date];
            const income = totals?.income ?? 0;
            const expense = totals?.expense ?? 0;
            const hasActivity = income > 0 || expense > 0;
            const weekday = new Date(year, month - 1, day).getDay();
            const isSelected = date === selectedDate;
            const isToday = date === today;

            return (
              <button
                key={date}
                type="button"
                className={`flex min-h-[56px] flex-col gap-0.5 rounded-xl border p-1.5 text-left transition-all ${
                  isSelected
                    ? 'border-emerald-500 bg-[#14261f] shadow-[inset_0_0_0_1px_#10b981]'
                    : isToday
                      ? 'border-blue-500/80 bg-[#161c28]'
                      : hasActivity
                        ? 'border-[#272a33] bg-[#181a21] hover:bg-[#20232c]'
                        : 'border-[#23252c]/70 bg-[#15171c]/80 hover:bg-[#1c1e26]'
                }`}
                onClick={() => onSelectDate(date)}
              >
                <span
                  className={`text-xs font-bold ${
                    weekday === 0 ? 'text-rose-400' : weekday === 6 ? 'text-blue-400' : 'text-gray-200'
                  }`}
                >
                  {day}
                </span>
                {income > 0 && (
                  <span className="hidden break-all text-[10px] font-semibold leading-tight text-[#00d282] sm:block">
                    +{formatMoney(income)}
                  </span>
                )}
                {expense > 0 && (
                  <span className="hidden break-all text-[10px] font-semibold leading-tight text-rose-400 sm:block">
                    -{formatMoney(expense)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

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
