import { cn } from "@/lib/care/utils";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
}

export function Card({ children, className, title, action }: CardProps) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5", className)}>
      {(title || action) && (
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          {title && (
            <h3 className="min-w-0 text-base font-semibold text-slate-900 sm:flex-1">{title}</h3>
          )}
          {action && <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
