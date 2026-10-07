import { cn } from "@/lib/cn";

export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-rule-strong/40 dark:bg-rule-strong/20",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeaderSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-col gap-4 border-b border-rule pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3.5">
        <div className="size-12 shrink-0 rounded-xl bg-rule-strong/40" />
        <div className="space-y-2">
          <div className="h-6 w-36 rounded-md bg-rule-strong/50" />
          <div className="h-4 w-60 rounded-md bg-rule-strong/30" />
        </div>
      </div>
      {action ? (
        <div className="h-9 w-28 shrink-0 rounded-lg bg-rule-strong/40" />
      ) : null}
    </div>
  );
}

export function KanbanColumnSkeleton() {
  return (
    <div className="flex min-h-[480px] flex-col space-y-3 rounded-2xl border border-rule bg-panel/50 p-3 animate-pulse">
      <div className="flex items-center justify-between border-b border-rule/50 pb-2">
        <div className="h-4 w-20 rounded bg-rule-strong/50" />
        <div className="size-5 rounded-full bg-rule-strong/30" />
      </div>
      <div className="flex-1 space-y-2.5">
        <div className="h-24 rounded-xl border border-rule/60 bg-paper/80 p-3 space-y-2">
          <div className="h-4 w-3/4 rounded bg-rule-strong/40" />
          <div className="h-3 w-1/2 rounded bg-rule-strong/20" />
        </div>
        <div className="h-24 rounded-xl border border-rule/60 bg-paper/80 p-3 space-y-2">
          <div className="h-4 w-5/6 rounded bg-rule-strong/40" />
          <div className="h-3 w-1/3 rounded bg-rule-strong/20" />
        </div>
        <div className="h-24 rounded-xl border border-rule/60 bg-paper/80 p-3 space-y-2">
          <div className="h-4 w-2/3 rounded bg-rule-strong/40" />
          <div className="h-3 w-1/2 rounded bg-rule-strong/20" />
        </div>
      </div>
    </div>
  );
}
