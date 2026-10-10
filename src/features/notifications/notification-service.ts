import { UnauthorizedError } from "@/features/authorization/errors";

/**
 * Thông báo in-app (ROADMAP Mốc 13).
 *
 * Notification là dữ liệu cá nhân theo user, KHÔNG theo workspace/project:
 * mỗi user chỉ đọc/đánh dấu notification của mình; không có API global. Vì
 * vậy service nhận `userId` trực tiếp thay vì Actor-visited check.
 *
 * Điểm sinh (không sinh thừa, khớp nguyên tắc FR-071):
 * - TaskAssigned: assignee khi được gán task.
 * - NewComment: creator/assignee của task khi có comment mới (loại chính tác giả).
 * - WorkspaceInvited: member mới khi được thêm vào workspace.
 * - ProjectArchived: mọi member workspace khi project bị archive (loại chính actor).
 */

export type NotificationType =
  | "TaskAssigned"
  | "NewComment"
  | "WorkspaceInvited"
  | "ProjectArchived";

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
}

export interface NotificationPreferenceRecord {
  userId: string;
  type: NotificationType;
  enabled: boolean;
}

export const NOTIFICATION_TYPES: NotificationType[] = [
  "TaskAssigned",
  "NewComment",
  "WorkspaceInvited",
  "ProjectArchived",
];

/** Bản đồ đầy đủ 4 loại — thiếu row nghĩa là enabled (sparse opt-out). */
export type NotificationPreferences = Record<NotificationType, boolean>;

export function defaultPreferences(): NotificationPreferences {
  return {
    TaskAssigned: true,
    NewComment: true,
    WorkspaceInvited: true,
    ProjectArchived: true,
  };
}

export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<NotificationRecord>;
  listForUser(userId: string, limit?: number): Promise<NotificationRecord[]>;
  countUnread(userId: string): Promise<number>;
  getNotification(id: string): Promise<NotificationRecord | null>;
  markRead(input: { userId: string; notificationId: string }): Promise<void>;
  markAllRead(userId: string): Promise<void>;
  listPreferences(userId: string): Promise<NotificationPreferenceRecord[]>;
  setPreference(input: { userId: string; type: NotificationType; enabled: boolean }): Promise<void>;
}

/** Interface để các service khác (task/comment/workspace/project) bắn notification. */
export interface NotificationPublisher {
  notify(input: CreateNotificationInput): Promise<void>;
}

interface Deps {
  repo: NotificationRepository;
}

export function createNotificationService({ repo }: Deps) {
  /** Danh sách notification của user (mới nhất trước). */
  async function listNotifications(userId: string, limit = 20): Promise<NotificationRecord[]> {
    return repo.listForUser(userId, limit);
  }

  /** Số notification chưa đọc của user. */
  async function countUnread(userId: string): Promise<number> {
    return repo.countUnread(userId);
  }

  /** Đánh dấu đọc — chỉ user sở hữu notification đó; cố tình xoá không để lộ. */
  async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
    const notif = await repo.getNotification(notificationId);
    if (!notif || notif.userId !== userId) {
      throw new UnauthorizedError("Notification not found.");
    }
    if (notif.readAt) return;
    await repo.markRead({ userId, notificationId });
  }

  /** Đánh dấu đọc toàn bộ notification của user. */
  async function markAllNotificationsRead(userId: string): Promise<void> {
    await repo.markAllRead(userId);
  }

  /** Bản đồ pref đầy đủ của user — mặc định tất cả enabled. */
  async function getPreferences(userId: string): Promise<NotificationPreferences> {
    const prefs = defaultPreferences();
    const rows = await repo.listPreferences(userId);
    for (const row of rows) {
      prefs[row.type] = row.enabled;
    }
    return prefs;
  }

  /** Bật/tắt một loại — user chỉ sửa pref của chính mình (service action guard). */
  async function setPreference(
    userId: string,
    type: NotificationType,
    enabled: boolean,
  ): Promise<NotificationPreferences> {
    await repo.setPreference({ userId, type, enabled });
    return getPreferences(userId);
  }

  return {
    listNotifications,
    countUnread,
    markNotificationRead,
    markAllNotificationsRead,
    getPreferences,
    setPreference,
  };
}

/**
 * Decorator chặn ở đúng một điểm: loại đã tắt thì không ghi DB cũng không bắn
 * hub. Mọi điểm sinh (task/comment/workspace/project) đi qua publisher nên
 * không cần sửa từng call-site.
 */
export function createPreferenceAwarePublisher(
  base: NotificationPublisher,
  isEnabled: (userId: string, type: NotificationType) => Promise<boolean>,
): NotificationPublisher {
  return {
    async notify(input: CreateNotificationInput): Promise<void> {
      if (!(await isEnabled(input.userId, input.type))) return;
      await base.notify(input);
    },
  };
}

export type NotificationService = ReturnType<typeof createNotificationService>;