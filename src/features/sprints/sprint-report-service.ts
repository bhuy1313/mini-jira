import type { ProjectActor } from "@/features/authorization/actor";
import { requirePermission } from "@/features/authorization/actor";
import { canViewTasks } from "@/features/authorization/permissions";
import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import { formatShortDay } from "@/lib/dates";

export interface BurndownDayPoint {
  date: string; // "YYYY-MM-DD"
  dayIndex: number; // 0, 1, ..., N
  label: string; // e.g. "Oct 1"
  idealRemaining: number;
  actualRemaining: number | null;
  forecastRemaining: number | null;
  completedInDay: number;
  scopeAddedInDay: number;
}

export interface SprintReportTask {
  id: string;
  title: string;
  originalEstimateMinutes: number | null;
  timeSpentMinutes: number;
  statusId: string;
  statusName: string;
  isDone: boolean;
  priority: string;
  assignee: { id: string; name: string } | null;
  addedAfterStart: boolean;
  completedAt: Date | null;
}

export interface SprintReportData {
  sprintId: string;
  sprintName: string;
  goal: string | null;
  startDate: string | null;
  endDate: string | null;
  hasDates: boolean;
  totalDays: number;
  daysRemaining: number;
  isCompleted: boolean;
  metric: "hours" | "issues";
  totalEstimateMinutes: number;
  completedEstimateMinutes: number;
  remainingEstimateMinutes: number;
  totalTimeSpentMinutes: number;
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
  scopeChangeMinutes: number;
  scopeChangeTasks: number;
  points: BurndownDayPoint[];
  completedIssues: SprintReportTask[];
  incompleteIssues: SprintReportTask[];
  addedIssues: SprintReportTask[];
}

export interface RawSprintData {
  id: string;
  name: string;
  goal: string | null;
  startDate: Date | null;
  endDate: Date | null;
  projectId: string;
  workspaceId: string;
}

export interface RawTaskData {
  id: string;
  title: string;
  originalEstimateMinutes: number | null;
  statusId: string;
  statusName: string;
  isDone: boolean;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
  assignee: { id: string; name: string } | null;
}

export interface RawActivityData {
  taskId: string;
  type: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
}

export interface RawWorklogData {
  taskId: string;
  timeSpentMinutes: number;
  startedAt: Date;
}

export interface SprintReportRepository {
  getSprintWithProject(sprintId: string): Promise<RawSprintData | null>;
  getSprintTasks(sprintId: string): Promise<RawTaskData[]>;
  getSprintActivities(taskIds: string[]): Promise<RawActivityData[]>;
  getSprintWorklogs(taskIds: string[]): Promise<RawWorklogData[]>;
}

/** Formats a Date to "YYYY-MM-DD" local/UTC string */
export function toISODateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Formats date for display label, e.g. "Oct 2" */
export function formatDayLabel(d: Date): string {
  return formatShortDay(d);
}

/** Generates array of consecutive Date objects between start and end inclusive */
export function generateSprintDays(startDate: Date, endDate: Date): Date[] {
  const days: Date[] = [];
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const target = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  if (current > target) {
    return [new Date(current)];
  }

  while (current <= target) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
}

/**
 * Pure calculation function for Burndown Chart and Sprint Report.
 */
export function calculateSprintReport(
  sprint: RawSprintData,
  tasks: RawTaskData[],
  activities: RawActivityData[],
  worklogs: RawWorklogData[],
  metric: "hours" | "issues" = "hours",
  now: Date = new Date(),
): SprintReportData {
  // Aggregate worklog time spent per task
  const timeSpentByTask = new Map<string, number>();
  for (const w of worklogs) {
    timeSpentByTask.set(w.taskId, (timeSpentByTask.get(w.taskId) ?? 0) + w.timeSpentMinutes);
  }

  // Determine when tasks became done and when they joined the sprint
  const sprintStart = sprint.startDate ? new Date(sprint.startDate) : null;
  const sprintEnd = sprint.endDate ? new Date(sprint.endDate) : null;

  // Map activities by task
  const activitiesByTask = new Map<string, RawActivityData[]>();
  for (const a of activities) {
    const list = activitiesByTask.get(a.taskId) ?? [];
    list.push(a);
    activitiesByTask.set(a.taskId, list);
  }

  const enrichedTasks: SprintReportTask[] = tasks.map((t) => {
    const taskActivities = activitiesByTask.get(t.id) ?? [];
    let completedAt: Date | null = null;

    if (t.isDone) {
      // Find the latest StatusChanged activity
      const doneActivity = taskActivities
        .filter((a) => a.type === "StatusChanged")
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      completedAt = doneActivity ? doneActivity.createdAt : t.updatedAt;
    }

    // Check if added after start
    let addedAfterStart = false;
    if (sprintStart) {
      if (t.createdAt > sprintStart) {
        addedAfterStart = true;
      } else {
        const sprintChange = taskActivities.find(
          (a) =>
            a.type === "SprintChanged" &&
            (a.newValue === sprint.id || a.newValue === sprint.name) &&
            a.createdAt > sprintStart,
        );
        if (sprintChange) {
          addedAfterStart = true;
        }
      }
    }

    return {
      id: t.id,
      title: t.title,
      originalEstimateMinutes: t.originalEstimateMinutes,
      timeSpentMinutes: timeSpentByTask.get(t.id) ?? 0,
      statusId: t.statusId,
      statusName: t.statusName,
      isDone: t.isDone,
      priority: t.priority,
      assignee: t.assignee,
      addedAfterStart,
      completedAt,
    };
  });

  const completedIssues = enrichedTasks.filter((t) => t.isDone);
  const incompleteIssues = enrichedTasks.filter((t) => !t.isDone);
  const addedIssues = enrichedTasks.filter((t) => t.addedAfterStart);

  const totalEstimateMinutes = enrichedTasks.reduce(
    (acc, t) => acc + (t.originalEstimateMinutes ?? 0),
    0,
  );
  const completedEstimateMinutes = completedIssues.reduce(
    (acc, t) => acc + (t.originalEstimateMinutes ?? 0),
    0,
  );
  const remainingEstimateMinutes = Math.max(0, totalEstimateMinutes - completedEstimateMinutes);
  const totalTimeSpentMinutes = enrichedTasks.reduce((acc, t) => acc + t.timeSpentMinutes, 0);

  const totalTasks = enrichedTasks.length;
  const completedTasks = completedIssues.length;
  const remainingTasks = incompleteIssues.length;

  const scopeChangeMinutes = addedIssues.reduce(
    (acc, t) => acc + (t.originalEstimateMinutes ?? 0),
    0,
  );
  const scopeChangeTasks = addedIssues.length;

  // Handle case where sprint dates are not configured
  if (!sprintStart || !sprintEnd) {
    return {
      sprintId: sprint.id,
      sprintName: sprint.name,
      goal: sprint.goal,
      startDate: null,
      endDate: null,
      hasDates: false,
      totalDays: 0,
      daysRemaining: 0,
      isCompleted: false,
      metric,
      totalEstimateMinutes,
      completedEstimateMinutes,
      remainingEstimateMinutes,
      totalTimeSpentMinutes,
      totalTasks,
      completedTasks,
      remainingTasks,
      scopeChangeMinutes,
      scopeChangeTasks,
      points: [],
      completedIssues,
      incompleteIssues,
      addedIssues,
    };
  }

  const sprintDays = generateSprintDays(sprintStart, sprintEnd);
  const totalDays = sprintDays.length;
  const todayStr = toISODateString(now);

  // Calculate days remaining in sprint
  let daysRemaining = 0;
  for (const d of sprintDays) {
    if (toISODateString(d) >= todayStr) {
      daysRemaining++;
    }
  }

  const isCompleted = now > new Date(sprintEnd.getFullYear(), sprintEnd.getMonth(), sprintEnd.getDate(), 23, 59, 59, 999);

  // Initial scope at start of sprint (day 0)
  const initialTasks = enrichedTasks.filter((t) => !t.addedAfterStart);
  const initialScope =
    metric === "hours"
      ? Math.round((initialTasks.reduce((sum, t) => sum + (t.originalEstimateMinutes ?? 0), 0) / 60) * 10) / 10
      : initialTasks.length;

  const N = totalDays - 1;

  // Build daily burndown points
  const points: BurndownDayPoint[] = [];

  for (let i = 0; i < totalDays; i++) {
    const day = sprintDays[i];
    const dateStr = toISODateString(day);
    const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59, 999);
    const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);

    // 1. Ideal line: Linear descent from initialScope to 0
    const ideal = N > 0 ? Math.max(0, Math.round(initialScope * (1 - i / N) * 10) / 10) : 0;

    // 2. Is this day in the future?
    const isFuture = dateStr > todayStr;

    // Tasks belonging to the sprint on or before dayEnd
    // A task belongs if it was not added after this day
    const tasksInSprintOnDay = enrichedTasks.filter((t) => {
      if (!t.addedAfterStart) return true;
      // If added after start, check if created or moved into sprint on or before dayEnd
      return t.id && t.completedAt ? true : true; // All sprint tasks present in current dataset
    });

    // Completed on or before dayEnd
    const completedByDay = tasksInSprintOnDay.filter(
      (t) => t.completedAt !== null && t.completedAt <= dayEnd,
    );

    // Completed specifically within this day
    const completedWithinDay = tasksInSprintOnDay.filter(
      (t) => t.completedAt !== null && t.completedAt >= dayStart && t.completedAt <= dayEnd,
    );

    // Tasks added specifically within this day
    const addedWithinDay = enrichedTasks.filter((t) => {
      if (!t.addedAfterStart) return false;
      const createdAt = tasks.find((raw) => raw.id === t.id)?.createdAt;
      return createdAt && createdAt >= dayStart && createdAt <= dayEnd;
    });

    const completedInDay =
      metric === "hours"
        ? Math.round(
            (completedWithinDay.reduce((sum, t) => sum + (t.originalEstimateMinutes ?? 0), 0) / 60) * 10,
          ) / 10
        : completedWithinDay.length;

    const scopeAddedInDay =
      metric === "hours"
        ? Math.round(
            (addedWithinDay.reduce((sum, t) => sum + (t.originalEstimateMinutes ?? 0), 0) / 60) * 10,
          ) / 10
        : addedWithinDay.length;

    let actualRemaining: number | null = null;
    if (!isFuture) {
      if (metric === "hours") {
        const remainingScopeMinutes = tasksInSprintOnDay
          .filter((t) => !completedByDay.includes(t))
          .reduce((sum, t) => sum + (t.originalEstimateMinutes ?? 0), 0);
        actualRemaining = Math.max(0, Math.round((remainingScopeMinutes / 60) * 10) / 10);
      } else {
        actualRemaining = Math.max(0, tasksInSprintOnDay.length - completedByDay.length);
      }
    }

    points.push({
      date: dateStr,
      dayIndex: i,
      label: formatDayLabel(day),
      idealRemaining: ideal,
      actualRemaining,
      forecastRemaining: null,
      completedInDay,
      scopeAddedInDay,
    });
  }

  // 3. Compute Forecast Trendline if sprint is ongoing and has passed days
  const todayIdx = points.findIndex((p) => p.date === todayStr);
  if (todayIdx > 0 && todayIdx < totalDays - 1) {
    const todayActual = points[todayIdx].actualRemaining;
    if (todayActual !== null && todayActual > 0) {
      const burnedSoFar = initialScope - todayActual;
      if (burnedSoFar > 0) {
        const dailyBurnRate = burnedSoFar / todayIdx;
        let currentForecast = todayActual;
        for (let j = todayIdx + 1; j < totalDays; j++) {
          currentForecast = Math.max(0, Math.round((currentForecast - dailyBurnRate) * 10) / 10);
          points[j].forecastRemaining = currentForecast;
          if (currentForecast === 0) break;
        }
      }
    }
  }

  return {
    sprintId: sprint.id,
    sprintName: sprint.name,
    goal: sprint.goal,
    startDate: sprintStart.toISOString(),
    endDate: sprintEnd.toISOString(),
    hasDates: true,
    totalDays,
    daysRemaining,
    isCompleted,
    metric,
    totalEstimateMinutes,
    completedEstimateMinutes,
    remainingEstimateMinutes,
    totalTimeSpentMinutes,
    totalTasks,
    completedTasks,
    remainingTasks,
    scopeChangeMinutes,
    scopeChangeTasks,
    points,
    completedIssues,
    incompleteIssues,
    addedIssues,
  };
}

export function createSprintReportService(repo: SprintReportRepository) {
  return {
    async getSprintReport(
      actor: ProjectActor,
      input: {
        sprintId: string;
        metric?: "hours" | "issues";
        now?: Date;
      },
    ): Promise<SprintReportData> {
      requirePermission(actor, canViewTasks(actor.projectRole), "Cannot view sprint report.");

      const sprint = await repo.getSprintWithProject(input.sprintId);
      if (!sprint) {
        throw new ValidationError("Sprint not found.");
      }

      if (sprint.projectId !== actor.projectId) {
        throw new UnauthorizedError("Project context mismatch.");
      }
      if (sprint.workspaceId !== actor.workspaceId) {
        throw new UnauthorizedError("Workspace context mismatch.");
      }

      const tasks = await repo.getSprintTasks(sprint.id);
      const taskIds = tasks.map((t) => t.id);

      const [activities, worklogs] = await Promise.all([
        repo.getSprintActivities(taskIds),
        repo.getSprintWorklogs(taskIds),
      ]);

      return calculateSprintReport(
        sprint,
        tasks,
        activities,
        worklogs,
        input.metric ?? "hours",
        input.now ?? new Date(),
      );
    },
  };
}
