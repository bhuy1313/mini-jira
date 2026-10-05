import type { Actor } from "@/features/authorization/actor";
import { effectiveRole, requirePermission } from "@/features/authorization/actor";
import { UnauthorizedError } from "@/features/authorization/errors";
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
  description: string | null;
  archivedAt: Date | null;
  workspaceId: string;
}

export interface ProjectRepository {
  listActiveProjects(workspaceId: string): Promise<ProjectRecord[]>;
  listArchivedProjects(workspaceId: string): Promise<ProjectRecord[]>;
  getProject(projectId: string): Promise<ProjectRecord | null>;
  createProject(input: {
    workspaceId: string;
    name: string;
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
    description: string | null;
    creatorId: string;
  }): Promise<ProjectRecord>;
  /** Danh sách userId của tất cả workspace member (để check khi add project member). */
  listWorkspaceMemberIds(workspaceId: string): Promise<string[]>;
}

export interface CreateProjectInput {
  name: string;
  description?: string | null;
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
    return repo.createProject({
      workspaceId: actor.workspaceId,
      name: input.name,
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
    return repo.createProjectWithOwner({
      workspaceId: actor.workspaceId,
      name: input.name,
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
