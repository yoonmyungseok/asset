'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api/client';
import { formatMoney } from '@/lib/utils/format';

interface RefreshContextType {
  refresh: () => Promise<void>;
  refreshing: boolean;
}

export const RefreshContext = createContext<RefreshContextType>({
  refresh: async () => {},
  refreshing: false,
});

export function useRefresh() {
  return useContext(RefreshContext);
}

const NAV_ITEMS = [
  { href: '/', label: '대시보드', exact: true },
  { href: '/ledger', label: '가계부' },
  { href: '/ledger/budget', label: '예산' },
  { href: '/investment', label: '자산' },
  { href: '/settings', label: '설정' },
];

const MOBILE_NAV_ITEMS = [
  { href: '/', label: '대시보드', exact: true },
  { href: '/ledger', label: '가계부' },
  { href: '/investment', label: '자산' },
  { href: '/settings', label: '설정' },
];

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  if (href === '/settings') return pathname.startsWith('/settings');
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isMobileNavActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function getActiveNavHref(pathname: string): string | null {
  let best: (typeof NAV_ITEMS)[number] | null = null;
  for (const item of NAV_ITEMS) {
    if (!isActive(pathname, item.href, item.exact)) continue;
    if (!best || item.href.length > best.href.length) {
      best = item;
    }
  }
  return best?.href ?? null;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [netWorth, setNetWorth] = useState<string>('—');
  const [refreshing, setRefreshing] = useState(false);

  const loadNetWorth = () => {
    api.getDashboardOverview().then((d) => setNetWorth(d.net_worth.net_worth)).catch(() => {});
  };

  useEffect(() => {
    loadNetWorth();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshDashboard();
      loadNetWorth();
      window.dispatchEvent(new Event('dashboard-refreshed'));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <aside className="fixed bottom-0 left-0 top-0 hidden w-sidebar flex-col border-r border-gray-200 bg-white px-4 py-6 lg:flex">
        <div className="mb-8 px-2 text-lg font-bold">💰 내 자산 관리</div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = getActiveNavHref(pathname) === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-3 py-2.5 font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-primary'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-4 border-t border-gray-200 pt-4">
          <div className="text-xs text-gray-500">순자산</div>
          <div className="mt-1 text-lg font-bold">{formatMoney(netWorth)}</div>
        </div>
      </aside>

      <nav className="mobile-nav lg:hidden">
        <div className="mobile-net-worth">
          <span className="mobile-net-worth-label">순자산</span>
          <span className="mobile-net-worth-value">{formatMoney(netWorth)}</span>
        </div>
        <div className="mobile-nav-items">
          {MOBILE_NAV_ITEMS.map((item) => {
            const active = isMobileNavActive(pathname, item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-nav-item${active ? ' active' : ''}`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="ml-0 min-h-screen flex-1 p-4 pb-20 lg:ml-sidebar lg:p-6 lg:pb-6">
        <RefreshContext.Provider value={{ refresh: handleRefresh, refreshing }}>
          {children}
        </RefreshContext.Provider>
      </main>
    </div>
  );
}

export function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  const { refresh, refreshing } = useRefresh();
  return (
    <div className="page-header">
      <h1 className="page-title">{title}</h1>
      <div className="page-actions">
        {actions}
        <button className="btn btn-secondary" onClick={refresh} disabled={refreshing}>
          {refreshing ? '갱신 중...' : '새로고침 ↻'}
        </button>
      </div>
    </div>
  );
}
