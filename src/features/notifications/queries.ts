import { createNotificationService } from "@/features/notifications/notification-service";
import { prismaNotificationRepository } from "@/features/notifications/prisma-notification-repository";
import { getSessionUser } from "@/features/workspaces/session";

const notificationService = createNotificationService({ repo: prismaNotificationRepository });

/** Data cho NotificationBell ở header — không bắt buộc phải đăng nhập (bell ẩn count). */
export async function getNotificationData() {
  const user = await getSessionUser();
  if (!user) return { notifications: [], unreadCount: 0 };
  const [notifications, unreadCount] = await Promise.all([
    notificationService.listNotifications(user.id, 20),
    notificationService.countUnread(user.id),
  ]);
  return { notifications, unreadCount };
}

export type NotificationPageData = Awaited<ReturnType<typeof getNotificationData>>;