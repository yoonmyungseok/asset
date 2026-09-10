'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { api } from '@/lib/api/client';

export default function AppInitializer({ children }: { children: ReactNode }) {
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

  if (!ready) return <div className="loading pt-[100px]">앱 초기화 중...</div>;
  return <>{children}</>;
}
