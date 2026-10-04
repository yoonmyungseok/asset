'use client';

import { useMemo } from 'react';
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
  const cells = useMemo(() => buildCalendarDays(year, month), [year, month]);
  const today = todayISO();

  // 이번 달 무지출 일수 계산 (당월은 오늘까지, 지난달은 말일까지)
  const { noSpendDaysCount, noSpendDaySet } = useMemo(() => {
    const [todayYear, todayMonth, todayDay] = today.split('-').map(Number);
    const isCurrentMonth = todayYear === year && todayMonth === month;
    const isPastMonth = year < todayYear || (year === todayYear && month < todayMonth);
    const lastDay = new Date(year, month, 0).getDate();

    const set = new Set<number>();
    let count = 0;

    if (isCurrentMonth) {
      for (let d = 1; d <= todayDay; d++) {
        const dIso = toDateISO(year, month, d);
        const exp = dailyTotals[dIso]?.expense ?? 0;
        if (exp === 0) {
          count++;
          set.add(d);
        }
      }
    } else if (isPastMonth) {
      for (let d = 1; d <= lastDay; d++) {
        const dIso = toDateISO(year, month, d);
        const exp = dailyTotals[dIso]?.expense ?? 0;
        if (exp === 0) {
          count++;
          set.add(d);
        }
      }
    }

    return { noSpendDaysCount: count, noSpendDaySet: set };
  }, [year, month, today, dailyTotals]);

  // 주차별(7일 단위) 묶음
  const weeks = useMemo(() => {
    const result: (number | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      result.push(cells.slice(i, i + 7));
    }
    return result;
  }, [cells]);

  if (darkMode) {
    return (
      <div className="w-full">
        {/* 이번 달 무지출 배너 카드 */}
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#262932] bg-[#1c1e24] px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#f43f5e]" />
            <span className="text-[13px] font-medium text-gray-200">이번 달 무지출</span>
          </div>
          <div className="flex items-center gap-1 text-[13px] font-semibold text-gray-300">
            <span>총 {noSpendDaysCount}일</span>
            <span className="text-xs text-gray-500">›</span>
          </div>
        </div>

        {/* 요일 헤더 */}
        <div className="mb-2 grid grid-cols-7 text-center">
          {WEEKDAYS.map((label) => (
            <div key={label} className="py-1 text-[13px] font-medium text-[#717786]">
              {label}
            </div>
          ))}
        </div>

        {/* 주차별 그리드 */}
        <div className="space-y-1">
          {weeks.map((week, wIdx) => {
            const weekIncome = week.reduce((sum: number, day) => {
              if (day === null) return sum;
              return sum + (dailyTotals[toDateISO(year, month, day)]?.income ?? 0);
            }, 0);

            const weekExpense = week.reduce((sum: number, day) => {
              if (day === null) return sum;
              return sum + (dailyTotals[toDateISO(year, month, day)]?.expense ?? 0);
            }, 0);

            const hasWeekTotals = weekIncome > 0 || weekExpense > 0;

            return (
              <div key={`week-${wIdx}`}>
                {/* 주간 합계 요약 (우측 상단) */}
                <div className="flex h-5 items-center justify-end gap-2 pr-1 text-[11px] font-semibold">
                  {hasWeekTotals && (
                    <>
                      {weekIncome > 0 && (
                        <span className="text-[#00d282]">+{formatMoney(weekIncome)}</span>
                      )}
                      {weekExpense > 0 && (
                        <span className="text-white">-{formatMoney(weekExpense)}</span>
                      )}
                    </>
                  )}
                </div>

                {/* 해당 주의 7일 */}
                <div className="grid grid-cols-7 gap-1">
                  {week.map((day, dIdx) => {
                    if (day === null) {
                      return <div key={`empty-${dIdx}`} className="min-h-[58px]" />;
                    }

                    const date = toDateISO(year, month, day);
                    const totals = dailyTotals[date];
                    const income = totals?.income ?? 0;
                    const expense = totals?.expense ?? 0;
                    const hasActivity = income > 0 || expense > 0;
                    const isSelected = date === selectedDate;
                    const isToday = date === today;
                    const isNoSpend = noSpendDaySet.has(day);

                    return (
                      <button
                        key={date}
                        type="button"
                        onClick={() => onSelectDate(date)}
                        className={`flex min-h-[58px] flex-col items-center rounded-xl pt-0.5 pb-1 transition-all ${
                          isSelected
                            ? 'bg-[#1e232d] shadow-[inset_0_0_0_1.5px_#10b981]'
                            : 'hover:bg-[#181a20]'
                        }`}
                      >
                        {/* 무지출 핑크 점 */}
                        <div className="flex h-2 items-center justify-center">
                          {isNoSpend && <span className="h-1.5 w-1.5 rounded-full bg-[#f43f5e]" />}
                        </div>

                        {/* 날짜 숫자 */}
                        <span
                          className={`text-[13px] leading-tight ${
                            isToday
                              ? 'font-bold text-[#00d282]'
                              : hasActivity
                                ? 'font-medium text-white'
                                : 'font-normal text-[#4a505e]'
                          }`}
                        >
                          {day}
                        </span>

                        {/* 지출 / 수입 금액 */}
                        <div className="mt-0.5 flex flex-col items-center">
                          {expense > 0 && (
                            <span className="text-[10px] leading-tight text-gray-200">
                              -{formatMoney(expense)}
                            </span>
                          )}
                          {income > 0 && (
                            <span className="text-[10px] leading-tight text-[#00d282]">
                              +{formatMoney(income)}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* 주간 구분선 */}
                {wIdx < weeks.length - 1 && (
                  <div className="my-2 border-b border-[#1b1e25]" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // 라이트 모드 기본 캘린더
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
