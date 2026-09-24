import { cn } from "@/lib/care/utils";

export interface RecordCardField {
  label: string;
  value: React.ReactNode;
  className?: string;
}

interface RecordCardProps {
  title: React.ReactNode;
  highlight?: React.ReactNode;
  fields?: RecordCardField[];
  actions?: React.ReactNode;
  className?: string;
}

export function RecordCard({
  title,
  highlight,
  fields,
  actions,
  className,
}: RecordCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-slate-200 bg-white p-4",
        className,
      )}
    >
      <div className="font-semibold text-slate-900">{title}</div>
      {highlight && <div className="mt-1">{highlight}</div>}
      {fields && fields.length > 0 && (
        <dl className="mt-3 space-y-1.5 text-sm">
          {fields.map((field) => (
            <div
              key={field.label}
              className={cn("flex items-start justify-between gap-3", field.className)}
            >
              <dt className="shrink-0 text-slate-500">{field.label}</dt>
              <dd className="text-right text-slate-800">{field.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {actions && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {actions}
        </div>
      )}
    </div>
  );
}

interface MobileRecordListProps {
  children: React.ReactNode;
  className?: string;
}

export function MobileRecordList({ children, className }: MobileRecordListProps) {
  return <div className={cn("flex flex-col gap-3 lg:hidden", className)}>{children}</div>;
}
