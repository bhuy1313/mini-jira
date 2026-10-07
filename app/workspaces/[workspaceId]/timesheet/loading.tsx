import { PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function TimesheetLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <PageHeaderSkeleton />

      {/* Summary stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-rule bg-panel p-5 shadow-2xs"
          >
            <div className="h-3 w-24 rounded bg-rule-strong/30" />
            <div className="h-8 w-16 rounded bg-rule-strong/50" />
          </div>
        ))}
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-9 w-56 rounded-lg bg-rule-strong/30" />
        <div className="h-9 w-36 rounded-lg bg-rule-strong/30" />
        <div className="h-9 w-36 rounded-lg bg-rule-strong/30" />
        <div className="ml-auto h-9 w-24 rounded-lg bg-rule-strong/40" />
      </div>

      {/* Report rows */}
      <div className="space-y-3 rounded-xl border border-rule bg-panel p-4 shadow-2xs">
        <div className="flex items-center gap-4 border-b border-rule/60 pb-3">
          <div className="h-3 w-32 rounded bg-rule-strong/40" />
          <div className="h-3 w-24 rounded bg-rule-strong/30" />
          <div className="h-3 w-24 rounded bg-rule-strong/30" />
          <div className="h-3 w-20 rounded bg-rule-strong/30" />
          <div className="ml-auto h-3 w-16 rounded bg-rule-strong/30" />
        </div>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 py-1">
            <div className="h-4 w-32 rounded bg-rule-strong/20" />
            <div className="h-4 w-24 rounded bg-rule-strong/20" />
            <div className="h-4 w-24 rounded bg-rule-strong/20" />
            <div className="h-4 w-20 rounded bg-rule-strong/20" />
            <div className="ml-auto h-4 w-16 rounded bg-rule-strong/30" />
          </div>
        ))}
      </div>
    </div>
  );
}
