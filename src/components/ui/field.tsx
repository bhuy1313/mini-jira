import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="block text-sm font-medium text-ink">
        {label}
        <span className="mt-1 block">{children}</span>
      </label>
      {hint ? <span className="text-xs text-ink-faint">{hint}</span> : null}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}