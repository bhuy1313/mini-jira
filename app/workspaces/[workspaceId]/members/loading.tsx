import { PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function WorkspaceMembersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <PageHeaderSkeleton action />

      {/* Search + role filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="h-9 w-full rounded-lg bg-rule-strong/30 sm:w-72" />
        <div className="h-9 w-32 rounded-lg bg-rule-strong/30" />
      </div>

      {/* Member cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-rule bg-panel p-5 shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 shrink-0 rounded-full bg-rule-strong/40" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-32 rounded bg-rule-strong/40" />
                <div className="h-3 w-44 max-w-full rounded bg-rule-strong/20" />
              </div>
              <div className="size-5 shrink-0 rounded-full bg-rule-strong/30" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-5 w-20 rounded-full bg-rule-strong/30" />
              <div className="h-3 w-24 rounded bg-rule-strong/20" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
