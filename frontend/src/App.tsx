import { useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api/client';
import AppLayout from './components/layout/AppLayout';
import AccountDetailPage from './pages/AccountDetailPage';
import DashboardPage from './pages/DashboardPage';
import InvestmentPage from './pages/InvestmentPage';
import LedgerAnalysisPage from './pages/LedgerAnalysisPage';
import LedgerBudgetPage from './pages/LedgerBudgetPage';
import LedgerPage from './pages/LedgerPage';
import SettingsPage from './pages/SettingsPage';

function AppInitializer({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.health()
      .then(() => api.getAccountTypes())
      .then((types) => {
        if (types.length === 0) return api.initialize();
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  if (!ready) return <div className="loading" style={{ paddingTop: 100 }}>앱 초기화 중...</div>;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppInitializer>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="ledger" element={<LedgerPage />} />
            <Route path="ledger/analysis" element={<LedgerAnalysisPage />} />
            <Route path="ledger/budget" element={<LedgerBudgetPage />} />
            <Route path="investment" element={<InvestmentPage />} />
            <Route path="investment/accounts/:id" element={<AccountDetailPage />} />
            <Route path="settings/*" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AppInitializer>
    </BrowserRouter>
  );
}
