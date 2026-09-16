'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode, type SVGProps } from 'react';
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

type NavIcon = (props: SVGProps<SVGSVGElement>) => ReactNode;

const IconDashboard: NavIcon = (props) => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" {...props}>
    <path d="M3 4a1 1 0 011-1h3a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm8 0a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1V4zm0 7a1 1 0 011-1h3a1 1 0 011 1v5a1 1 0 01-1 1h-3a1 1 0 01-1-1v-5zM3 13a1 1 0 011-1h3a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" />
  </svg>
);

const IconLedger: NavIcon = (props) => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" {...props}>
    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
  </svg>
);

const IconBudget: NavIcon = (props) => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" {...props}>
    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
    <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
  </svg>
);

const IconInvestment: NavIcon = (props) => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" {...props}>
    <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
  </svg>
);

const IconSettings: NavIcon = (props) => (
  <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18" {...props}>
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
);

const NAV_ITEMS = [
  { href: '/', label: '대시보드', exact: true, icon: IconDashboard },
  { href: '/ledger', label: '가계부', icon: IconLedger },
  { href: '/ledger/budget', label: '예산', icon: IconBudget },
  { href: '/investment', label: '자산', icon: IconInvestment },
  { href: '/settings', label: '설정', icon: IconSettings },
];

const MOBILE_NAV_ITEMS = [
  { href: '/', label: '대시보드', exact: true, icon: IconDashboard },
  { href: '/ledger', label: '가계부', icon: IconLedger },
  { href: '/investment', label: '자산', icon: IconInvestment },
  { href: '/settings', label: '설정', icon: IconSettings },
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

  const activeHref = getActiveNavHref(pathname);

  return (
    <div className="flex min-h-screen">
      <aside className="sidebar">
        <div className="px-3 pt-6">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon" aria-hidden>₩</div>
            <div className="sidebar-brand-text">
              <div className="sidebar-brand-title">내 자산 관리</div>
              <div className="sidebar-brand-subtitle">Asset Manager</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-nav-section">메뉴</div>
          {NAV_ITEMS.map((item) => {
            const active = activeHref === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-nav-item${active ? ' active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="sidebar-nav-icon" aria-hidden>
                  <Icon />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-net-worth">
            <div className="sidebar-net-worth-label">순자산</div>
            <div className="sidebar-net-worth-value">{formatMoney(netWorth)}</div>
            <div className="sidebar-net-worth-hint">실시간 반영</div>
          </div>
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
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`mobile-nav-item${active ? ' active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                <span className="mobile-nav-icon" aria-hidden>
                  <Icon />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="ml-0 min-h-screen flex-1 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:ml-sidebar lg:p-6 lg:pb-6">
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
