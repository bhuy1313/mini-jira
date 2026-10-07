import { PageHeaderSkeleton } from "@/components/ui/skeleton";

function StatCardSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-rule bg-panel p-5 shadow-2xs">
      <div className="h-3 w-24 rounded bg-rule-strong/30" />
      <div className="h-8 w-16 rounded bg-rule-strong/50" />
    </div>
  );
}

function SectionSkeleton({ rows }: { rows: number }) {
  return (
    <section className="space-y-3">
      <div className="space-y-2">
        <div className="h-4 w-40 rounded bg-rule-strong/50" />
        <div className="h-3 w-56 rounded bg-rule-strong/20" />
      </div>
      <div className="space-y-3 rounded-xl border border-rule bg-panel p-6 shadow-2xs">
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="flex items-center gap-3">
            <div className="h-3 w-24 shrink-0 rounded bg-rule-strong/30" />
            <div className="h-3 flex-1 rounded-full bg-rule-strong/20" />
            <div className="h-3 w-10 shrink-0 rounded bg-rule-strong/30" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <PageHeaderSkeleton />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <SectionSkeleton rows={4} />
      <SectionSkeleton rows={4} />
      <SectionSkeleton rows={3} />

      {/* Due Date Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-rule bg-panel p-5 shadow-2xs"
          >
            <div className="h-3 w-24 rounded bg-rule-strong/30" />
            <div className="h-8 w-14 rounded bg-rule-strong/50" />
            <div className="h-3 w-32 rounded bg-rule-strong/20" />
          </div>
        ))}
      </div>
    </div>
  );
}
