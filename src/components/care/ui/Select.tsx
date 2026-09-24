import { cn } from "@/lib/care/utils";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: readonly { value: string; label: string }[];
}

export function Select({ label, error, options, className, id, ...props }: SelectProps) {
  const selectId = id ?? label?.replace(/\s/g, "-").toLowerCase();
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          "min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-sm",
          error && "border-red-500",
          className,
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
