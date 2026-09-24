"use client";

import { Button } from "@/components/care/ui/Button";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "md" | "lg";
}

export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className={`relative max-h-[85vh] w-full overflow-y-auto rounded-t-xl bg-white p-4 shadow-xl sm:max-h-[90vh] sm:rounded-xl sm:p-6 ${
          size === "lg" ? "max-w-2xl" : "max-w-lg"
        }`}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            type="button"
            aria-label="닫기"
            className="min-h-11 min-w-11 shrink-0 text-lg sm:min-h-0 sm:min-w-0 sm:text-sm"
          >
            ✕
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  loading,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="mb-6 text-sm text-slate-600">{message}</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={loading}>
          취소
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={loading}>
          {loading ? "삭제 중..." : "삭제"}
        </Button>
      </div>
    </Modal>
  );
}
