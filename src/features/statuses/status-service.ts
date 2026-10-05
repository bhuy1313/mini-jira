import { canManageStatuses } from "@/features/authorization/permissions";
import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import type { ProjectActor } from "@/features/authorization/actor";

export interface StatusRecord {
  id: string;
  projectId: string;
  workspaceId: string;
  name: string;
  position: string;
  isDefault: boolean;
  isDone: boolean;
  createdAt: Date;
}

export interface StatusRepository {
  getStatus(statusId: string): Promise<StatusRecord | null>;
  getProjectWorkspaceId(projectId: string): Promise<string | null>;
  listStatusesByProject(projectId: string): Promise<StatusRecord[]>;
  createStatus(input: {
    projectId: string;
    name: string;
    position: string;
    isDefault?: boolean;
    isDone?: boolean;
  }): Promise<StatusRecord>;
  updateStatus(input: {
    statusId: string;
    name?: string;
    position?: string;
    isDefault?: boolean;
    isDone?: boolean;
  }): Promise<StatusRecord>;
  deleteStatus(statusId: string): Promise<void>;
  countTasksInStatus(statusId: string): Promise<number>;
  countStatusesInProject(projectId: string): Promise<number>;
  getDefaultStatus(projectId: string): Promise<StatusRecord | null>;
  reorderStatuses(items: { id: string; position: string }[]): Promise<void>;
}

export function createStatusService(repo: StatusRepository) {
  async function guardProjectAccess(actor: ProjectActor, projectId: string): Promise<void> {
    if (actor.projectId !== projectId) {
      throw new UnauthorizedError("Project context mismatch.");
    }
    const wsId = await repo.getProjectWorkspaceId(projectId);
    if (!wsId || wsId !== actor.workspaceId) {
      throw new UnauthorizedError("Project not found in this workspace.");
    }
  }

  return {
    async listStatuses(actor: ProjectActor, projectId: string): Promise<StatusRecord[]> {
      await guardProjectAccess(actor, projectId);
      return repo.listStatusesByProject(projectId);
    },

    async createStatus(
      actor: ProjectActor,
      input: { name: string; position?: string; isDefault?: boolean; isDone?: boolean },
    ): Promise<StatusRecord> {
      await guardProjectAccess(actor, actor.projectId);
      if (!canManageStatuses(actor.projectRole)) {
        throw new UnauthorizedError("Only project Owner or Admin can manage statuses.");
      }

      const name = input.name.trim();
      if (!name || name.length > 50) {
        throw new ValidationError("Status name must be between 1 and 50 characters.");
      }

      const existingStatuses = await repo.listStatusesByProject(actor.projectId);
      if (existingStatuses.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
        throw new ValidationError(`Status "${name}" already exists in this project.`);
      }

      let position = input.position;
      if (!position) {
        if (existingStatuses.length === 0) {
          position = "1000.00000000000000000000";
        } else {
          const maxPos = Math.max(...existingStatuses.map((s) => Number(s.position) || 0));
          position = (maxPos + 1000).toFixed(20);
        }
      }

      const isDefault = input.isDefault ?? existingStatuses.length === 0;

      return repo.createStatus({
        projectId: actor.projectId,
        name,
        position,
        isDefault,
        isDone: input.isDone ?? false,
      });
    },

    async updateStatus(
      actor: ProjectActor,
      statusId: string,
      input: { name?: string; position?: string; isDefault?: boolean; isDone?: boolean },
    ): Promise<StatusRecord> {
      await guardProjectAccess(actor, actor.projectId);
      if (!canManageStatuses(actor.projectRole)) {
        throw new UnauthorizedError("Only project Owner or Admin can manage statuses.");
      }

      const status = await repo.getStatus(statusId);
      if (!status || status.projectId !== actor.projectId) {
        throw new UnauthorizedError("Status not found in this project.");
      }

      const data: { name?: string; position?: string; isDefault?: boolean; isDone?: boolean } = {};

      if (input.name !== undefined) {
        const name = input.name.trim();
        if (!name || name.length > 50) {
          throw new ValidationError("Status name must be between 1 and 50 characters.");
        }
        const existingStatuses = await repo.listStatusesByProject(actor.projectId);
        if (
          existingStatuses.some(
            (s) => s.id !== statusId && s.name.toLowerCase() === name.toLowerCase(),
          )
        ) {
          throw new ValidationError(`Status "${name}" already exists in this project.`);
        }
        data.name = name;
      }

      if (input.position !== undefined) {
        data.position = input.position;
      }

      if (input.isDefault !== undefined) {
        data.isDefault = input.isDefault;
      }

      if (input.isDone !== undefined) {
        data.isDone = input.isDone;
      }

      return repo.updateStatus({
        statusId,
        ...data,
      });
    },

    async deleteStatus(actor: ProjectActor, statusId: string): Promise<void> {
      await guardProjectAccess(actor, actor.projectId);
      if (!canManageStatuses(actor.projectRole)) {
        throw new UnauthorizedError("Only project Owner or Admin can manage statuses.");
      }

      const status = await repo.getStatus(statusId);
      if (!status || status.projectId !== actor.projectId) {
        throw new UnauthorizedError("Status not found in this project.");
      }

      const totalStatuses = await repo.countStatusesInProject(actor.projectId);
      if (totalStatuses <= 1) {
        throw new ValidationError("Cannot delete the only status in a project.");
      }

      const tasksCount = await repo.countTasksInStatus(statusId);
      if (tasksCount > 0) {
        throw new ValidationError(
          `Cannot delete status "${status.name}" because it contains ${tasksCount} task(s). Move them first.`,
        );
      }

      await repo.deleteStatus(statusId);
    },

    async reorderStatuses(actor: ProjectActor, statusIds: string[]): Promise<void> {
      await guardProjectAccess(actor, actor.projectId);
      if (!canManageStatuses(actor.projectRole)) {
        throw new UnauthorizedError("Only project Owner or Admin can manage statuses.");
      }

      const existingStatuses = await repo.listStatusesByProject(actor.projectId);
      const existingMap = new Map(existingStatuses.map((s) => [s.id, s]));

      if (statusIds.length !== existingStatuses.length) {
        throw new ValidationError("Must provide all status IDs to reorder.");
      }

      for (const id of statusIds) {
        if (!existingMap.has(id)) {
          throw new ValidationError(`Status ${id} does not belong to this project.`);
        }
      }

      const items = statusIds.map((id, index) => ({
        id,
        position: ((index + 1) * 1000).toFixed(20),
      }));

      await repo.reorderStatuses(items);
    },
  };
}

export type StatusService = ReturnType<typeof createStatusService>;
