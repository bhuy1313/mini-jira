"use client";

import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import {
  CalendarIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  TrendingDownIcon,
  UsersIcon,
} from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { formatDuration } from "@/features/worklogs/duration";
import { getSprintReportAction } from "@/features/sprints/actions";
import type {
  SprintReportData,
  SprintReportTask,
} from "@/features/sprints/sprint-report-service";
import { BurndownChart } from "./burndown-chart";
import { cn } from "@/lib/cn";

export interface SprintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  projectId: string;
  sprintId: string;
  sprintName: string;
}

export function SprintReportModal({
  isOpen,
  onClose,
  workspaceId,
  projectId,
  sprintId,
  sprintName,
}: SprintReportModalProps) {
  const [metric, setMetric] = useState<"hours" | "issues">("hours");
  const [activeTab, setActiveTab] = useState<"completed" | "incomplete" | "added">("completed");
  const [data, setData] = useState<SprintReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isOpen || !sprintId) return;

    startTransition(async () => {
      setError(null);
      const res = await getSprintReportAction(workspaceId, projectId, sprintId, metric);
      if (res.error) {
        setError(res.error);
      } else if (res.data) {
        setData(res.data);
      }
    });
  }, [isOpen, sprintId, workspaceId, projectId, metric]);

  const initials = (name: string) =>
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  const completionPercent =
    data && data.totalEstimateMinutes > 0
      ? Math.round((data.completedEstimateMinutes / data.totalEstimateMinutes) * 100)
      : data && data.totalTasks > 0
      ? Math.round((data.completedTasks / data.totalTasks) * 100)
      : 0;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      labelledBy="sprint-report-title"
      panelClassName="max-w-4xl"
    >
      <div className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-rule px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-ink border border-primary/20">
              <TrendingDownIcon className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="sprint-report-title" className="text-lg font-semibold text-ink">
                  Sprint Report: {sprintName}
                </h2>
                {data?.hasDates ? (
                  <Badge tone={data.isCompleted ? "neutral" : "done"} dot>
                    {data.isCompleted ? "Completed" : "Active"}
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-ink-soft mt-0.5">
                {data?.goal ? `Goal: ${data.goal}` : "Sprint Burndown Chart and issue breakdown."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Metric Switcher Toggle */}
            <div className="flex items-center rounded-lg border border-rule bg-panel-strong/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setMetric("hours")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  metric === "hours"
                    ? "bg-panel text-ink shadow-2xs font-semibold"
                    : "text-ink-soft hover:text-ink",
                )}
              >
                ⏱️ Hours
              </button>
              <button
                type="button"
                onClick={() => setMetric("issues")}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  metric === "issues"
                    ? "bg-panel text-ink shadow-2xs font-semibold"
                    : "text-ink-soft hover:text-ink",
                )}
              >
                📋 Issues
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-md text-ink-faint hover:bg-rule/40 hover:text-ink transition-colors"
              aria-label="Close dialog"
            >
              <CloseIcon className="size-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error ? (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </div>
          ) : null}

          {isPending && !data ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-ink-soft">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-xs">Generating sprint report...</span>
            </div>
          ) : data ? (
            <>
              {/* KPI Summary Row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-rule bg-panel p-3.5 shadow-2xs">
                  <span className="text-2xs font-medium uppercase tracking-wider text-ink-faint">
                    Completion
                  </span>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-xl font-bold tracking-tight text-ink">
                      {completionPercent}%
                    </span>
                    <span className="text-xs text-ink-soft">
                      {metric === "hours"
                        ? `${formatDuration(data.completedEstimateMinutes)} / ${formatDuration(
                            data.totalEstimateMinutes,
                          )}`
                        : `${data.completedTasks} / ${data.totalTasks} issues`}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-rule">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-rule bg-panel p-3.5 shadow-2xs">
                  <span className="text-2xs font-medium uppercase tracking-wider text-ink-faint">
                    Remaining
                  </span>
                  <div className="mt-1 text-xl font-bold tracking-tight text-ink">
                    {metric === "hours"
                      ? formatDuration(data.remainingEstimateMinutes)
                      : `${data.remainingTasks} issues`}
                  </div>
                  <span className="text-xs text-ink-faint">
                    {data.hasDates ? `${data.daysRemaining} days left` : "Dates unset"}
                  </span>
                </div>

                <div className="rounded-xl border border-rule bg-panel p-3.5 shadow-2xs">
                  <span className="text-2xs font-medium uppercase tracking-wider text-ink-faint">
                    Logged Work
                  </span>
                  <div className="mt-1 text-xl font-bold tracking-tight text-ink">
                    {formatDuration(data.totalTimeSpentMinutes)}
                  </div>
                  <span className="text-xs text-ink-faint">Total time spent</span>
                </div>

                <div className="rounded-xl border border-rule bg-panel p-3.5 shadow-2xs">
                  <span className="text-2xs font-medium uppercase tracking-wider text-ink-faint">
                    Scope Creep
                  </span>
                  <div className="mt-1 text-xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                    +{data.scopeChangeTasks}
                  </div>
                  <span className="text-xs text-ink-faint">
                    {data.scopeChangeMinutes > 0
                      ? `+${formatDuration(data.scopeChangeMinutes)} added`
                      : "Tasks added mid-sprint"}
                  </span>
                </div>
              </div>

              {/* Burndown Chart Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-ink">Burndown Chart</h3>
                  {data.hasDates && data.startDate && data.endDate ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
                      <CalendarIcon className="size-3.5 text-ink-faint" />
                      {new Date(data.startDate).toLocaleDateString()} –{" "}
                      {new Date(data.endDate).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>

                {data.hasDates ? (
                  <BurndownChart points={data.points} metric={metric} />
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-rule bg-panel/40 p-8 text-center">
                    <CalendarIcon className="size-8 text-ink-faint mb-2" />
                    <p className="text-sm font-medium text-ink">Sprint dates are not configured.</p>
                    <p className="mt-1 max-w-sm text-xs text-ink-soft">
                      Configure a Start Date and End Date for this sprint to generate the burndown
                      chart and daily velocity.
                    </p>
                  </div>
                )}
              </div>

              {/* Issue Breakdown Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between border-b border-rule">
                  <div className="flex items-center gap-1 -mb-px">
                    <button
                      type="button"
                      onClick={() => setActiveTab("completed")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors",
                        activeTab === "completed"
                          ? "border-primary text-primary-ink font-semibold"
                          : "border-transparent text-ink-soft hover:text-ink",
                      )}
                    >
                      <CheckIcon className="size-3.5 text-emerald-500" />
                      Completed ({data.completedIssues.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("incomplete")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors",
                        activeTab === "incomplete"
                          ? "border-primary text-primary-ink font-semibold"
                          : "border-transparent text-ink-soft hover:text-ink",
                      )}
                    >
                      <ClockIcon className="size-3.5 text-ink-faint" />
                      Incomplete ({data.incompleteIssues.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("added")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors",
                        activeTab === "added"
                          ? "border-primary text-primary-ink font-semibold"
                          : "border-transparent text-ink-soft hover:text-ink",
                      )}
                    >
                      <span className="size-2 rounded-full bg-amber-500" />
                      Added Mid-Sprint ({data.addedIssues.length})
                    </button>
                  </div>
                </div>

                {/* Task Table */}
                <div className="rounded-xl border border-rule bg-panel overflow-hidden shadow-2xs">
                  {activeTab === "completed" ? (
                    <IssueList
                      tasks={data.completedIssues}
                      emptyMessage="No completed tasks in this sprint yet."
                    />
                  ) : activeTab === "incomplete" ? (
                    <IssueList
                      tasks={data.incompleteIssues}
                      emptyMessage="All tasks in this sprint are completed!"
                    />
                  ) : (
                    <IssueList
                      tasks={data.addedIssues}
                      emptyMessage="No tasks were added after sprint start (Zero scope creep)."
                    />
                  )}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function IssueList({
  tasks,
  emptyMessage,
}: {
  tasks: SprintReportTask[];
  emptyMessage: string;
}) {
  if (tasks.length === 0) {
    return <div className="p-6 text-center text-xs text-ink-soft">{emptyMessage}</div>;
  }

  return (
    <div className="divide-y divide-rule">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 hover:bg-rule/20 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                task.isDone ? "bg-emerald-500" : "bg-primary",
              )}
            />
            <span className="text-xs font-medium text-ink truncate">{task.title}</span>
            {task.addedAfterStart ? (
              <span className="rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-semibold shrink-0">
                Added
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-4 text-xs text-ink-soft shrink-0">
            {/* Status */}
            <span className="rounded-md border border-rule px-2 py-0.5 text-2xs text-ink-faint">
              {task.statusName}
            </span>

            {/* Estimate */}
            <span
              title="Estimate"
              className="inline-flex items-center gap-1 tabular-nums text-ink-faint text-2xs"
            >
              <ClockIcon className="size-3 text-ink-faint" />
              {task.originalEstimateMinutes ? formatDuration(task.originalEstimateMinutes) : "—"}
            </span>

            {/* Time spent */}
            {task.timeSpentMinutes > 0 ? (
              <span
                title="Time logged"
                className="font-medium text-ink text-2xs bg-primary-soft text-primary-ink px-1.5 py-0.5 rounded"
              >
                Logged: {formatDuration(task.timeSpentMinutes)}
              </span>
            ) : null}

            {/* Assignee */}
            <span className="inline-flex items-center gap-1.5 text-ink-faint text-2xs">
              <UsersIcon className="size-3.5 text-ink-faint" />
              <span>{task.assignee ? task.assignee.name : "Unassigned"}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
