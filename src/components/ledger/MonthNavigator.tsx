'use client';

import { useLedgerMonth } from '@/hooks/useLedgerMonth';

export default function MonthNavigator() {
  const { year, month, goPrev, goNext, goToday, isCurrentMonth } = useLedgerMonth();

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={goPrev}
        className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1c1e24] border border-[#272a33] text-base text-gray-300 transition-colors hover:bg-[#252832] hover:text-white"
        aria-label="이전 달"
      >
        ‹
      </button>
      <span className="px-2 text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap">
        {year}년 {month}월
      </span>
      <button
        type="button"
        onClick={goNext}
        className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#1c1e24] border border-[#272a33] text-base text-gray-300 transition-colors hover:bg-[#252832] hover:text-white"
        aria-label="다음 달"
      >
        ›
      </button>
      {!isCurrentMonth && (
        <button
          type="button"
          onClick={goToday}
          className="ml-1 rounded-xl border border-[#272a33] bg-[#1a1c22] px-2.5 py-1 text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#252834] transition-colors"
        >
          이번 달
        </button>
      )}
    </div>
  );
}

