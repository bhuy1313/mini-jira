import { KanbanColumnSkeleton } from "@/components/ui/skeleton";

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
          <KanbanColumnSkeleton key={col} />
        ))}
      </div>
    </div>
  );
}
