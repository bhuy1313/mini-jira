import { toast } from "react-toastify";

/**
 * Điểm gọi toast duy nhất của app (ngoài file này không gọi `react-toastify` trực tiếp).
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
  | "webhook"
  | "automation rule"
  | "profile"
  | "password"
  | "session"
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
  webhook: "Webhook",
  "automation rule": "Automation rule",
  profile: "Profile",
  password: "Password",
  session: "Session",
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

/**
 * Trường hợp đặc biệt giữ text cũ (không gộp vào CRUD chung):
 * - API key: text hướng dẫn copy secret + "revoked" theo ngôn ngữ domain.
 * - Copy clipboard: feedback thao tác, không gắn entity động.
 */
export function notifyApiKeyCreated(): void {
  toast.success("API key created — copy the secret now");
}

export function notifyApiKeyRevoked(): void {
  toast.success("API key revoked");
}

export function notifyCopied(): void {
  toast.success("Copied to clipboard");
}

/**
 * Navigation loading — toastId cố định để start/dismiss cùng một toast.
 * Text cố định (không tên route động) theo quy ước toast gate.
 */
export const NAV_LOADING_ID = "navigation-loading";

export function notifyNavigationStart(): string | number {
  if (!toast.isActive(NAV_LOADING_ID)) {
    toast.loading("Đang tải trang...", {
      toastId: NAV_LOADING_ID,
      autoClose: false,
      closeButton: false,
    });
  }
  return NAV_LOADING_ID;
}

export function notifyNavigationDone(): void {
  toast.dismiss(NAV_LOADING_ID);
}
