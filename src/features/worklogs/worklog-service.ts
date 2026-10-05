import type { Actor } from "@/features/authorization/actor";
import { effectiveRole, requirePermission } from "@/features/authorization/actor";
import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import {
  canDeleteWorklog,
  canEditWorklog,
  canLogWork,
  canViewWorklogs,
} from "@/features/authorization/permissions";
import type { TaskRepository, TaskRecord } from "@/features/tasks/task-service";

export interface WorklogRecord {
  id: string;
  taskId: string;
  workspaceId: string;
  projectId: string;
  authorId: string;
  timeSpentMinutes: number;
  startedAt: Date;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  author?: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
}

export interface TimeTrackingSummary {
  originalEstimateMinutes: number | null;
  totalSpentMinutes: number;
  remainingMinutes: number | null;
  percentSpent: number;
  isOverEstimate: boolean;
}

/**
 * Calculates time tracking metrics from original estimate and logged work entries.
 */
export function calculateTimeTrackingSummary(
  originalEstimateMinutes: number | null | undefined,
  worklogs: Array<{ timeSpentMinutes: number }>,
): TimeTrackingSummary {
  const estimate =
    originalEstimateMinutes !== null && originalEstimateMinutes !== undefined && originalEstimateMinutes > 0
      ? originalEstimateMinutes
      : null;

  const totalSpent = worklogs.reduce((sum, w) => sum + (w.timeSpentMinutes || 0), 0);

  if (estimate === null) {
    return {
      originalEstimateMinutes: null,
      totalSpentMinutes: totalSpent,
      remainingMinutes: null,
      percentSpent: 0,
      isOverEstimate: false,
    };
  }

  const remaining = Math.max(0, estimate - totalSpent);
  const percentSpent = Math.round((totalSpent / estimate) * 100);
  const isOverEstimate = totalSpent > estimate;

  return {
    originalEstimateMinutes: estimate,
    totalSpentMinutes: totalSpent,
    remainingMinutes: remaining,
    percentSpent,
    isOverEstimate,
  };
}

export interface WorklogRepository {
  getWorklog(worklogId: string): Promise<WorklogRecord | null>;
  listWorklogsByTask(taskId: string): Promise<WorklogRecord[]>;
  listWorklogsByTaskIds(taskIds: string[]): Promise<Record<string, WorklogRecord[]>>;
  createWorklog(input: {
    taskId: string;
    authorId: string;
    timeSpentMinutes: number;
    startedAt?: Date;
    description?: string | null;
  }): Promise<WorklogRecord>;
  updateWorklog(input: {
    worklogId: string;
    timeSpentMinutes?: number;
    startedAt?: Date;
    description?: string | null;
  }): Promise<WorklogRecord>;
  deleteWorklog(worklogId: string): Promise<void>;
}

interface Deps {
  repo: WorklogRepository;
  taskRepo: TaskRepository;
}

export function createWorklogService({ repo, taskRepo }: Deps) {
  async function fetchAndAuthorizeTask(actor: Actor, taskId: string): Promise<TaskRecord> {
    const task = await taskRepo.getTask(taskId);
    if (!task || task.workspaceId !== actor.workspaceId) {
      throw new UnauthorizedError("Task not found or does not belong to your workspace.");
    }
    if ("projectId" in actor && task.projectId !== (actor as { projectId: string }).projectId) {
      throw new UnauthorizedError("Task does not belong to this project.");
    }
    return task;
  }

  async function fetchAndAuthorizeWorklog(actor: Actor, worklogId: string): Promise<WorklogRecord> {
    const worklog = await repo.getWorklog(worklogId);
    if (!worklog || worklog.workspaceId !== actor.workspaceId) {
      throw new UnauthorizedError("Worklog not found or does not belong to your workspace.");
    }
    if ("projectId" in actor && worklog.projectId !== (actor as { projectId: string }).projectId) {
      throw new UnauthorizedError("Worklog does not belong to this project.");
    }
    return worklog;
  }

  return {
    async listWorklogs(actor: Actor, taskId: string): Promise<WorklogRecord[]> {
      await fetchAndAuthorizeTask(actor, taskId);
      const role = effectiveRole(actor);
      requirePermission(actor, canViewWorklogs(role), "Permission denied to view worklogs.");
      return repo.listWorklogsByTask(taskId);
    },

    async getTimeTrackingSummary(actor: Actor, taskId: string): Promise<TimeTrackingSummary> {
      const task = await fetchAndAuthorizeTask(actor, taskId);
      const worklogs = await repo.listWorklogsByTask(taskId);
      return calculateTimeTrackingSummary(task.originalEstimateMinutes, worklogs);
    },

    async logWork(
      actor: Actor,
      input: {
        taskId: string;
        timeSpentMinutes: number;
        startedAt?: Date;
        description?: string | null;
      },
    ): Promise<WorklogRecord> {
      await fetchAndAuthorizeTask(actor, input.taskId);
      const role = effectiveRole(actor);
      requirePermission(actor, canLogWork(role), "Permission denied to log work.");

      if (
        !input.timeSpentMinutes ||
        isNaN(input.timeSpentMinutes) ||
        input.timeSpentMinutes <= 0
      ) {
        throw new ValidationError("Time spent must be greater than 0 minutes.");
      }

      return repo.createWorklog({
        taskId: input.taskId,
        authorId: actor.userId,
        timeSpentMinutes: Math.round(input.timeSpentMinutes),
        startedAt: input.startedAt ?? new Date(),
        description: input.description?.trim() ? input.description.trim() : null,
      });
    },

    async updateWorklog(
      actor: Actor,
      worklogId: string,
      input: {
        timeSpentMinutes?: number;
        startedAt?: Date;
        description?: string | null;
      },
    ): Promise<WorklogRecord> {
      const worklog = await fetchAndAuthorizeWorklog(actor, worklogId);
      const role = effectiveRole(actor);
      const isAuthor = worklog.authorId === actor.userId;

      requirePermission(
        actor,
        canEditWorklog(role, isAuthor),
        "Only the author can edit this worklog entry.",
      );

      if (input.timeSpentMinutes !== undefined) {
        if (isNaN(input.timeSpentMinutes) || input.timeSpentMinutes <= 0) {
          throw new ValidationError("Time spent must be greater than 0 minutes.");
        }
      }

      return repo.updateWorklog({
        worklogId,
        timeSpentMinutes:
          input.timeSpentMinutes !== undefined ? Math.round(input.timeSpentMinutes) : undefined,
        startedAt: input.startedAt,
        description:
          input.description !== undefined
            ? input.description?.trim()
              ? input.description.trim()
              : null
            : undefined,
      });
    },

    async deleteWorklog(actor: Actor, worklogId: string): Promise<void> {
      const worklog = await fetchAndAuthorizeWorklog(actor, worklogId);
      const role = effectiveRole(actor);
      const isAuthor = worklog.authorId === actor.userId;

      requirePermission(
        actor,
        canDeleteWorklog(role, isAuthor),
        "Permission denied to delete this worklog entry.",
      );

      await repo.deleteWorklog(worklogId);
    },
  };
}
