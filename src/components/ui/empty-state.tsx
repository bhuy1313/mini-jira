import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-rule-strong bg-paper/50 px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="mb-3 grid size-10 place-items-center rounded-full border border-rule bg-panel text-ink-faint">
          {icon}
        </div>
      ) : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {body ? (
        <p className="mt-1 max-w-sm text-xs leading-5 text-ink-soft">{body}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}