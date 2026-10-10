import { createLiveNotificationPublisher } from "@/features/notifications/live-notification-publisher";
import {
  createPreferenceAwarePublisher,
  type NotificationType,
} from "@/features/notifications/notification-service";
import {
  prismaNotificationPublisher,
  prismaNotificationRepository,
} from "@/features/notifications/prisma-notification-repository";

/**
 * Singleton thật dùng trong server actions: pref-filter → ghi prisma →
 * bắn real-time. Loại đã tắt không ghi DB cũng không bắn hub.
 */
async function isNotificationEnabled(userId: string, type: NotificationType): Promise<boolean> {
  const rows = await prismaNotificationRepository.listPreferences(userId);
  return rows.find((r) => r.type === type)?.enabled ?? true;
}

const preferenceAwareBase = createPreferenceAwarePublisher(
  prismaNotificationPublisher,
  isNotificationEnabled,
);

export const liveNotificationPublisher =
  createLiveNotificationPublisher(preferenceAwareBase);
