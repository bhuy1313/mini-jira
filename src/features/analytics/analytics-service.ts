import type { Actor } from "@/features/authorization/actor";
import { requirePermission } from "@/features/authorization/actor";
import { canViewTasks } from "@/features/authorization/permissions";

export interface TasksByStatusItem {
  statusId: string;
  statusName: string;
  count: number;
  isDone: boolean;
}

export interface VelocityWeek {
  /** ISO week label in "YYYY-WNN" format, e.g. "2026-W38" */
  week: string;
  created: number;
  completed: number;
}

export interface AssigneeWorkload {
  userId: string;
  userName: string;
  open: number; // tasks where status.isDone = false
  done: number; // tasks where status.isDone = true
}

export interface OverdueStats {
  overdueCount: number;
  noDueDateCount: number;
  totalOpen: number;
}

export interface WorkspaceAnalytics {
  tasksByStatus: TasksByStatusItem[];
  velocity: VelocityWeek[]; // last 8 weeks
  assigneeWorkload: AssigneeWorkload[];
  overdue: OverdueStats;
  totalTasks: number;
  openTasks: number;
  completedTasks: number;
}

export interface ProjectAnalytics {
  projectId: string;
  projectName: string;
  tasksByStatus: TasksByStatusItem[];
  totalTasks: number;
  completedTasks: number;
}

/** Raw data returned from the repository — no business logic applied yet */
export interface WorkspaceAnalyticsRaw {
  tasksByStatus: TasksByStatusItem[];
  velocity: VelocityWeek[];
  assigneeWorkload: AssigneeWorkload[];
  overdue: OverdueStats;
}

export interface AnalyticsRepository {
  getWorkspaceAnalytics(workspaceId: string): Promise<WorkspaceAnalyticsRaw>;
  getProjectsAnalytics(workspaceId: string): Promise<ProjectAnalytics[]>;
}

export function createAnalyticsService(repo: AnalyticsRepository) {
  return {
    /**
     * Returns aggregate analytics for the entire workspace.
     * Guard: canViewTasks (all roles pass, consistent with other read operations).
     */
    async getWorkspaceAnalytics(actor: Actor): Promise<WorkspaceAnalytics> {
      requirePermission(
        actor,
        canViewTasks(actor.role),
        "You do not have permission to view analytics.",
      );

      const raw = await repo.getWorkspaceAnalytics(actor.workspaceId);

      const totalTasks = raw.tasksByStatus.reduce((sum, s) => sum + s.count, 0);
      const completedTasks = raw.tasksByStatus
        .filter((s) => s.isDone)
        .reduce((sum, s) => sum + s.count, 0);
      const openTasks = totalTasks - completedTasks;

      return {
        tasksByStatus: raw.tasksByStatus,
        velocity: raw.velocity,
        assigneeWorkload: raw.assigneeWorkload,
        overdue: raw.overdue,
        totalTasks,
        openTasks,
        completedTasks,
      };
    },

    /**
     * Returns per-project analytics breakdown for all projects in the workspace.
     * Guard: canViewTasks.
     */
    async getProjectsAnalytics(actor: Actor): Promise<ProjectAnalytics[]> {
      requirePermission(
        actor,
        canViewTasks(actor.role),
        "You do not have permission to view analytics.",
      );

      return repo.getProjectsAnalytics(actor.workspaceId);
    },
  };
}

export type AnalyticsService = ReturnType<typeof createAnalyticsService>;
