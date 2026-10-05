import type { Actor, Membership } from "@/features/authorization/actor";
import { actorFromMembership, requirePermission } from "@/features/authorization/actor";
import { UnauthorizedError } from "@/features/authorization/errors";
import {
  canAddMember,
  canChangeMemberRole,
  canDeleteWorkspace,
  canRemoveMember,
  canUpdateWorkspace,
  type Role,
} from "@/features/authorization/permissions";
import {
  isDuplicateMembership,
  keepsSingleOwner,
} from "@/features/workspaces/rules";
import type { NotificationPublisher } from "@/features/notifications/notification-service";

/**
 * Service workspace — ví dụ nền tảng "query/service có ngữ cảnh currentUserId,
 * workspaceId; không có hàm đọc/mutation bỏ qua authorization" (ROADMAP Mốc 1).
 *
 * Thiết kế:
 * - Mọi method nhận `Actor` (currentUserId + workspaceId + role).
 * - Mọi thao tác gọi guard trước khi chạm dữ liệu; không có tham số nào cho
 *   phép bỏ qua kiểm tra quyền (workspaceId luôn lấy từ actor, không từ input).
 * - Truy cập dữ liệu qua interface `WorkspaceRepository` được inject → unit-test
 *   bằng fake repository, không cần DB thật. Việc implement repo bằng Prisma
 *   sẽ thay thế dung lượng khi nối vào Mốc 2.
 */

export interface WorkspaceRecord {
  id: string;
  name: string;
  description: string | null;
  icon?: string | null;
}

export interface MemberRecord {
  userId: string;
  role: Role;
}

/** Thành viên kèm thông tin hiển thị (tên/email) để render trang members. */
export interface MemberWithUser extends MemberRecord {
  name: string;
  email: string;
}

export interface WorkspaceRepository {
  listWorkspacesForUser(userId: string): Promise<WorkspaceRecord[]>;
  getWorkspace(workspaceId: string): Promise<WorkspaceRecord | null>;
  getMembership(userId: string, workspaceId: string): Promise<Membership | null>;
  listMembers(workspaceId: string): Promise<MemberRecord[]>;
  listMembersWithUsers(workspaceId: string): Promise<MemberWithUser[]>;
  createWorkspaceWithOwner(
    input: { name: string; description: string | null; icon?: string | null; ownerUserId: string },
  ): Promise<WorkspaceRecord>;
  addMember(input: {
    workspaceId: string;
    userId: string;
    role: Role;
  }): Promise<MemberRecord>;
  changeMemberRole(input: { workspaceId: string; userId: string; role: Role }): Promise<MemberRecord>;
  removeMember(input: { workspaceId: string; userId: string }): Promise<void>;
  updateWorkspace(input: {
    workspaceId: string;
    name?: string;
    description?: string | null;
    icon?: string | null;
  }): Promise<WorkspaceRecord>;
  deleteWorkspace(workspaceId: string): Promise<void>;
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string | null;
  icon?: string | null;
}

interface Deps {
  repo: WorkspaceRepository;
  notifications?: NotificationPublisher;
}

export function createWorkspaceService({ repo, notifications }: Deps) {
  /** Danh sách workspace của user — bất kỳ user đăng nhập nào cũng gọi được. */
  async function listWorkspacesForUser(actor: Pick<Actor, "userId">): Promise<WorkspaceRecord[]> {
    return repo.listWorkspacesForUser(actor.userId);
  }

  /**
   * Chi tiết workspace — chỉ thành viên xem được; workspaceId lấy từ actor
   * (không tin input), nên không thể hỏi workspace của người khác.
   */
  async function getWorkspace(actor: Actor): Promise<WorkspaceRecord> {
    const membership = await repo.getMembership(actor.userId, actor.workspaceId);
    actorFromMembership(membership); // ném nếu không phải member
    const ws = await repo.getWorkspace(actor.workspaceId);
    if (!ws) throw new UnauthorizedError("Workspace not found.");
    return ws;
  }

  /** Danh sách member kèm thông tin — mọi member xem được (FR-020). */
  async function listMembers(actor: Actor): Promise<MemberWithUser[]> {
    requirePermission(actor, true, "You are not a member of this workspace.");
    return repo.listMembersWithUsers(actor.workspaceId);
  }

  /** Tạo workspace — creator trở thành Owner trong cùng một transaction (FR-010, FR-011, FR-014). */
  async function createWorkspace(actor: Pick<Actor, "userId">, input: CreateWorkspaceInput) {
    return repo.createWorkspaceWithOwner({
      name: input.name,
      description: input.description ?? null,
      icon: input.icon ?? null,
      ownerUserId: actor.userId,
    });
  }

  /** Sửa workspace — chỉ Owner (FR-012). */
  async function updateWorkspace(
    actor: Actor,
    input: { name?: string; description?: string | null; icon?: string | null },
  ): Promise<WorkspaceRecord> {
    requirePermission(actor, canUpdateWorkspace(actor.role), "Only the Owner can update the workspace.");
    return repo.updateWorkspace({
      workspaceId: actor.workspaceId,
      name: input.name,
      description: input.description,
      icon: input.icon,
    });
  }

  /** Xoá workspace vĩnh viễn — chỉ Owner (FR-013). */
  async function deleteWorkspace(actor: Actor): Promise<void> {
    requirePermission(actor, canDeleteWorkspace(actor.role), "Only the Owner can delete the workspace.");
    await repo.deleteWorkspace(actor.workspaceId);
  }

  /** Thêm member — Owner/Admin; chặn membership trùng (FR-020, FR-021). */
  async function addMember(actor: Actor, targetUserId: string, role: Role): Promise<MemberRecord> {
    requirePermission(actor, canAddMember(actor.role), "You do not have permission to add members.");

    const members = await repo.listMembers(actor.workspaceId);
    if (isDuplicateMembership(members, targetUserId)) {
      throw new UnauthorizedError("This user is already a member of the workspace.");
    }
    // Sau khi thêm, vẫn phải đúng một Owner (chặn tạo Owner thứ hai).
    if (!keepsSingleOwner([...members, { userId: targetUserId, role }])) {
      throw new UnauthorizedError("This workspace already has an Owner.");
    }

    const member = await repo.addMember({ workspaceId: actor.workspaceId, userId: targetUserId, role });

    // Notification: member mới vào workspace (Mốc 13).
    const ws = await repo.getWorkspace(actor.workspaceId);
    await notifications?.notify({
      userId: targetUserId,
      type: "WorkspaceInvited",
      payload: { workspaceId: actor.workspaceId, workspaceName: ws?.name ?? "" },
    });

    return member;
  }

  /** Đổi role member — chỉ Owner, đảm bảo luôn đúng một Owner (FR-022). */
  async function changeMemberRole(actor: Actor, targetUserId: string, nextRole: Role): Promise<MemberRecord> {
    requirePermission(actor, canChangeMemberRole(actor.role), "Only the Owner can change roles.");

    const members = await repo.listMembers(actor.workspaceId);
    const target = members.find((m) => m.userId === targetUserId);
    if (!target) throw new UnauthorizedError("Member not found.");
    const after = members.map((m) => (m.userId === targetUserId ? { userId: m.userId, role: nextRole } : m));
    if (!keepsSingleOwner(after)) {
      throw new UnauthorizedError("The workspace cannot lose its only Owner.");
    }

    return repo.changeMemberRole({ workspaceId: actor.workspaceId, userId: targetUserId, role: nextRole });
  }

  /** Gỡ member — theo ma trận: Owner bỏ Admin/Member (không tự xoá), Admin chỉ bỏ Member (FR-023). */
  async function removeMember(actor: Actor, targetUserId: string): Promise<void> {
    const members = await repo.listMembers(actor.workspaceId);
    const target = members.find((m) => m.userId === targetUserId);
    if (!target) throw new UnauthorizedError("Member not found.");
    const isSelf = actor.userId === targetUserId;
    requirePermission(
      actor,
      canRemoveMember(actor.role, target.role, isSelf),
      "You do not have permission to remove this member.",
    );
    if (!keepsSingleOwner(members.filter((m) => m.userId !== targetUserId))) {
      throw new UnauthorizedError("The workspace cannot lose its only Owner.");
    }

    await repo.removeMember({ workspaceId: actor.workspaceId, userId: targetUserId });
  }

  return {
    listWorkspacesForUser,
    getWorkspace,
    listMembers,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    addMember,
    changeMemberRole,
    removeMember,
  };
}

export type WorkspaceService = ReturnType<typeof createWorkspaceService>;
