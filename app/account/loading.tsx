export default function AccountLoading() {
  return (
    <div className="min-h-screen bg-paper px-4 py-8 sm:px-6 lg:px-8 animate-pulse">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Account header card */}
        <div className="overflow-hidden rounded-2xl border border-rule bg-panel shadow-xs">
          <div className="h-12 w-full bg-rule-strong/30" />
          <div className="flex items-center justify-between gap-4 p-5 sm:p-6">
            <div className="flex items-center gap-4">
              <div className="size-16 shrink-0 rounded-full bg-rule-strong/40" />
              <div className="space-y-2">
                <div className="h-5 w-44 rounded bg-rule-strong/50" />
                <div className="h-3.5 w-60 rounded bg-rule-strong/30" />
              </div>
            </div>
            <div className="h-9 w-36 shrink-0 rounded-lg bg-rule-strong/30" />
          </div>
        </div>

        {/* Tabs */}
        <div className="inline-flex gap-1.5 rounded-xl border border-rule bg-panel p-1.5 shadow-2xs">
          <div className="h-8 w-24 rounded-lg bg-rule-strong/40" />
          <div className="h-8 w-28 rounded-lg bg-rule-strong/30" />
          <div className="h-8 w-36 rounded-lg bg-rule-strong/30" />
          <div className="h-8 w-32 rounded-lg bg-rule-strong/30" />
          <div className="h-8 w-32 rounded-lg bg-rule-strong/30" />
        </div>

        {/* Active tab panel */}
        <div className="space-y-5 rounded-lg border border-rule bg-panel p-6 shadow-xs">
          <div className="space-y-2 border-b border-rule pb-4">
            <div className="h-4 w-44 rounded bg-rule-strong/50" />
            <div className="h-3 w-72 rounded bg-rule-strong/20" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-24 rounded bg-rule-strong/30" />
            <div className="h-9 w-full max-w-md rounded-lg bg-rule-strong/30" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-28 rounded bg-rule-strong/30" />
            <div className="h-9 w-full max-w-md rounded-lg bg-rule-strong/30" />
          </div>
          <div className="h-9 w-28 rounded-lg bg-primary/40" />
        </div>
      </div>
    </div>
  );
}
