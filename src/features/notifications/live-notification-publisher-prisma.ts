import { createLiveNotificationPublisher } from "@/features/notifications/live-notification-publisher";
import { prismaNotificationPublisher } from "@/features/notifications/prisma-notification-repository";

/** Singleton thật dùng trong server actions: ghi prisma + bắn real-time. */
export const liveNotificationPublisher =
  createLiveNotificationPublisher(prismaNotificationPublisher);