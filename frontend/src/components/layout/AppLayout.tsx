import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { api } from '../../api/client';
import { formatMoney } from '../../utils/format';

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

export default function AppLayout() {
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
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">💰 내 자산 관리</div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            대시보드
          </NavLink>
          <NavLink to="/ledger" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            가계부
          </NavLink>
          <NavLink to="/investment" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            투자
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            설정
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-networth-label">순자산</div>
          <div className="sidebar-networth-value">{formatMoney(netWorth)}</div>
        </div>
      </aside>
      <main className="main-content">
        <RefreshContext.Provider value={{ refresh: handleRefresh, refreshing }}>
          <Outlet />
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
