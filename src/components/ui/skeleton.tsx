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

export function KanbanColumnSkeleton() {
  return (
    <div className="flex w-80 shrink-0 flex-col rounded-lg border border-rule bg-paper p-3">
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <Skeleton className="size-3 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="size-5 rounded-full" />
      </div>
      <div className="space-y-3 pt-1">
        <div className="rounded-md border border-rule bg-panel p-3 shadow-xs space-y-2.5">
          <Skeleton className="h-4 w-3/4" />
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-5 w-14 rounded" />
            <Skeleton className="size-6 rounded-full" />
          </div>
        </div>
        <div className="rounded-md border border-rule bg-panel p-3 shadow-xs space-y-2.5">
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-5 w-12 rounded" />
            <Skeleton className="size-6 rounded-full" />
          </div>
        </div>
        <div className="rounded-md border border-rule bg-panel p-3 shadow-xs space-y-2.5">
          <Skeleton className="h-4 w-2/3" />
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-5 w-16 rounded" />
            <Skeleton className="size-6 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
