"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { useDroppable } from "@dnd-kit/core";

import { TrendingDownIcon } from "@/components/ui/icons";
import { SprintReportModal } from "@/features/sprints/components/sprint-report-modal";
import { cn } from "@/lib/cn";
import type { SprintRecord } from "@/features/sprints/sprint-service";

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <span className="inline-flex items-center gap-1.5" title={`${done}/${total} done`}>
      <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-rule-strong">
        <span
          role="presentation"
          className={cn(
            "absolute inset-y-0 left-0 rounded-full",
            pct === 100 ? "bg-primary" : "bg-ink-faint",
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-[10px] tabular-nums text-ink-faint">
        {done}/{total}
      </span>
    </span>
  );
}

function SprintTab({
  value,
  label,
  done,
  total,
  active,
  disabled,
  onSelect,
}: {
  value: string | null;
  label: string;
  done: number;
  total: number;
  active: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  const droppableId = value === null ? "sprint-target:all" : `sprint-target:${value}`;
  const { setNodeRef, isOver } = useDroppable({
    id: droppableId,
    disabled: value === null,
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
        active
          ? "bg-primary-soft text-primary-ink"
          : "text-ink-soft hover:bg-rule hover:text-ink",
        isOver &&
          value !== null &&
          "ring-2 ring-primary bg-primary-soft text-primary-ink font-semibold shadow-xs scale-105",
      )}
    >
      <span>{label}</span>
      <ProgressBar done={done} total={total} />
    </button>
  );
}

export function SprintSwitcher({
  sprints,
  totals,
  doneTotals,
  activeSprintId,
}: {
  sprints: SprintRecord[];
  totals: Record<string, number>;
  doneTotals: Record<string, number>;
  activeSprintId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [isReportOpen, setIsReportOpen] = useState(false);

  const activeSprint =
    sprints.find((s) => s.id === activeSprintId) ?? (sprints.length > 0 ? sprints[0] : null);

  const select = useCallback(
    (value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("sprint", value);
      } else {
        params.delete("sprint");
      }
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [pathname, router, searchParams],
  );

  const options: { value: string | null; label: string; done: number; total: number }[] = [
    {
      value: null,
      label: "All",
      done: Object.values(doneTotals).reduce((a, b) => a + b, 0),
      total: Object.values(totals).reduce((a, b) => a + b, 0),
    },
    {
      value: "backlog",
      label: "Backlog",
      done: doneTotals["backlog"] ?? 0,
      total: totals["backlog"] ?? 0,
    },
    ...sprints.map((s) => ({
      value: s.id,
      label: s.name,
      done: doneTotals[s.id] ?? 0,
      total: totals[s.id] ?? 0,
    })),
  ];

  return (
    <>
      <nav
        aria-label="Sprint view"
        className="flex flex-wrap items-center gap-1 rounded-md border border-rule bg-panel p-1"
      >
        <div className="flex flex-wrap items-center gap-1">
          {options.map((opt) => {
            const active = opt.value === activeSprintId;
            return (
              <SprintTab
                key={opt.value ?? "all"}
                value={opt.value}
                label={opt.label}
                done={opt.done}
                total={opt.total}
                active={active}
                disabled={isPending}
                onSelect={() => select(opt.value)}
              />
            );
          })}
        </div>

        {sprints.length > 0 && activeSprint ? (
          <div className="ml-auto pl-2 flex items-center">
            <button
              type="button"
              onClick={() => setIsReportOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-rule hover:text-ink transition-colors border border-rule/60 shadow-2xs"
              title={`View Burndown Chart & Sprint Report for ${activeSprint.name}`}
            >
              <TrendingDownIcon className="size-3.5 text-primary" />
              <span>Sprint Report</span>
            </button>
          </div>
        ) : null}
      </nav>

      {isReportOpen && activeSprint ? (
        <SprintReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          workspaceId={activeSprint.workspaceId}
          projectId={activeSprint.projectId}
          sprintId={activeSprint.id}
          sprintName={activeSprint.name}
        />
      ) : null}
    </>
  );
}