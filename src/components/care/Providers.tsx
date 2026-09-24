"use client";

import { ToastProvider } from "@/components/care/ui/Toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
