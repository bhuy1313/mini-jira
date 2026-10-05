import type { Role } from "@/features/authorization/permissions";

/**
 * Ràng buộc nghiệp vụ (§ Mốc 1, ROADMAP) — pure functions, không truy cập DB.
 * Mỗi hàm nhận dữ liệu miền tối thiểu và trả true/false (hoặc chính sách cho
 * mutation) để dễ unit-test và tái dùng trong service layer.
 *
 * Các ràng buộc "structural" (unique membership `(userId, workspaceId)`) do DB
 * đảm bảo; các ràng buộc "nghiệp vụ" (một Owner, assignee cùng workspace) do
 * lớp này thực thi ở service.
 */

/** Dữ liệu người dùng cần thiết cho xác minh membership. */
export interface MemberIdentity {
  userId: string;
  role: Role;
}

/**
 * Đúng một Owner mỗi workspace (BR-001).
 * Nhận DANH SÁCH THÀNH VIÊN SAU KHI THỰC HIỆN THAY ĐỔI (thêm/đổi role/gỡ) rồi
 * kiểm tra số Owner có đúng bằng 1 hay không. Service layer dựng snapshot này
 * trước khi ghi DB.
 */
export function keepsSingleOwner(membersAfterChange: MemberIdentity[]): boolean {
  return membersAfterChange.filter((m) => m.role === "Owner").length === 1;
}

/**
 * Khi tạo workspace mới: chính xác một Owner (người tạo).
 */
export function isSingleOwnerMembership(members: MemberIdentity[]): boolean {
  return members.filter((m) => m.role === "Owner").length === 1;
}

/**
 * Membership duy nhất theo (userId, workspaceId) (BR-002).
 * DB đảm bảo unique constraint; hàm này phục vụ kiểm tra trước khi insert để
 * trả lỗi thân thiện thay vì để DB reject.
 */
export function isDuplicateMembership(members: MemberIdentity[], candidateUserId: string): boolean {
  return members.some((m) => m.userId === candidateUserId);
}

/**
 * Assignee phải là member của cùng workspace chứa task (BR-007, FR-044).
 * - `workspaceMemberIds`: tập userId thuộc workspace.
 * - `assigneeId`: userId được assign (nullable).
 */
export function isAssigneeInWorkspace(workspaceMemberIds: string[], assigneeId: string | null): boolean {
  if (assigneeId === null) return true;
  return workspaceMemberIds.includes(assigneeId);
}

/**
 * Project thuộc workspace (BR-006): projectId phải nằm trong tập project của
 * workspace hiện tại trước khi thao tác task.
 */
export function isProjectInWorkspace(workspaceProjectIds: string[], projectId: string): boolean {
  return workspaceProjectIds.includes(projectId);
}

/**
 * Task thuộc project (BR-006): taskId phải nằm trong tập task của project
 * hiện tại trước khi thao tác comment/activity/update task.
 */
export function isTaskInProject(projectTaskIds: string[], taskId: string): boolean {
  return projectTaskIds.includes(taskId);
}
