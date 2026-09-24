import type { Metadata, Viewport } from 'next';
import AppInitializer from '@/components/layout/AppInitializer';
import AppLayout from '@/components/layout/AppLayout';
import { Providers } from '@/components/care/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: '생활·자산 관리',
  description: '건강 기록과 자산·가계부 통합 관리',
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
        <Providers>
          <AppInitializer>
            <AppLayout>{children}</AppLayout>
          </AppInitializer>
        </Providers>
      </body>
    </html>
  );
}
