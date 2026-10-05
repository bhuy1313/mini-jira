export const ROLES = ["Owner", "Admin", "Member"] as const;
export type Role = (typeof ROLES)[number];

export const TASK_STATUSES = ["Todo", "InProgress", "Done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TASK_FIELDS = [
  "title",
  "description",
  "status",
  "priority",
  "assigneeId",
  "dueDate",
  "position",
  "sprintId",
  "originalEstimateMinutes",
] as const;
export type TaskField = (typeof TASK_FIELDS)[number];

/** Các field mà Member được phép sửa trên task thuộc quyền của mình (BR-009). */
export const MEMBER_EDITABLE_TASK_FIELDS: readonly TaskField[] = [
  "title",
  "description",
  "status",
  "sprintId",
  "originalEstimateMinutes",
];

interface TaskContext {
  role: Role;
  isCreator: boolean;
  isAssignee: boolean;
}

/**
 * Permission service thuần TypeScript dựa trên ma trận §2.4 SRS.
 *
 * Không truy cập DB: mọi hàm nhận vai trò và ngữ cảnh (creator/assignee) rồi trả
 * quyết định boolean. Lớp này chỉ là lớp bảo mật server; UI không phải là nguồn tin cậy.
 */

/* ---------- Workspace (FR-012, FR-013) ---------- */

export function canViewWorkspace(_role: Role): boolean {
  return true;
}

export function canUpdateWorkspace(role: Role): boolean {
  return role === "Owner";
}

export function canDeleteWorkspace(role: Role): boolean {
  return role === "Owner";
}

/* ---------- Workspace members (FR-020..FR-023) ---------- */

export function canViewMembers(_role: Role): boolean {
  return true;
}

export function canAddMember(role: Role): boolean {
  return role === "Owner" || role === "Admin";
}

export function canChangeMemberRole(role: Role): boolean {
  return role === "Owner";
}

/**
 * Ai có thể xoá một member khỏi workspace (FR-023).
 * - Owner xoá Admin/Member, không tự xoá chính mình.
 * - Admin chỉ xoá Member.
 * - Member không xoá ai.
 */
export function canRemoveMember(actor: Role, targetRole: Role, isSelf: boolean): boolean {
  if (isSelf) return false;
  if (actor === "Owner") return targetRole !== "Owner";
  if (actor === "Admin") return targetRole === "Member";
  return false;
}

/* ---------- Project (FR-030..FR-036) ---------- */

export function canViewProjects(_role: Role): boolean {
  return true;
}

export function canCreateProject(role: Role): boolean {
  return role === "Owner" || role === "Admin";
}

export function canUpdateProject(role: Role): boolean {
  return role === "Owner" || role === "Admin";
}

export function canArchiveProject(role: Role): boolean {
  return role === "Owner" || role === "Admin";
}

export function canRestoreProject(role: Role): boolean {
  return role === "Owner" || role === "Admin";
}

export function canPermanentlyDeleteProject(role: Role): boolean {
  return role === "Owner";
}

/* ---------- Task (FR-040..FR-047) ---------- */

export function canViewTasks(_role: Role): boolean {
  return true;
}

export function canCreateTask(_role: Role): boolean {
  return true;
}

export function canDeleteTask(role: Role): boolean {
  return role === "Owner" || role === "Admin";
}

export function canAssignTask(role: Role): boolean {
  return role === "Owner" || role === "Admin";
}

export function canChangePriority(role: Role): boolean {
  return role === "Owner" || role === "Admin";
}

export function canChangeDueDate(role: Role): boolean {
  return role === "Owner" || role === "Admin";
}

/** Member chỉ sửa được task mà họ là creator hoặc assignee (BR-008). */
export function canEditTask({ role, isCreator, isAssignee }: TaskContext): boolean {
  if (role === "Owner" || role === "Admin") return true;
  return isCreator || isAssignee;
}

/**
 * Member chỉ được sửa title/description/status (BR-009); Owner/Admin sửa mọi field.
 */
export function canEditTaskField(
  field: TaskField,
  { role, isCreator, isAssignee }: TaskContext,
): boolean {
  if (role === "Owner" || role === "Admin") return true;
  if (!isCreator && !isAssignee) return false;
  return (MEMBER_EDITABLE_TASK_FIELDS as readonly string[]).includes(field);
}

/** Đổi status: Owner/Admin mọi task; Member chỉ task thuộc quyền (FR-045, FR-051). */
export function canChangeStatus({ role, isCreator, isAssignee }: TaskContext): boolean {
  return canEditTaskField("status", { role, isCreator, isAssignee });
}

/* ---------- Comment (FR-060..FR-063) ---------- */

export function canAddComment(_role: Role): boolean {
  return true;
}

export function canViewComments(_role: Role): boolean {
  return true;
}

/** Chỉ sửa comment của chính mình; Owner/Admin không được sửa comment người khác (FR-062). */
export function canEditComment(role: Role, isAuthor: boolean): boolean {
  return isAuthor;
}

/** Xoá comment của mình; Owner/Admin xoá được comment bất kỳ (FR-063, BR-016). */
export function canDeleteComment(role: Role, isAuthor: boolean): boolean {
  if (isAuthor) return true;
  return role === "Owner" || role === "Admin";
}

/* ---------- Activity (FR-072, BR-015) ---------- */

export function canViewActivity(_role: Role): boolean {
  return true;
}

export function canModifyActivity(_role: Role): boolean {
  return false;
}

/* ---------- Attachment (FR-090..FR-093) ---------- */

export function canAddAttachment(_role: Role): boolean {
  return true;
}

export function canViewAttachments(_role: Role): boolean {
  return true;
}

/** Xoá attachment: uploader xoá được file của mình; Owner/Admin xoá được file bất kỳ (FR-092). */
export function canDeleteAttachment(role: Role, isUploader: boolean): boolean {
  if (isUploader) return true;
  return role === "Owner" || role === "Admin";
}

/* ---------- Label (Mốc 10) ---------- */

/** Owner/Admin tạo/sửa/xoá label trong project; Member đọc label. */
export function canManageLabels(role: Role): boolean {
  return role === "Owner" || role === "Admin";
}

/** Mọi member gắn/gỡ label trên task (giống bổ sung metadata). */
export function canToggleTaskLabels(_role: Role): boolean {
  return true;
}

/* ---------- Project members (Mốc 11) ---------- */

/** Owner/Admin thêm/gỡ project member. */
export function canManageProjectMembers(role: Role): boolean {
  return role === "Owner" || role === "Admin";
}

/** Chỉ Owner đổi được role của project member. */
export function canChangeProjectMemberRole(role: Role): boolean {
  return role === "Owner";
}

/* ---------- Custom Statuses (Mốc 12) ---------- */

/** Owner/Admin tạo/sửa/xoá/sắp xếp status trong project; Member đọc status. */
export function canManageStatuses(role: Role): boolean {
  return role === "Owner" || role === "Admin";
}

/* ---------- Sprints (Mốc 15) ---------- */

/** Owner/Admin tạo/sửa/xoá/sắp xếp sprint trong project; Member đọc sprint. */
export function canManageSprints(role: Role): boolean {
  return role === "Owner" || role === "Admin";
}

/* ---------- Custom Fields (Mốc 18) ---------- */

/** Owner/Admin tạo/sửa/xoá/sắp xếp custom field trong project; Member đọc custom field. */
export function canManageCustomFields(role: Role): boolean {
  return role === "Owner" || role === "Admin";
}

/* ---------- Automation Rules (Mốc 19) ---------- */

/** Owner/Admin quản lý automation rules trong project. */
export function canManageAutomationRules(role: Role): boolean {
  return role === "Owner" || role === "Admin";
}

/* ---------- API Keys (Mốc 20) ---------- */

/** Owner/Admin quản lý API keys trong workspace. */
export function canManageApiKeys(role: Role): boolean {
  return role === "Owner" || role === "Admin";
}

/* ---------- Webhooks (Mốc P3) ---------- */

/** Owner/Admin quản lý webhooks trong project. */
export function canManageWebhooks(role: Role): boolean {
  return role === "Owner" || role === "Admin";
}

/* ---------- Worklog / Time Tracking (P5) ---------- */

export function canLogWork(_role: Role): boolean {
  return true;
}

export function canViewWorklogs(_role: Role): boolean {
  return true;
}

/** Chỉ sửa worklog của chính mình. */
export function canEditWorklog(_role: Role, isAuthor: boolean): boolean {
  return isAuthor;
}

/** Xoá worklog của mình; Owner/Admin xoá được worklog bất kỳ (moderation). */
export function canDeleteWorklog(role: Role, isAuthor: boolean): boolean {
  if (isAuthor) return true;
  return role === "Owner" || role === "Admin";
}



