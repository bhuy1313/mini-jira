import { PageHeaderSkeleton } from "@/components/ui/skeleton";

export default function WorkspaceSettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <PageHeaderSkeleton />

      {/* General Information */}
      <div className="space-y-4 rounded-xl border border-rule bg-panel p-6 shadow-2xs">
        <div className="space-y-2">
          <div className="h-4 w-44 rounded bg-rule-strong/50" />
          <div className="h-3 w-72 rounded bg-rule-strong/20" />
        </div>
        <div className="max-w-md space-y-4">
          <div className="space-y-2">
            <div className="h-3 w-20 rounded bg-rule-strong/30" />
            <div className="h-9 w-full rounded-lg bg-rule-strong/30" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-28 rounded bg-rule-strong/30" />
            <div className="h-24 w-full rounded-lg bg-rule-strong/30" />
          </div>
          <div className="h-9 w-28 rounded-lg bg-primary/40" />
        </div>
      </div>

      {/* API Keys */}
      <div className="space-y-3 rounded-xl border border-rule bg-panel p-6 shadow-2xs">
        <div className="space-y-2">
          <div className="h-4 w-28 rounded bg-rule-strong/50" />
          <div className="h-3 w-64 rounded bg-rule-strong/20" />
        </div>
        <div className="h-9 w-32 rounded-lg bg-rule-strong/40" />
        <div className="space-y-2 pt-1">
          <div className="h-10 w-full rounded-lg bg-rule-strong/20" />
          <div className="h-10 w-full rounded-lg bg-rule-strong/20" />
        </div>
      </div>

      {/* Danger Zone */}
      <div className="space-y-3 rounded-xl border border-rule bg-panel p-6 shadow-2xs">
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-rule-strong/50" />
          <div className="h-3 w-72 rounded bg-rule-strong/20" />
        </div>
        <div className="h-9 w-40 rounded-lg bg-rule-strong/30" />
      </div>
    </div>
  );
}
