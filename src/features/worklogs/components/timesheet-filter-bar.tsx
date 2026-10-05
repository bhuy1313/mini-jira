"use client";

import { DownloadIcon } from "@/components/ui/icons";

interface TimesheetFilterBarProps {
  workspaceId: string;
  startDate: string;
  endDate: string;
  view: "matrix" | "list";
  onViewChange: (view: "matrix" | "list") => void;
  onNavigatePrev: () => void;
  onNavigateNext: () => void;
  onResetThisWeek: () => void;
  projects: Array<{ id: string; name: string }>;
  selectedProjectId: string;
  onProjectChange: (projectId: string) => void;
  members: Array<{ id: string; name: string }>;
  selectedMemberId: string;
  onMemberChange: (memberId: string) => void;
}

export function TimesheetFilterBar({
  workspaceId,
  startDate,
  endDate,
  view,
  onViewChange,
  onNavigatePrev,
  onNavigateNext,
  onResetThisWeek,
  projects,
  selectedProjectId,
  onProjectChange,
  members,
  selectedMemberId,
  onMemberChange,
}: TimesheetFilterBarProps) {
  // Format range label
  const startObj = new Date(startDate);
  const endObj = new Date(endDate);

  const formatRangeDate = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const rangeLabel = `${formatRangeDate(startObj)} – ${formatRangeDate(endObj)}`;

  // Build CSV export URL
  const exportParams = new URLSearchParams();
  exportParams.set("startDate", startDate);
  exportParams.set("endDate", endDate);
  if (selectedProjectId) {
    exportParams.set("projectId", selectedProjectId);
  }
  if (selectedMemberId) {
    exportParams.set("userId", selectedMemberId);
  }
  const exportUrl = `/api/workspaces/${workspaceId}/timesheet/export?${exportParams.toString()}`;

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-rule bg-panel p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between"
      data-testid="timesheet-filter-bar"
    >
      {/* Date Navigation */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-rule bg-paper p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={onNavigatePrev}
            className="rounded-md px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-panel hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Previous week"
            data-testid="timesheet-prev-week"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={onResetThisWeek}
            className="rounded-md px-3 py-1 text-xs font-semibold text-ink-soft hover:bg-panel hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            data-testid="timesheet-this-week"
          >
            This Week
          </button>
          <button
            type="button"
            onClick={onNavigateNext}
            className="rounded-md px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-panel hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Next week"
            data-testid="timesheet-next-week"
          >
            ▶
          </button>
        </div>

        <span
          className="text-xs font-semibold text-ink px-2 whitespace-nowrap"
          data-testid="timesheet-range-label"
        >
          {rangeLabel}
        </span>
      </div>

      {/* Filters & Actions */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Project Filter */}
        <select
          value={selectedProjectId}
          onChange={(e) => onProjectChange(e.target.value)}
          className="h-8 rounded-lg border border-rule bg-paper px-2.5 text-xs font-medium text-ink shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Filter by project"
          data-testid="timesheet-project-filter"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Member Filter */}
        <select
          value={selectedMemberId}
          onChange={(e) => onMemberChange(e.target.value)}
          className="h-8 rounded-lg border border-rule bg-paper px-2.5 text-xs font-medium text-ink shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Filter by member"
          data-testid="timesheet-member-filter"
        >
          <option value="">All Members</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        {/* View Mode Toggle: Matrix vs List */}
        <div className="flex items-center rounded-lg border border-rule bg-paper p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => onViewChange("matrix")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              view === "matrix"
                ? "bg-primary text-white font-semibold shadow-2xs"
                : "text-ink-soft hover:text-ink"
            }`}
            data-testid="timesheet-toggle-matrix"
          >
            📅 Matrix
          </button>
          <button
            type="button"
            onClick={() => onViewChange("list")}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
              view === "list"
                ? "bg-primary text-white font-semibold shadow-2xs"
                : "text-ink-soft hover:text-ink"
            }`}
            data-testid="timesheet-toggle-list"
          >
            📋 Logs
          </button>
        </div>

        {/* CSV Export Button */}
        <a
          href={exportUrl}
          download
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rule bg-panel px-3 text-xs font-semibold text-ink shadow-2xs hover:bg-paper hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          data-testid="timesheet-export-csv"
          title="Download Timesheet as CSV"
        >
          <DownloadIcon className="size-3.5 text-ink-soft" />
          <span>Export CSV</span>
        </a>
      </div>
    </div>
  );
}
