import type { Metadata, Viewport } from 'next';
import AppInitializer from '@/components/layout/AppInitializer';
import AppLayout from '@/components/layout/AppLayout';
import './globals.css';

export const metadata: Metadata = {
  title: '내 자산 관리',
  description: 'Personal asset and ledger management',
  icons: {
    icon: '/favicon.svg',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <AppInitializer>
          <AppLayout>{children}</AppLayout>
        </AppInitializer>
      </body>
    </html>
  );
}
