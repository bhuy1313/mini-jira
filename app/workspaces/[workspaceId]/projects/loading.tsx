import { PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function WorkspaceProjectsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <PageHeaderSkeleton action />

      {/* Search + filter tabs toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="h-9 w-full rounded-lg bg-rule-strong/30 sm:w-72" />
        <div className="flex gap-2">
          <div className="h-9 w-20 rounded-lg bg-rule-strong/40" />
          <div className="h-9 w-24 rounded-lg bg-rule-strong/30" />
          <div className="h-9 w-24 rounded-lg bg-rule-strong/30" />
        </div>
      </div>

      {/* Project cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-rule bg-panel p-5 shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="size-10 shrink-0 rounded-lg bg-rule-strong/40" />
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-rule-strong/40" />
                <div className="h-3 w-24 rounded bg-rule-strong/20" />
              </div>
            </div>
            <div className="h-3 w-full rounded bg-rule-strong/20" />
            <div className="h-3 w-2/3 rounded bg-rule-strong/20" />
            <div className="flex items-center justify-between pt-2">
              <div className="h-5 w-28 rounded bg-rule-strong/30" />
              <div className="h-5 w-16 rounded-full bg-rule-strong/30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
