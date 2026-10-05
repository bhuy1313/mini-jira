import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { BarChartIcon } from "@/components/ui/icons";
import { createAnalyticsService } from "@/features/analytics/analytics-service";
import { prismaAnalyticsRepository } from "@/features/analytics/prisma-analytics-repository";
import { requireActor } from "@/features/workspaces/session";
import { getWorkspaceContext } from "@/features/workspaces/queries";

const analyticsService = createAnalyticsService(prismaAnalyticsRepository);

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;

  const actor = await requireActor(workspaceId).catch(() => null);
  if (!actor) redirect("/workspaces");

  const [{ ws }, analytics, projectsAnalytics] = await Promise.all([
    getWorkspaceContext(workspaceId),
    analyticsService.getWorkspaceAnalytics(actor),
    analyticsService.getProjectsAnalytics(actor),
  ]);

  const { tasksByStatus, velocity, assigneeWorkload, overdue, totalTasks, openTasks, completedTasks } =
    analytics;

  const maxVelocity = Math.max(
    1,
    ...velocity.map((v) => Math.max(v.created, v.completed)),
  );

  return (
    <div className="space-y-6">
      {/* ── Standardized Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-5">
        <div className="flex items-center gap-3.5">
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-ink shadow-2xs border border-primary/20">
            <BarChartIcon className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink">Analytics</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Performance metrics, task velocity, and workload distribution for {ws.name}.
            </p>
          </div>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        data-testid="analytics-stat-cards"
      >
        <StatCard label="Total Tasks" value={totalTasks} tone="neutral" />
        <StatCard label="Open Tasks" value={openTasks} tone="info" />
        <StatCard label="Completed" value={completedTasks} tone="done" />
        <StatCard label="Overdue" value={overdue.overdueCount} tone="danger" />
      </div>

      {/* ── Tasks by Status ── */}
      <section data-testid="analytics-tasks-by-status">
        <SectionHeader title="Tasks by Status" />
        <div className="rounded-xl border border-rule bg-panel p-6 shadow-2xs">
          {tasksByStatus.length === 0 ? (
            <EmptyState message="No tasks yet." />
          ) : (
            <div className="space-y-3">
              {tasksByStatus.map((item) => {
                const pct = totalTasks > 0 ? Math.round((item.count / totalTasks) * 100) : 0;
                return (
                  <div key={item.statusId} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-sm text-ink-soft">
                      {item.statusName}
                    </span>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-paper">
                      <div
                        className={
                          item.isDone
                            ? "h-full rounded-full bg-done"
                            : "h-full rounded-full bg-primary"
                        }
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-12 shrink-0 text-right text-sm font-medium text-ink">
                      {item.count}
                      <span className="ml-1 text-xs text-ink-faint">({pct}%)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Velocity ── */}
      <section data-testid="analytics-velocity">
        <SectionHeader
          title="Velocity — Last 8 Weeks"
          subtitle="Created vs Completed tasks per week"
        />
        <div className="rounded-xl border border-rule bg-panel p-6 shadow-2xs">
          {velocity.length === 0 ? (
            <EmptyState message="No activity data yet." />
          ) : (
            <div className="space-y-1">
              {/* Legend */}
              <div className="mb-4 flex gap-4 text-xs text-ink-soft">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-3 rounded-sm bg-primary" />
                  Created
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-3 rounded-sm bg-done" />
                  Completed
                </span>
              </div>
              {velocity.map((v) => (
                <div key={v.week} className="flex items-center gap-3">
                  <span className="w-20 shrink-0 text-xs text-ink-faint">{v.week}</span>
                  <div className="flex flex-1 flex-col gap-0.5">
                    {/* Created bar */}
                    <div className="flex items-center gap-2">
                      <div className="h-3 flex-1 overflow-hidden rounded-sm bg-paper">
                        <div
                          className="h-full rounded-sm bg-primary transition-all"
                          style={{ width: `${Math.round((v.created / maxVelocity) * 100)}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-xs text-ink-soft">{v.created}</span>
                    </div>
                    {/* Completed bar */}
                    <div className="flex items-center gap-2">
                      <div className="h-3 flex-1 overflow-hidden rounded-sm bg-paper">
                        <div
                          className="h-full rounded-sm bg-done transition-all"
                          style={{ width: `${Math.round((v.completed / maxVelocity) * 100)}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-xs text-ink-soft">{v.completed}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Assignee Workload ── */}
      <section data-testid="analytics-assignee-workload">
        <SectionHeader title="Assignee Workload" subtitle="Open vs Completed tasks per person" />
        <div className="rounded-xl border border-rule bg-panel p-6 shadow-2xs">
          {assigneeWorkload.length === 0 ? (
            <EmptyState message="No assigned tasks yet." />
          ) : (
            <div className="space-y-3">
              {assigneeWorkload.map((a) => {
                const total = a.open + a.done;
                const donePct = total > 0 ? Math.round((a.done / total) * 100) : 0;
                return (
                  <div key={a.userId} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 truncate text-sm font-medium text-ink">
                      {a.userName}
                    </span>
                    {/* Stacked bar: done (green) + open (primary) */}
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-paper">
                      <div className="flex h-full">
                        <div
                          className="h-full bg-done"
                          style={{ width: `${donePct}%` }}
                        />
                        <div
                          className="h-full bg-primary/50"
                          style={{ width: `${100 - donePct}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs text-ink-soft">
                      {a.done} done / {a.open} open
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Overdue Summary ── */}
      <section data-testid="analytics-overdue">
        <SectionHeader title="Due Date Summary" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-rule bg-panel p-5 shadow-2xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Overdue</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-danger">
              {overdue.overdueCount}
            </p>
            <p className="mt-1 text-xs text-ink-faint">tasks past due date</p>
          </div>
          <div className="rounded-xl border border-rule bg-panel p-5 shadow-2xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">No Due Date</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-ink">
              {overdue.noDueDateCount}
            </p>
            <p className="mt-1 text-xs text-ink-faint">open tasks without a deadline</p>
          </div>
          <div className="rounded-xl border border-rule bg-panel p-5 shadow-2xs">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Total Open</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-ink">
              {overdue.totalOpen}
            </p>
            <p className="mt-1 text-xs text-ink-faint">tasks not yet completed</p>
          </div>
        </div>
      </section>

      {/* ── Per-Project Breakdown ── */}
      {projectsAnalytics.length > 0 && (
        <section data-testid="analytics-projects-breakdown">
          <SectionHeader title="Per-Project Breakdown" />
          <div className="space-y-3">
            {projectsAnalytics.map((proj) => {
              const pct =
                proj.totalTasks > 0
                  ? Math.round((proj.completedTasks / proj.totalTasks) * 100)
                  : 0;
              return (
                <div key={proj.projectId} className="rounded-xl border border-rule bg-panel p-5 shadow-2xs">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-semibold text-ink">{proj.projectName}</p>
                        <Badge tone={pct === 100 ? "done" : "neutral"}>
                          {pct}%
                        </Badge>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper">
                        <div
                          className="h-full rounded-full bg-done transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-ink-soft">
                      {proj.completedTasks}/{proj.totalTasks} tasks
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "done" | "danger" | "info";
}) {
  const colorMap: Record<string, string> = {
    neutral: "text-ink",
    done: "text-done",
    danger: "text-danger",
    info: "text-info",
  };

  return (
    <div className="rounded-xl border border-rule bg-panel p-5 shadow-2xs">
      <p className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{label}</p>
      <p className={`mt-2 text-3xl font-bold tracking-tight ${colorMap[tone]}`}>{value}</p>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold tracking-tight text-ink">{title}</h2>
      {subtitle && <p className="text-xs text-ink-soft">{subtitle}</p>}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="py-6 text-center text-sm text-ink-faint">{message}</p>
  );
}
