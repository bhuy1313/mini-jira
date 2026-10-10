import type { Actor } from "@/features/authorization/actor";
import { effectiveRole, requirePermission } from "@/features/authorization/actor";
import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import {
  canArchiveProject,
  canCreateProject,
  canPermanentlyDeleteProject,
  canRestoreProject,
  canUpdateProject,
  canViewProjects,
} from "@/features/authorization/permissions";
import type { NotificationPublisher } from "@/features/notifications/notification-service";

/**
 * Service project — mọi method nhận `Actor` và đi qua guard trước khi chạm dữ
 * liệu; projectId từ input luôn được xác minh thuộc `actor.workspaceId` (BR-006:
 * project thuộc workspace) để chặn truy cập xuyên workspace.
 *
 * Truy cập dữ liệu qua interface `ProjectRepository` được inject → unit-test
 * bằng fake repository, không cần DB thật.
 */

export interface ProjectRecord {
  id: string;
  name: string;
  /** Short prefix for task keys (e.g. "PRJ"). Immutable after creation. */
  key: string;
  /** Monotonic per-project task sequence. */
  taskCounter: number;
  description: string | null;
  archivedAt: Date | null;
  workspaceId: string;
}

export interface ProjectRepository {
  listActiveProjects(workspaceId: string): Promise<ProjectRecord[]>;
  listArchivedProjects(workspaceId: string): Promise<ProjectRecord[]>;
  getProject(projectId: string): Promise<ProjectRecord | null>;
  findProjectByKey(workspaceId: string, key: string): Promise<ProjectRecord | null>;
  createProject(input: {
    workspaceId: string;
    name: string;
    key: string;
    description: string | null;
  }): Promise<ProjectRecord>;
  updateProject(input: {
    projectId: string;
    name?: string;
    description?: string | null;
  }): Promise<ProjectRecord>;
  setProjectArchived(input: { projectId: string; archivedAt: Date | null }): Promise<ProjectRecord>;
  deleteProject(projectId: string): Promise<void>;
  /** Tạo project + ProjectMember Owner trong cùng một transaction (Mốc 11). */
  createProjectWithOwner(input: {
    workspaceId: string;
    name: string;
    key: string;
    description: string | null;
    creatorId: string;
  }): Promise<ProjectRecord>;
  /** Danh sách userId của tất cả workspace member (để check khi add project member). */
  listWorkspaceMemberIds(workspaceId: string): Promise<string[]>;
}

export interface CreateProjectInput {
  name: string;
  description?: string | null;
  /** Prefix key — absent thì suy từ name. Không đổi được sau khi tạo. */
  key?: string;
}

/** 2–10 ký tự A-Z/0-9, ví dụ "PRJ", "WEB", "MOB1". */
export const PROJECT_KEY_PATTERN = /^[A-Z0-9]{2,10}$/;

export function validateProjectKey(key: string): string {
  const normalized = key.trim().toUpperCase();
  if (!PROJECT_KEY_PATTERN.test(normalized)) {
    throw new ValidationError(
      "Project key must be 2–10 characters of A–Z and 0–9 (e.g. PRJ).",
    );
  }
  return normalized;
}

/** Gợi ý key từ tên: 3 ký tự alnum đầu (upper), fallback "PRJ". */
export function deriveProjectKey(name: string): string {
  const stem = name.replace(/[^A-Za-z0-9]/g, "").slice(0, 3).toUpperCase();
  return PROJECT_KEY_PATTERN.test(stem) && stem.length >= 2 ? stem : "PRJ";
}

interface Deps {
  repo: ProjectRepository;
  notifications?: NotificationPublisher;
}

/** Xác minh project thuộc workspace (và project nếu có) của actor; trả về record hoặc ném lỗi. */
async function fetchOwnedProject(repo: ProjectRepository, actor: Actor, projectId: string): Promise<ProjectRecord> {
  const project = await repo.getProject(projectId);
  if (
    !project ||
    project.workspaceId !== actor.workspaceId ||
    ("projectId" in actor && project.id !== (actor as { projectId: string }).projectId)
  ) {
    throw new UnauthorizedError("Project not found or does not belong to your workspace.");
  }
  return project;
}

export function createProjectService({ repo, notifications }: Deps) {
  /**
   * Key hiệu dụng: explicit thì validate + check trùng; absent thì suy từ name
   * và dồn hậu tố -N tới khi hết trùng. Unique DB là backstop cho race.
   */
  async function resolveProjectKey(
    workspaceId: string,
    name: string,
    inputKey?: string,
  ): Promise<string> {
    if (inputKey !== undefined && inputKey.trim().length > 0) {
      const key = validateProjectKey(inputKey);
      const taken = await repo.findProjectByKey(workspaceId, key);
      if (taken) {
        throw new ValidationError(`Project key "${key}" is already taken in this workspace.`);
      }
      return key;
    }
    const stem = deriveProjectKey(name);
    for (let n = 1; n <= 99; n++) {
      const candidate = n === 1 ? stem : `${stem}-${n}`;
      // Hậu tố -N giữ trong giới hạn 10 ký tự của pattern khi stem dài.
      const key = candidate.length <= 10 ? candidate : `${stem.slice(0, 10 - String(n).length - 1)}-${n}`;
      const taken = await repo.findProjectByKey(workspaceId, key);
      if (!taken) return key;
    }
    throw new ValidationError("Could not allocate a unique project key. Please provide one explicitly.");
  }

  /** Danh sách project active — mọi member xem được (FR-031). */
  async function listProjects(actor: Actor): Promise<ProjectRecord[]> {
    requirePermission(actor, canViewProjects(effectiveRole(actor)), "You are not a member of this workspace.");
    return repo.listActiveProjects(actor.workspaceId);
  }

  /** Danh sách project đã archive — để Owner/Admin khôi phục (FR-035). */
  async function listArchivedProjects(actor: Actor): Promise<ProjectRecord[]> {
    requirePermission(actor, canViewProjects(effectiveRole(actor)), "You are not a member of this workspace.");
    return repo.listArchivedProjects(actor.workspaceId);
  }

  /** Chi tiết project — mọi member; projectId xác minh thuộc workspace (FR-032). */
  async function getProject(actor: Actor, projectId: string): Promise<ProjectRecord> {
    requirePermission(actor, canViewProjects(effectiveRole(actor)), "You are not a member of this workspace.");
    return fetchOwnedProject(repo, actor, projectId);
  }

  /** Tạo project — Owner/Admin; name bắt buộc (FR-030). */
  async function createProject(actor: Actor, input: CreateProjectInput): Promise<ProjectRecord> {
    requirePermission(actor, canCreateProject(effectiveRole(actor)), "Only Owners and Admins can create projects.");
    const key = await resolveProjectKey(actor.workspaceId, input.name, input.key);
    return repo.createProject({
      workspaceId: actor.workspaceId,
      name: input.name,
      key,
      description: input.description ?? null,
    });
  }

  /** Sửa project — Owner/Admin (FR-033). */
  async function updateProject(
    actor: Actor,
    projectId: string,
    input: { name?: string; description?: string | null },
  ): Promise<ProjectRecord> {
    requirePermission(actor, canUpdateProject(effectiveRole(actor)), "Only Owners and Admins can update projects.");
    const project = await fetchOwnedProject(repo, actor, projectId);
    return repo.updateProject({
      projectId,
      name: input.name ?? project.name,
      description: input.description !== undefined ? input.description : project.description,
    });
  }

  /** Archive project (mềm) — Owner/Admin; giữ nguyên dữ liệu task (FR-034, BR-012). */
  async function archiveProject(actor: Actor, projectId: string): Promise<ProjectRecord> {
    requirePermission(actor, canArchiveProject(effectiveRole(actor)), "Only Owners and Admins can archive projects.");
    await fetchOwnedProject(repo, actor, projectId);
    const updated = await repo.setProjectArchived({ projectId, archivedAt: new Date() });

    // Notification: mọi member workspace (Mốc 13) — loại chính actor.
    if (notifications) {
      const memberIds = await repo.listWorkspaceMemberIds(actor.workspaceId);
      await Promise.all(
        memberIds
          .filter((id) => id !== actor.userId)
          .map((userId) =>
            notifications.notify({
              userId,
              type: "ProjectArchived",
              payload: { projectId, projectName: updated.name, workspaceId: actor.workspaceId },
            }),
          ),
      );
    }

    return updated;
  }

  /** Khôi phục project — Owner/Admin (FR-035). */
  async function restoreProject(actor: Actor, projectId: string): Promise<ProjectRecord> {
    requirePermission(actor, canRestoreProject(effectiveRole(actor)), "Only Owners and Admins can restore projects.");
    const project = await fetchOwnedProject(repo, actor, projectId);
    if (project.archivedAt === null) {
      throw new UnauthorizedError("Project is not archived.");
    }
    return repo.setProjectArchived({ projectId, archivedAt: null });
  }

  /** Permanent delete project — chỉ Owner; cascade task/comment/activity (FR-036, BR-013). */
  async function deleteProjectPermanently(actor: Actor, projectId: string): Promise<void> {
    requirePermission(
      actor,
      canPermanentlyDeleteProject(effectiveRole(actor)),
      "Only the Owner can permanently delete a project.",
    );
    await fetchOwnedProject(repo, actor, projectId);
    await repo.deleteProject(projectId);
  }

  /**
   * Tạo project và thêm creator là Owner trong một atomic operation (Mốc 11).
   * Dùng `createProjectWithOwner` của repo (transaction).
   */
  async function createProjectWithMember(
    actor: Actor,
    input: CreateProjectInput,
  ): Promise<ProjectRecord> {
    requirePermission(actor, canCreateProject(effectiveRole(actor)), "Only Owners and Admins can create projects.");
    const key = await resolveProjectKey(actor.workspaceId, input.name, input.key);
    return repo.createProjectWithOwner({
      workspaceId: actor.workspaceId,
      name: input.name,
      key,
      description: input.description ?? null,
      creatorId: actor.userId,
    });
  }

  return {
    listProjects,
    listArchivedProjects,
    getProject,
    createProject,
    updateProject,
    archiveProject,
    restoreProject,
    deleteProjectPermanently,
    createProjectWithMember,
  };
}

export type ProjectService = ReturnType<typeof createProjectService>;
