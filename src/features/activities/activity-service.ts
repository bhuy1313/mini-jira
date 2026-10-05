import type { Actor } from "@/features/authorization/actor";
import { requirePermission } from "@/features/authorization/actor";
import { UnauthorizedError } from "@/features/authorization/errors";
import { canViewActivity } from "@/features/authorization/permissions";

export type ActivityType =
  | "TaskCreated"
  | "TitleChanged"
  | "StatusChanged"
  | "PriorityChanged"
  | "AssigneeChanged"
  | "DueDateChanged"
  | "SprintChanged";

export interface ActivityActorInfo {
  id: string;
  name: string;
  email: string;
}

export interface ActivityRecord {
  id: string;
  type: ActivityType;
  taskId: string;
  actorId: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  actor?: ActivityActorInfo;
}

export interface ActivityRepository {
  listActivitiesByTask(taskId: string): Promise<ActivityRecord[]>;
  getTaskWorkspaceId(taskId: string): Promise<string | null>;
}

interface Deps {
  repo: ActivityRepository;
}

export function createActivityService({ repo }: Deps) {
  /** Timeline: Mọi workspace member đều xem được (FR-072). */
  async function listActivities(actor: Actor, taskId: string): Promise<ActivityRecord[]> {
    requirePermission(actor, canViewActivity(actor.role), "You do not have permission to view activity.");
    const workspaceId = await repo.getTaskWorkspaceId(taskId);
    if (!workspaceId || workspaceId !== actor.workspaceId) {
      throw new UnauthorizedError("Task not found or does not belong to your workspace.");
    }
    return repo.listActivitiesByTask(taskId);
  }

  return { listActivities };
}

export type ActivityService = ReturnType<typeof createActivityService>;
