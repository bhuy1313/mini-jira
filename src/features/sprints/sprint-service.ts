import type { ProjectActor } from "@/features/authorization/actor";
import { effectiveRole, requirePermission } from "@/features/authorization/actor";
import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import { canManageSprints } from "@/features/authorization/permissions";

export interface SprintRecord {
  id: string;
  projectId: string;
  workspaceId: string;
  name: string;
  goal: string | null;
  startDate: Date | null;
  endDate: Date | null;
  position: string;
  createdAt: Date;
}

export interface SprintRepository {
  getSprint(sprintId: string): Promise<SprintRecord | null>;
  getProjectWorkspaceId(projectId: string): Promise<string | null>;
  getSprintProjectId(sprintId: string): Promise<string | null>;
  listSprintsByProject(projectId: string): Promise<SprintRecord[]>;
  createSprint(input: {
    projectId: string;
    name: string;
    goal: string | null;
    startDate: Date | null;
    endDate: Date | null;
    position: string;
  }): Promise<SprintRecord>;
  updateSprint(input: {
    sprintId: string;
    name?: string;
    goal?: string | null;
    startDate?: Date | null;
    endDate?: Date | null;
    position?: string;
  }): Promise<SprintRecord>;
  deleteSprint(sprintId: string): Promise<void>;
  /** Đếm task theo sprint trong project: key "backlog" = chưa có sprint. */
  countTasksBySprint(projectId: string): Promise<Record<string, number>>;
  /** Đếm task "done" (status.isDone) theo sprint trong project. */
  countDoneTasksBySprint(projectId: string): Promise<Record<string, number>>;
  reorderSprints(items: { id: string; position: string }[]): Promise<void>;
}

export const MAX_SPRINT_NAME_LENGTH = 100;
export const MAX_SPRINT_GOAL_LENGTH = 500;

export function createSprintService(repo: SprintRepository) {
  async function guardProjectAccess(actor: ProjectActor, projectId: string): Promise<void> {
    if (actor.projectId !== projectId) {
      throw new UnauthorizedError("Project context mismatch.");
    }
    const wsId = await repo.getProjectWorkspaceId(projectId);
    if (!wsId || wsId !== actor.workspaceId) {
      throw new UnauthorizedError("Project not found in this workspace.");
    }
  }

  function validateName(raw: string): string {
    const name = raw.trim();
    if (name.length === 0 || name.length > MAX_SPRINT_NAME_LENGTH) {
      throw new ValidationError(
        `Sprint name must be between 1 and ${MAX_SPRINT_NAME_LENGTH} characters.`,
      );
    }
    return name;
  }

  function validateGoal(raw: string | null | undefined): string | null {
    if (raw === undefined) return undefined as never;
    const goal = raw?.trim() ?? "";
    if (goal.length > MAX_SPRINT_GOAL_LENGTH) {
      throw new ValidationError(
        `Sprint goal must be at most ${MAX_SPRINT_GOAL_LENGTH} characters.`,
      );
    }
    return goal.length > 0 ? goal : null;
  }

  /** startDate <= endDate khi cả hai có mặt (BR cho sprint). */
  function validateDates(startDate: Date | null, endDate: Date | null): void {
    if (startDate && endDate && endDate < startDate) {
      throw new ValidationError("Sprint end date must be on or after the start date.");
    }
  }

  /** Danh sách sprint của project — mọi member đọc (Mốc 15). */
  async function listSprints(actor: ProjectActor, projectId: string): Promise<SprintRecord[]> {
    await guardProjectAccess(actor, projectId);
    return repo.listSprintsByProject(projectId);
  }

  /** Tạo sprint — Owner/Admin (Mốc 15). */
  async function createSprint(
    actor: ProjectActor,
    input: {
      name: string;
      goal?: string | null;
      startDate?: Date | null;
      endDate?: Date | null;
    },
  ): Promise<SprintRecord> {
    await guardProjectAccess(actor, actor.projectId);
    requirePermission(
      actor,
      canManageSprints(effectiveRole(actor)),
      "Only project Owner or Admin can manage sprints.",
    );

    const name = validateName(input.name);
    const goal = validateGoal(input.goal);
    const startDate = input.startDate ?? null;
    const endDate = input.endDate ?? null;
    validateDates(startDate, endDate);

    const existingSprints = await repo.listSprintsByProject(actor.projectId);
    if (existingSprints.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      throw new ValidationError(`Sprint "${name}" already exists in this project.`);
    }

    let position: string;
    if (existingSprints.length === 0) {
      position = "1000.00000000000000000000";
    } else {
      const maxPos = Math.max(...existingSprints.map((s) => Number(s.position) || 0));
      position = (maxPos + 1000).toFixed(20);
    }

    return repo.createSprint({
      projectId: actor.projectId,
      name,
      goal,
      startDate,
      endDate,
      position,
    });
  }

  /** Sửa sprint — Owner/Admin (Mốc 15). */
  async function updateSprint(
    actor: ProjectActor,
    sprintId: string,
    input: {
      name?: string;
      goal?: string | null;
      startDate?: Date | null;
      endDate?: Date | null;
    },
  ): Promise<SprintRecord> {
    await guardProjectAccess(actor, actor.projectId);
    requirePermission(
      actor,
      canManageSprints(effectiveRole(actor)),
      "Only project Owner or Admin can manage sprints.",
    );

    const sprint = await repo.getSprint(sprintId);
    if (!sprint || sprint.projectId !== actor.projectId) {
      throw new UnauthorizedError("Sprint not found in this project.");
    }

    const data: {
      name?: string;
      goal?: string | null;
      startDate?: Date | null;
      endDate?: Date | null;
    } = {};

    if (input.name !== undefined) {
      const name = validateName(input.name);
      const existingSprints = await repo.listSprintsByProject(actor.projectId);
      if (
        existingSprints.some((s) => s.id !== sprintId && s.name.toLowerCase() === name.toLowerCase())
      ) {
        throw new ValidationError(`Sprint "${name}" already exists in this project.`);
      }
      data.name = name;
    }
    if (input.goal !== undefined) data.goal = validateGoal(input.goal);
    if (input.startDate !== undefined) data.startDate = input.startDate;
    if (input.endDate !== undefined) data.endDate = input.endDate;

    validateDates(data.startDate ?? sprint.startDate, data.endDate ?? sprint.endDate);

    return repo.updateSprint({ sprintId, ...data });
  }

  /** Xoá sprint — Owner/Admin; task tự fall-back backlog (SetNull). */
  async function deleteSprint(actor: ProjectActor, sprintId: string): Promise<void> {
    await guardProjectAccess(actor, actor.projectId);
    requirePermission(
      actor,
      canManageSprints(effectiveRole(actor)),
      "Only project Owner or Admin can manage sprints.",
    );

    const sprint = await repo.getSprint(sprintId);
    if (!sprint || sprint.projectId !== actor.projectId) {
      throw new UnauthorizedError("Sprint not found in this project.");
    }

    await repo.deleteSprint(sprintId);
  }

  /** Sắp xếp sprint — Owner/Admin (Mốc 15). */
  async function reorderSprints(actor: ProjectActor, sprintIds: string[]): Promise<void> {
    await guardProjectAccess(actor, actor.projectId);
    requirePermission(
      actor,
      canManageSprints(effectiveRole(actor)),
      "Only project Owner or Admin can manage sprints.",
    );

    const existingSprints = await repo.listSprintsByProject(actor.projectId);
    const existingMap = new Map(existingSprints.map((s) => [s.id, s]));

    if (sprintIds.length !== existingSprints.length) {
      throw new ValidationError("Must provide all sprint IDs to reorder.");
    }
    for (const id of sprintIds) {
      if (!existingMap.has(id)) {
        throw new ValidationError(`Sprint ${id} does not belong to this project.`);
      }
    }

    const items = sprintIds.map((id, index) => ({
      id,
      position: ((index + 1) * 1000).toFixed(20),
    }));

    await repo.reorderSprints(items);
  }

  return {
    listSprints,
    createSprint,
    updateSprint,
    deleteSprint,
    reorderSprints,
  };
}

export type SprintService = ReturnType<typeof createSprintService>;