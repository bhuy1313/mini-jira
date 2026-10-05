export default function WorkspaceLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-5">
        <div className="flex items-center gap-3.5">
          <div className="size-12 rounded-xl bg-rule-strong/40 shrink-0" />
          <div className="space-y-2">
            <div className="h-6 w-36 rounded-md bg-rule-strong/50" />
            <div className="h-4 w-60 rounded-md bg-rule-strong/30" />
          </div>
        </div>
        <div className="h-9 w-28 rounded-lg bg-rule-strong/40 shrink-0" />
      </div>

      {/* Content skeleton cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-36 rounded-xl border border-rule bg-panel/60 p-4 space-y-3">
          <div className="h-4 w-24 rounded bg-rule-strong/40" />
          <div className="h-8 w-16 rounded bg-rule-strong/50" />
          <div className="h-3 w-32 rounded bg-rule-strong/30" />
        </div>
        <div className="h-36 rounded-xl border border-rule bg-panel/60 p-4 space-y-3">
          <div className="h-4 w-28 rounded bg-rule-strong/40" />
          <div className="h-8 w-20 rounded bg-rule-strong/50" />
          <div className="h-3 w-36 rounded bg-rule-strong/30" />
        </div>
        <div className="h-36 rounded-xl border border-rule bg-panel/60 p-4 space-y-3">
          <div className="h-4 w-20 rounded bg-rule-strong/40" />
          <div className="h-8 w-12 rounded bg-rule-strong/50" />
          <div className="h-3 w-28 rounded bg-rule-strong/30" />
        </div>
      </div>

      {/* Table / List skeleton */}
      <div className="rounded-xl border border-rule bg-panel/40 p-4 space-y-3">
        <div className="flex items-center justify-between pb-3 border-b border-rule/60">
          <div className="h-4 w-32 rounded bg-rule-strong/40" />
          <div className="h-4 w-16 rounded bg-rule-strong/30" />
        </div>
        <div className="space-y-2 pt-2">
          <div className="h-10 w-full rounded-lg bg-rule-strong/20" />
          <div className="h-10 w-full rounded-lg bg-rule-strong/20" />
          <div className="h-10 w-full rounded-lg bg-rule-strong/20" />
          <div className="h-10 w-full rounded-lg bg-rule-strong/20" />
        </div>
      </div>
    </div>
  );
}
