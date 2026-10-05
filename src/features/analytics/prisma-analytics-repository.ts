import { prisma } from "@/lib/prisma";
import type {
  AnalyticsRepository,
  AssigneeWorkload,
  ProjectAnalytics,
  TasksByStatusItem,
  VelocityWeek,
  WorkspaceAnalyticsRaw,
} from "./analytics-service";

/** Return ISO week label "YYYY-WNN" for a given Date. */
function toISOWeek(date: Date): string {
  // Thursday in the same week → determines the year of the week
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // Mon=1 … Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - day); // nearest Thursday
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

/** Generate the last N ISO week labels (oldest first). */
function lastNWeeks(n: number): string[] {
  const weeks: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i * 7);
    weeks.push(toISOWeek(d));
  }
  // Deduplicate while preserving order (boundary edge case)
  return [...new Set(weeks)].slice(-n);
}

export const prismaAnalyticsRepository: AnalyticsRepository = {
  async getWorkspaceAnalytics(workspaceId: string): Promise<WorkspaceAnalyticsRaw> {
    const eightWeeksAgo = new Date();
    eightWeeksAgo.setUTCDate(eightWeeksAgo.getUTCDate() - 8 * 7);
    const now = new Date();

    // ── 1. Tasks grouped by status ──────────────────────────────────────────
    const [statusGroups, allStatuses] = await Promise.all([
      prisma.task.groupBy({
        by: ["statusId"],
        where: { project: { workspaceId } },
        _count: { id: true },
      }),
      prisma.status.findMany({
        where: { project: { workspaceId } },
        select: { id: true, name: true, isDone: true },
      }),
    ]);

    const statusMap = new Map(allStatuses.map((s) => [s.id, s]));

    const tasksByStatus: TasksByStatusItem[] = statusGroups
      .map((g) => {
        const status = statusMap.get(g.statusId);
        return {
          statusId: g.statusId,
          statusName: status?.name ?? "Unknown",
          count: g._count.id,
          isDone: status?.isDone ?? false,
        };
      })
      .sort((a, b) => Number(a.isDone) - Number(b.isDone)); // open first

    // ── 2. Velocity (last 8 weeks) ──────────────────────────────────────────
    const doneStatusIds = allStatuses.filter((s) => s.isDone).map((s) => s.id);

    const [createdActivities, completedActivities] = await Promise.all([
      // TaskCreated events in last 8 weeks
      prisma.activity.findMany({
        where: {
          type: "TaskCreated",
          createdAt: { gte: eightWeeksAgo },
          task: { project: { workspaceId } },
        },
        select: { createdAt: true },
      }),
      // StatusChanged → isDone status (task completed) in last 8 weeks
      doneStatusIds.length > 0
        ? prisma.activity.findMany({
            where: {
              type: "StatusChanged",
              createdAt: { gte: eightWeeksAgo },
              newValue: { in: doneStatusIds },
              task: { project: { workspaceId } },
            },
            select: { createdAt: true },
          })
        : Promise.resolve([]),
    ]);

    const weekLabels = lastNWeeks(8);
    const createdByWeek = new Map<string, number>(weekLabels.map((w) => [w, 0]));
    const completedByWeek = new Map<string, number>(weekLabels.map((w) => [w, 0]));

    for (const a of createdActivities) {
      const w = toISOWeek(a.createdAt);
      if (createdByWeek.has(w)) createdByWeek.set(w, (createdByWeek.get(w) ?? 0) + 1);
    }
    for (const a of completedActivities) {
      const w = toISOWeek(a.createdAt);
      if (completedByWeek.has(w)) completedByWeek.set(w, (completedByWeek.get(w) ?? 0) + 1);
    }

    const velocity: VelocityWeek[] = weekLabels.map((week) => ({
      week,
      created: createdByWeek.get(week) ?? 0,
      completed: completedByWeek.get(week) ?? 0,
    }));

    // ── 3. Assignee workload ─────────────────────────────────────────────────
    const [assigneeGroups, openAssigneeGroups] = await Promise.all([
      // All assigned tasks (done + open)
      prisma.task.groupBy({
        by: ["assigneeId"],
        where: {
          project: { workspaceId },
          assigneeId: { not: null },
          status: { isDone: true },
        },
        _count: { id: true },
      }),
      // Open assigned tasks
      prisma.task.groupBy({
        by: ["assigneeId"],
        where: {
          project: { workspaceId },
          assigneeId: { not: null },
          status: { isDone: false },
        },
        _count: { id: true },
      }),
    ]);

    // Collect unique assignee IDs
    const allAssigneeIds = new Set<string>();
    for (const g of [...assigneeGroups, ...openAssigneeGroups]) {
      if (g.assigneeId) allAssigneeIds.add(g.assigneeId);
    }

    const assigneeUsers =
      allAssigneeIds.size > 0
        ? await prisma.user.findMany({
            where: { id: { in: [...allAssigneeIds] } },
            select: { id: true, name: true },
          })
        : [];

    const userNameMap = new Map(assigneeUsers.map((u) => [u.id, u.name]));
    const doneByAssignee = new Map(
      assigneeGroups.map((g) => [g.assigneeId!, g._count.id]),
    );
    const openByAssignee = new Map(
      openAssigneeGroups.map((g) => [g.assigneeId!, g._count.id]),
    );

    const assigneeWorkload: AssigneeWorkload[] = [...allAssigneeIds].map((userId) => ({
      userId,
      userName: userNameMap.get(userId) ?? "Unknown",
      open: openByAssignee.get(userId) ?? 0,
      done: doneByAssignee.get(userId) ?? 0,
    }));

    // ── 4. Overdue stats ─────────────────────────────────────────────────────
    const [overdueCount, noDueDateCount, totalOpen] = await Promise.all([
      prisma.task.count({
        where: {
          project: { workspaceId },
          status: { isDone: false },
          dueDate: { lt: now },
        },
      }),
      prisma.task.count({
        where: {
          project: { workspaceId },
          status: { isDone: false },
          dueDate: null,
        },
      }),
      prisma.task.count({
        where: {
          project: { workspaceId },
          status: { isDone: false },
        },
      }),
    ]);

    return {
      tasksByStatus,
      velocity,
      assigneeWorkload,
      overdue: { overdueCount, noDueDateCount, totalOpen },
    };
  },

  async getProjectsAnalytics(workspaceId: string): Promise<ProjectAnalytics[]> {
    const projects = await prisma.project.findMany({
      where: { workspaceId, archivedAt: null },
      select: {
        id: true,
        name: true,
        tasks: {
          select: {
            statusId: true,
            status: { select: { id: true, name: true, isDone: true } },
          },
        },
      },
    });

    return projects.map((project) => {
      // Aggregate tasks by status
      const statusCountMap = new Map<
        string,
        { statusId: string; statusName: string; isDone: boolean; count: number }
      >();
      let totalTasks = 0;
      let completedTasks = 0;

      for (const task of project.tasks) {
        totalTasks++;
        if (task.status.isDone) completedTasks++;

        const existing = statusCountMap.get(task.statusId);
        if (existing) {
          existing.count++;
        } else {
          statusCountMap.set(task.statusId, {
            statusId: task.status.id,
            statusName: task.status.name,
            isDone: task.status.isDone,
            count: 1,
          });
        }
      }

      const tasksByStatus: TasksByStatusItem[] = [...statusCountMap.values()].sort(
        (a, b) => Number(a.isDone) - Number(b.isDone),
      );

      return {
        projectId: project.id,
        projectName: project.name,
        tasksByStatus,
        totalTasks,
        completedTasks,
      };
    });
  },
};
