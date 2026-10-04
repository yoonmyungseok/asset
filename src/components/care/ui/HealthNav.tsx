'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface HealthTabItem {
  href: string;
  label: string;
  matchPrefixes?: string[];
}

const HEALTH_TABS: HealthTabItem[] = [
  { href: '/running', label: '러닝', matchPrefixes: ['/running', '/running-settings'] },
  { href: '/weight', label: '체중', matchPrefixes: ['/weight'] },
  { href: '/diet', label: '식단', matchPrefixes: ['/diet', '/food-settings'] },
];

export function HealthNav() {
  const pathname = usePathname();

  const isTabActive = (tab: HealthTabItem) => {
    if (tab.matchPrefixes) {
      return tab.matchPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
    }
    return pathname === tab.href || pathname.startsWith(`${tab.href}/`);
  };

  return (
    <nav
      className="mb-6 flex w-full gap-2 border-b border-gray-200 pb-2"
      aria-label="건강 서브 메뉴"
    >
      {HEALTH_TABS.map((tab) => {
        const active = isTabActive(tab);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={active ? { color: '#ffffff' } : undefined}
            className={`flex-1 rounded-xl py-2.5 text-center text-sm font-semibold transition-colors sm:flex-none sm:px-6 ${
              active
                ? 'bg-blue-600 !text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:text-gray-900'
            }`}
            aria-current={active ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
