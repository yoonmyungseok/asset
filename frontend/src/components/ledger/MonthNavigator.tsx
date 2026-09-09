import { useLedgerMonth } from '../../hooks/useLedgerMonth';

export default function MonthNavigator() {
  const { year, month, goPrev, goNext, goToday, isCurrentMonth } = useLedgerMonth();

  return (
    <div className="month-nav">
      <button type="button" className="btn btn-sm btn-secondary" onClick={goPrev} aria-label="이전 달">
        ‹
      </button>
      <span className="month-nav-label">{year}년 {month}월</span>
      <button type="button" className="btn btn-sm btn-secondary" onClick={goNext} aria-label="다음 달">
        ›
      </button>
      {!isCurrentMonth && (
        <button type="button" className="btn btn-sm btn-secondary" onClick={goToday}>
          이번 달
        </button>
      )}
    </div>
  );
}
