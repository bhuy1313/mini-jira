export default function KanbanBoardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Project header & toolbar skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-5">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-md bg-rule-strong/50" />
          <div className="h-4 w-72 rounded-md bg-rule-strong/30" />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-9 w-24 rounded-lg bg-rule-strong/40" />
          <div className="h-9 w-28 rounded-lg bg-primary/40" />
        </div>
      </div>

      {/* Kanban columns skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {[1, 2, 3].map((col) => (
          <div
            key={col}
            className="flex flex-col rounded-2xl border border-rule bg-panel/50 p-3 space-y-3 min-h-[480px]"
          >
            <div className="flex items-center justify-between pb-2 border-b border-rule/50">
              <div className="h-4 w-20 rounded bg-rule-strong/50" />
              <div className="size-5 rounded-full bg-rule-strong/30" />
            </div>
            <div className="space-y-2.5 flex-1">
              <div className="h-24 rounded-xl bg-paper/80 border border-rule/60 p-3 space-y-2">
                <div className="h-4 w-3/4 rounded bg-rule-strong/40" />
                <div className="h-3 w-1/2 rounded bg-rule-strong/20" />
              </div>
              <div className="h-24 rounded-xl bg-paper/80 border border-rule/60 p-3 space-y-2">
                <div className="h-4 w-5/6 rounded bg-rule-strong/40" />
                <div className="h-3 w-1/3 rounded bg-rule-strong/20" />
              </div>
              <div className="h-24 rounded-xl bg-paper/80 border border-rule/60 p-3 space-y-2">
                <div className="h-4 w-2/3 rounded bg-rule-strong/40" />
                <div className="h-3 w-1/2 rounded bg-rule-strong/20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
