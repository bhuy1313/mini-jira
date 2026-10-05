import type { ProjectActor } from "@/features/authorization/actor";
import { requirePermission } from "@/features/authorization/actor";
import { UnauthorizedError } from "@/features/authorization/errors";
import {
  canManageProjectMembers,
  canChangeProjectMemberRole,
  canRemoveMember,
  type Role,
} from "@/features/authorization/permissions";

/**
 * Bản ghi project membership tối giản trả về từ repo (không cần thông tin user
 * cho service logic; UI sẽ join riêng).
 */
export interface ProjectMemberRecord {
  projectId: string;
  userId: string;
  role: Role;
}

/**
 * Interface repository cho project membership; được inject vào service để dễ
 * unit-test mà không cần DB thật.
 */
export interface ProjectMemberRepository {
  getProjectMember(projectId: string, userId: string): Promise<ProjectMemberRecord | null>;
  listProjectMembers(projectId: string): Promise<ProjectMemberRecord[]>;
  getProjectWorkspaceId(projectId: string): Promise<string | null>;
  addProjectMember(input: { projectId: string; userId: string; role: Role }): Promise<ProjectMemberRecord>;
  changeProjectMemberRole(projectId: string, userId: string, role: Role): Promise<ProjectMemberRecord>;
  removeProjectMember(projectId: string, userId: string): Promise<void>;
}

interface Deps {
  repo: ProjectMemberRepository;
}

/**
 * Service quản lý project membership (Mốc 11).
 *
 * Mọi hàm nhận `ProjectActor` và đi qua guard trước khi chạm dữ liệu.
 * Logic quyền project-level dùng `actor.projectRole` thay vì `actor.role`
 * (workspace role).
 */
export function createProjectMemberService({ repo }: Deps) {
  /** Verify the caller's project-scope (BR-006): projectId must match `actor.projectId` and the project must belong to the actor's workspace. */
  async function requireProjectScope(actor: ProjectActor, projectId: string): Promise<void> {
    if (actor.projectId !== projectId) {
      throw new UnauthorizedError("Project does not match your current project context.");
    }
    const workspaceId = await repo.getProjectWorkspaceId(projectId);
    if (!workspaceId || workspaceId !== actor.workspaceId) {
      throw new UnauthorizedError("Project not found or does not belong to your workspace.");
    }
  }

  /**
   * Danh sA�ch project member �?" m��?i project member/workspace member xem �`�����c.
   * KhA'ng c��n guard c��� th���: n���u caller cA3 ProjectActor thA� �`A� lA� ws member.
   */
  async function listMembers(
    _actor: ProjectActor,
    projectId: string,
  ): Promise<ProjectMemberRecord[]> {
    await requireProjectScope(_actor, projectId);
    return repo.listProjectMembers(projectId);
  }

  /**
   * Thêm member vào project — chỉ Owner/Admin project.
   * - target phải là workspace member (truyền `workspaceMemberIds` từ caller để
   *   tránh query thêm trong service).
   * - Không thêm trùng.
   */
  async function addMember(
    actor: ProjectActor,
    projectId: string,
    targetUserId: string,
    role: Role,
    workspaceMemberIds: string[],
  ): Promise<ProjectMemberRecord> {
    requirePermission(
      actor,
      canManageProjectMembers(actor.projectRole),
      "Only Owner or Admin can add project members.",
    );

    await requireProjectScope(actor, projectId);

    // Target phải là workspace member trước
    if (!workspaceMemberIds.includes(targetUserId)) {
      throw new UnauthorizedError("Target user is not a member of this workspace.");
    }

    // Chặn trùng membership
    const existing = await repo.getProjectMember(projectId, targetUserId);
    if (existing) {
      throw new UnauthorizedError("This user is already a project member.");
    }

    return repo.addProjectMember({ projectId, userId: targetUserId, role });
  }

  /**
   * Đổi role project member — chỉ Owner project.
   * Owner không tự đổi role mình.
   */
  async function changeRole(
    actor: ProjectActor,
    projectId: string,
    targetUserId: string,
    newRole: Role,
  ): Promise<ProjectMemberRecord> {
    requirePermission(
      actor,
      canChangeProjectMemberRole(actor.projectRole),
      "Only the project Owner can change member roles.",
    );

    await requireProjectScope(actor, projectId);

    if (actor.userId === targetUserId) {
      throw new UnauthorizedError("You cannot change your own role.");
    }

    const target = await repo.getProjectMember(projectId, targetUserId);
    if (!target) {
      throw new UnauthorizedError("Project member not found.");
    }

    return repo.changeProjectMemberRole(projectId, targetUserId, newRole);
  }

  /**
   * Gỡ member khỏi project.
   * - Owner xoá Admin/Member; Admin xoá Member; không tự xoá Owner.
   * - Reuse `canRemoveMember` (workspace logic tương thích).
   */
  async function removeMember(
    actor: ProjectActor,
    projectId: string,
    targetUserId: string,
  ): Promise<void> {
    const target = await repo.getProjectMember(projectId, targetUserId);
    if (!target) {
      throw new UnauthorizedError("Project member not found.");
    }

    const isSelf = actor.userId === targetUserId;
    requirePermission(
      actor,
      canRemoveMember(actor.projectRole, target.role, isSelf),
      "You do not have permission to remove this project member.",
    );

    await requireProjectScope(actor, projectId);

    await repo.removeProjectMember(projectId, targetUserId);
  }

  return { listMembers, addMember, changeRole, removeMember };
}

export type ProjectMemberService = ReturnType<typeof createProjectMemberService>;
