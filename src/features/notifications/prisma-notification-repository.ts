import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";

import { prisma } from "@/lib/prisma";
import type {
  CreateNotificationInput,
  NotificationPublisher,
  NotificationRecord,
  NotificationRepository,
} from "./notification-service";

type RawNotification = {
  id: string;
  userId: string;
  type: string;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
};

export function mapNotification(row: RawNotification): NotificationRecord {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as NotificationRecord["type"],
    payload: (row.payload ?? {}) as Record<string, unknown>,
    readAt: row.readAt,
    createdAt: row.createdAt,
  };
}

/**
 * Implement `NotificationRepository` bằng Prisma. Đọc/ghi luôn kèm `userId` để
 * mỗi user chỉ thấy notification của mình (service layer đã guard thêm).
 */
export const prismaNotificationRepository: NotificationRepository = {
  async create(input: CreateNotificationInput): Promise<NotificationRecord> {
    const row = await prisma.notification.create({
      data: {
        id: randomUUID(),
        userId: input.userId,
        type: input.type,
        payload: input.payload as Prisma.InputJsonValue,
      },
    });
    return mapNotification(row);
  },

  async listForUser(userId: string, limit = 20): Promise<NotificationRecord[]> {
    const rows = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(mapNotification);
  },

  async countUnread(userId: string): Promise<number> {
    return prisma.notification.count({ where: { userId, readAt: null } });
  },

  async getNotification(id: string): Promise<NotificationRecord | null> {
    const row = await prisma.notification.findUnique({ where: { id } });
    return row ? mapNotification(row) : null;
  },

  async markRead({ userId, notificationId }): Promise<void> {
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
  },

  async markAllRead(userId: string): Promise<void> {
    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  },
};

/** Publisher mặc định dùng Prisma — nối vào services qua `notifications` dep. */
export const prismaNotificationPublisher: NotificationPublisher = {
  notify(input: CreateNotificationInput): Promise<void> {
    return prismaNotificationRepository.create(input).then(() => undefined);
  },
};