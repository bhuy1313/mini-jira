import { UnauthorizedError, assertPermission } from "@/features/authorization/errors";
import type { Role, TaskField } from "@/features/authorization/permissions";
import { canEditTaskField } from "@/features/authorization/permissions";

/**
 * Ngữ cảnh actor cho mọi query/mutation (ROADMAP Mốc 1):
 * "query/service có ngữ cảnh currentUserId, workspaceId; không có hàm đọc/
 * mutation bỏ qua authorization."
 *
 * Actor đại diện cho user hiện đang thao tác TRONG một workspace cụ thể. Mọi
 * service layer nhận `Actor` và phải đi qua các guard trước khi đọc/ghi.
 */
export interface Actor {
  /** currentUserId — user hiện tại. */
  userId: string;
  /** workspaceId — workspace đang thao tác. */
  workspaceId: string;
  /** role của user trong workspace hiện tại. */
  role: Role;
}

/**
 * Actor trong ngữ cảnh một project cụ thể (ROADMAP Mốc 11).
 * Kế thừa ngữ cảnh workspace; thêm `projectId` (project đang thao tác) và
 * `projectRole` — role hiệu lực TRONG project sau ma trận ghép
 * (`resolveProjectRole`: workspace role mặc định, trừ khi workspace là Owner).
 */
export interface ProjectActor extends Actor {
  /** projectId — project đang thao tác. */
  projectId: string;
  /** projectRole — role hiệu lực trong project (Mốc 11). */
  projectRole: Role;
}

/** Dữ liệu member tối thiểu để xây actor từ bản ghi membership. */
export interface Membership {
  userId: string;
  workspaceId: string;
  role: Role;
}

/** Dựng Actor từ membership; ném lỗi nếu không phải thành viên (không thuộc workspace). */
export function actorFromMembership(membership: Membership | null | undefined): Actor {
  if (!membership) {
    throw new UnauthorizedError("You are not a member of this workspace.");
  }
  return {
    userId: membership.userId,
    workspaceId: membership.workspaceId,
    role: membership.role,
  };
}

/**
 * Ma trận ghép project role (ROADMAP Mốc 11).
 * - Explicit role (ProjectMember row) ưu tiên hơn workspace role — cho phép cả
 *   elevate (Member -> Admin/Owner trong project) lẫn restrict (Admin -> Member).
 * - An toàn: workspace Owner LUÔN là Owner trong mọi project (không bao giờ bị
 *   hạ); nếu chưa có ProjectMember row thì dùng workspace role (backward-compat).
 */
export function resolveProjectRole(workspaceRole: Role, explicitRole: Role | null): Role {
  if (workspaceRole === "Owner") return "Owner";
  return explicitRole ?? workspaceRole;
}

/**
 * Dựng ProjectActor từ membership workspace + role row project (nếu có).
 * `projectId` truyền vào từ caller (session đã xác minh project tồn tại và
 * thuộc workspace của actor).
 */
export function projectActorFromMembership(
  workspaceMembership: Membership | null | undefined,
  projectId: string,
  projectRoleRow: Role | null | undefined,
): ProjectActor {
  const base = actorFromMembership(workspaceMembership);
  return {
    ...base,
    projectId,
    projectRole: resolveProjectRole(base.role, projectRoleRow ?? null),
  };
}

/**
 * Guard chung: ném UnauthorizedError nếu actor không có quyền. Mọi mutation/
 * đọc có kiểm soát bắt buộc gọi hàm này trước khi chạm DB.
 */
export function requirePermission(
  actor: Actor,
  allowed: boolean | ((actor: Actor) => boolean),
  message: string,
): void {
  const ok = typeof allowed === "function" ? allowed(actor) : allowed;
  assertPermission(ok, message);
}

/** Guard theo role cụ thể trong workspace (dùng cho thao tác cấp workspace). */
export function requireRole(actor: Actor, role: Role, message: string): void {
  requirePermission(actor, actor.role === role, message);
}

/**
 * Guard cho việc sửa field trên một task. Nhận role hiệu lực (trong project
 * context là `actor.projectRole`) để đảm bảo actor có quyền trên task cụ thể
 * (creator/assignee với Member) và field được phép (BR-008, BR-009).
 */
export function requireTaskFieldEdit(
  role: Role,
  field: TaskField,
  taskContext: { isCreator: boolean; isAssignee: boolean },
): void {
  const allowed = canEditTaskField(field, {
    role,
    isCreator: taskContext.isCreator,
    isAssignee: taskContext.isAssignee,
  });
  assertPermission(allowed, `Không có quyền sửa trường "${field}" của task.`);
}

/**
 * Role hiệu lực của actor: nếu là `ProjectActor` thì dùng `projectRole`,
 * ngược lại dùng `role` workspace. Dùng trong service để check permission đúng
 * theo ngữ cảnh project (Mốc 11).
 */
export function effectiveRole(actor: Actor): Role {
  if ("projectRole" in actor) {
    return (actor as ProjectActor).projectRole;
  }
  return actor.role;
}

