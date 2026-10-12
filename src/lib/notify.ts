import { toast } from "sonner";

/**
 * Điểm gọi toast duy nhất của app (ngoài file này không gọi `sonner` trực tiếp).
 *
 * Hai quy ước cứng:
 * 1. Text CỐ ĐỊNH, không nhúng nội dung user-generated (tên task/label/key…).
 *    Lý do: public-api.spec từng strict-violation vì toast chứa tên key làm
 *    trùng text trên trang. Muốn đổi text thì sửa ở đây + chạy E2E.
 * 2. Toast chỉ báo KẾT QUẢ mutation async (thành công đáng chú ý / lỗi hệ
 *    thống). Lỗi validation tại chỗ giữ nguyên inline `role="alert"` cạnh
 *    field — không thay thế.
 */

export type NotifyKind =
  | "task"
  | "subtask"
  | "comment"
  | "project"
  | "workspace"
  | "label"
  | "attachment"
  | "worklog"
  | "sprint"
  | "status"
  | "member"
  | "custom field"
  | "notification settings";

const KIND_LABEL: Record<NotifyKind, string> = {
  task: "Task",
  subtask: "Sub-task",
  comment: "Comment",
  project: "Project",
  workspace: "Workspace",
  label: "Label",
  attachment: "Attachment",
  worklog: "Work log",
  sprint: "Sprint",
  status: "Status",
  member: "Member",
  "custom field": "Custom field",
  "notification settings": "Notification settings",
};

export function notifyCreated(kind: NotifyKind): void {
  toast.success(`${KIND_LABEL[kind]} created`);
}

export function notifyUpdated(kind: NotifyKind): void {
  toast.success(`${KIND_LABEL[kind]} updated`);
}

export function notifyDeleted(kind: NotifyKind): void {
  toast.success(`${KIND_LABEL[kind]} deleted`);
}

export function notifyMoved(kind: NotifyKind): void {
  toast.success(`${KIND_LABEL[kind]} moved`);
}

/** Lỗi hệ thống (mạng/500/retry hết) — message server nếu có, không thì fallback. */
export function notifyError(message?: string): void {
  toast.error(message || "Something went wrong. Please try again.");
}
