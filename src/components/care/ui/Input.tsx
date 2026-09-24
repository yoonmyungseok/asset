import { cn } from "@/lib/care/utils";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id ?? label?.replace(/\s/g, "-").toLowerCase();
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          "min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:text-sm",
          error && "border-red-500",
          className,
        )}
        {...props}
      />
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
