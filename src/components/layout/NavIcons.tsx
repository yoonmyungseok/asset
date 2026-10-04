import { type SVGProps } from 'react';

interface IconProps extends SVGProps<SVGSVGElement> {
  active?: boolean;
}

// 1. 대시보드 / 홈 아이콘 (뱅크샐러드 스타일 홈)
export function HomeIcon({ active, className = '', ...props }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? '2.2' : '1.8'}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M3 10.5L12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5h-4.5a1 1 0 0 1-1-1v-4a2 2 0 0 0-2-2 2 2 0 0 0-2 2v4a1 1 0 0 1-1 1H4.5A1.5 1.5 0 0 1 3 20v-9.5z" />
    </svg>
  );
}

// 2. 가계부 아이콘 (뱅크샐러드 스타일 캘린더/가계부 장부)
export function LedgerIcon({ active, className = '', ...props }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? '2.2' : '1.8'}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <line x1="16" y1="2" x2="16" y2="5" />
      <line x1="8" y1="2" x2="8" y2="5" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// 3. 식단 아이콘 (식기/포크 & 나이프 & 스푼)
export function DietIcon({ active, className = '', ...props }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? '2.2' : '1.8'}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* 포크 */}
      <path d="M5 3v6a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" />
      <path d="M7 3v18" />
      {/* 나이프/스푼 */}
      <path d="M16 3c-1.5 1-2.5 3-2.5 6s1 5 2.5 6v6" />
      <path d="M16 3c1.5 1 2.5 3 2.5 6s-1 5-2.5 6" />
    </svg>
  );
}

// 4. 자산 아이콘 (뱅크샐러드 스타일 돈주머니 / 지갑)
export function InvestmentIcon({ active, className = '', ...props }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? '2.2' : '1.8'}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* 복주머니 형태 */}
      <path d="M7.5 7.5L5.2 9.4A3.5 3.5 0 0 0 4 12.1v4.4A4.5 4.5 0 0 0 8.5 21h7a4.5 4.5 0 0 0 4.5-4.5v-4.4a3.5 3.5 0 0 0-1.2-2.7l-2.3-1.9" />
      <path d="M8 8c0-1.5 1.5-4 4-4s4 2.5 4 4" />
      <ellipse cx="12" cy="7.5" rx="3.5" ry="1.5" />
      {/* 원화 심볼 */}
      <path d="M9.5 13l2.5 5 2.5-5" strokeWidth="1.8" />
      <line x1="9" y1="15" x2="15" y2="15" strokeWidth="1.6" />
    </svg>
  );
}

// 5. 설정 아이콘
export function SettingsIcon({ active, className = '', ...props }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? '2.2' : '1.8'}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

// 6. 예산 아이콘
export function BudgetIcon({ active, className = '', ...props }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? '2.2' : '1.8'}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <rect x="2" y="5" width="20" height="14" rx="3" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

// 7. 체중 아이콘
export function WeightIcon({ active, className = '', ...props }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? '2.2' : '1.8'}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M12 4v4m-4 8a4 4 0 0 1 8 0" />
      <rect x="3" y="4" width="18" height="16" rx="4" />
    </svg>
  );
}

// 8. 러닝 아이콘
export function RunningIcon({ active, className = '', ...props }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? '2.2' : '1.8'}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="13.5" cy="4.5" r="2" />
      <path d="M6 13l3.5-3.5L13 12l4.5-4.5" />
      <path d="M9.5 9.5L7 20" />
      <path d="M13 12l2.5 8" />
    </svg>
  );
}
