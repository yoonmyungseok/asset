'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  theme?: 'light' | 'dark';
  maxWidthClass?: string;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  theme = 'light',
  maxWidthClass = 'max-w-[480px]',
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open || !mounted) return null;

  const isDark = theme === 'dark';

  return createPortal(
    <div
      className={`fixed inset-0 z-[1000] flex items-end justify-center bg-black/60 backdrop-blur-sm transition-opacity overscroll-none touch-none select-none sm:items-center sm:p-4 ${
        isDark ? 'text-white' : 'text-gray-900'
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`flex max-h-[88dvh] w-full ${maxWidthClass} flex-col rounded-t-[28px] shadow-2xl transition-all sm:max-h-[90vh] sm:rounded-2xl overflow-hidden select-text ${
          isDark
            ? 'border-t border-[#2d313c] bg-[#181a20] sm:border sm:border-[#2d313c]'
            : 'bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모바일 바텀시트 그랩 핸들 */}
        <div className="flex w-full justify-center pt-2.5 pb-1 sm:hidden touch-none">
          <div
            className={`h-1.5 w-12 rounded-full ${
              isDark ? 'bg-white/20' : 'bg-gray-300'
            }`}
          />
        </div>

        {/* 모달 헤더 */}
        <div
          className={`flex shrink-0 items-center justify-between px-5 py-3.5 sm:px-6 sm:py-4 touch-none ${
            isDark ? 'border-b border-[#252832]' : 'border-b border-gray-200'
          }`}
        >
          <h2 className={`min-w-0 truncate text-base font-bold sm:text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {title}
          </h2>
          <button
            type="button"
            className={`-mr-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm transition-all active:scale-95 touch-manipulation ${
              isDark
                ? 'text-gray-400 hover:bg-[#252832] hover:text-white'
                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
            }`}
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 모달 본문: 좌우 흔들림 원천 차단 및 위아래 부드러운 스크롤 */}
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-5 py-4 sm:px-6 sm:py-5 overscroll-y-contain touch-pan-y">
          {children}
        </div>

        {/* 모달 푸터 */}
        {footer && (
          <div
            className={`flex shrink-0 items-center justify-end gap-2.5 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-4 touch-none ${
              isDark ? 'border-t border-[#252832] bg-[#181a20]' : 'border-t border-gray-200 bg-white'
            }`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
