"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDuration, formatDurationDetailed, parseDuration } from "../duration";
import { calculateTimeTrackingSummary, type WorklogRecord } from "../worklog-service";
import { setTaskEstimateAction } from "../actions";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/ui/spinner";
import { ClockIcon, EditIcon, PlusIcon } from "@/components/ui/icons";

interface TimeTrackingBarProps {
  workspaceId: string;
  projectId: string;
  taskId: string;
  originalEstimateMinutes: number | null | undefined;
  worklogs: WorklogRecord[];
  canEditEstimate: boolean;
  canLog: boolean;
  onOpenLogModal: () => void;
}

export function TimeTrackingBar({
  workspaceId,
  projectId,
  taskId,
  originalEstimateMinutes,
  worklogs,
  canEditEstimate,
  canLog,
  onOpenLogModal,
}: TimeTrackingBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditingEstimate, setIsEditingEstimate] = useState(false);
  const [estimateInput, setEstimateInput] = useState(
    originalEstimateMinutes ? formatDuration(originalEstimateMinutes) : "",
  );
  const [estimateError, setEstimateError] = useState<string | null>(null);

  const summary = calculateTimeTrackingSummary(originalEstimateMinutes, worklogs);

  const handleSaveEstimate = () => {
    setEstimateError(null);
    const trimmed = estimateInput.trim();

    if (trimmed.length > 0) {
      const parsed = parseDuration(trimmed);
      if (!parsed || parsed <= 0) {
        setEstimateError("Invalid format (e.g. 2d 4h, 16h, 30m)");
        return;
      }
    }

    startTransition(async () => {
      const res = await setTaskEstimateAction(
        workspaceId,
        projectId,
        taskId,
        trimmed.length > 0 ? trimmed : null,
      );
      if (res.error) {
        setEstimateError(res.error);
      } else {
        setIsEditingEstimate(false);
        router.refresh();
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveEstimate();
    } else if (e.key === "Escape") {
      setIsEditingEstimate(false);
      setEstimateInput(originalEstimateMinutes ? formatDuration(originalEstimateMinutes) : "");
      setEstimateError(null);
    }
  };

  const progressPercent = summary.originalEstimateMinutes
    ? Math.min(100, summary.percentSpent)
    : 0;

  return (
    <div className="rounded-lg border border-rule bg-panel p-3.5 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-faint">
          <ClockIcon className="size-3.5 text-ink-faint" />
          <span>Time Tracking</span>
        </div>
        {canLog && (
          <button
            type="button"
            onClick={onOpenLogModal}
            className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary-soft transition-colors"
          >
            <PlusIcon className="size-3" />
            <span>Log work</span>
          </button>
        )}
      </div>

      {/* Progress Bar Meter */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-ink-soft">
            {summary.originalEstimateMinutes ? (
              <>
                <strong className="text-ink">{formatDuration(summary.totalSpentMinutes)}</strong> logged
              </>
            ) : summary.totalSpentMinutes > 0 ? (
              <>
                <strong className="text-ink">{formatDuration(summary.totalSpentMinutes)}</strong> logged{" "}
                <span className="text-ink-faint">(no estimate)</span>
              </>
            ) : (
              <span className="text-ink-faint">No time logged yet</span>
            )}
          </span>

          {summary.originalEstimateMinutes ? (
            <span
              className={cn(
                "text-xs font-semibold",
                summary.isOverEstimate
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-ink-soft",
              )}
            >
              {summary.percentSpent}%
            </span>
          ) : null}
        </div>

        {/* Visual Bar */}
        <div
          role="progressbar"
          aria-valuenow={summary.percentSpent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Time tracking progress"
          className="relative h-2 w-full overflow-hidden rounded-full bg-rule/50"
        >
          {summary.originalEstimateMinutes ? (
            <div
              style={{ width: `${progressPercent}%` }}
              className={cn(
                "h-full rounded-full transition-all duration-300",
                summary.isOverEstimate
                  ? "bg-rose-500"
                  : summary.percentSpent === 100
                  ? "bg-emerald-500"
                  : "bg-primary",
              )}
            />
          ) : summary.totalSpentMinutes > 0 ? (
            <div className="h-full w-full rounded-full bg-primary/40" />
          ) : null}
        </div>
      </div>

      {/* Breakdown Details & Estimate editor */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-rule/50 text-xs">
        {/* Left: Original Estimate info or inline editor */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-ink-faint">Estimate:</span>
          {isEditingEstimate ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={estimateInput}
                onChange={(e) => setEstimateInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. 2d 4h, 30m"
                autoFocus
                className="w-28 rounded border border-rule px-1.5 py-0.5 text-xs text-ink focus:border-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={handleSaveEstimate}
                disabled={isPending}
                className="rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-white hover:bg-primary-deep disabled:opacity-50"
              >
                {isPending ? <Spinner className="size-3" /> : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditingEstimate(false);
                  setEstimateError(null);
                }}
                className="rounded px-1 text-xs text-ink-faint hover:text-ink"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <span
                className="font-medium text-ink"
                title={
                  summary.originalEstimateMinutes
                    ? formatDurationDetailed(summary.originalEstimateMinutes)
                    : "No estimate"
                }
              >
                {summary.originalEstimateMinutes
                  ? formatDuration(summary.originalEstimateMinutes)
                  : "None"}
              </span>
              {canEditEstimate && (
                <button
                  type="button"
                  onClick={() => setIsEditingEstimate(true)}
                  aria-label="Edit original estimate"
                  className="rounded p-0.5 text-ink-faint hover:text-ink transition-colors"
                  title="Edit estimate"
                >
                  <EditIcon className="size-3" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Remaining time or Over estimate warning */}
        {summary.originalEstimateMinutes ? (
          <div className="flex items-center gap-1">
            <span className="text-ink-faint">Remaining:</span>
            {summary.isOverEstimate ? (
              <span className="font-semibold text-rose-600 dark:text-rose-400">
                Over by {formatDuration(summary.totalSpentMinutes - summary.originalEstimateMinutes)}
              </span>
            ) : (
              <span className="font-medium text-ink">
                {formatDuration(summary.remainingMinutes ?? 0)}
              </span>
            )}
          </div>
        ) : null}
      </div>

      {estimateError ? (
        <p role="alert" className="text-xs text-danger mt-1">
          {estimateError}
        </p>
      ) : null}
    </div>
  );
}
