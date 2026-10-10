"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { publishNotifyRead } from "@/features/live/live-publisher";
import {
  createNotificationService,
  NOTIFICATION_TYPES,
  type NotificationType,
} from "@/features/notifications/notification-service";
import { prismaNotificationRepository } from "@/features/notifications/prisma-notification-repository";
import { getSessionUser } from "@/features/workspaces/session";

const notificationService = createNotificationService({ repo: prismaNotificationRepository });

async function requireUserId(): Promise<string> {
  const user = await getSessionUser();
  if (!user) redirect("/auth");
  return user.id;
}

/** Đánh dấu đọc một notification — chỉ của chính user (không có API global). */
export async function markNotificationReadAction(notificationId: string): Promise<void> {
  const userId = await requireUserId();
  await notificationService.markNotificationRead(userId, notificationId);
  revalidatePath("/workspaces", "layout");
  publishNotifyRead(userId);
}

/** Đánh dấu đọc toàn bộ notification của user. */
export async function markAllNotificationsReadAction(): Promise<void> {
  const userId = await requireUserId();
  await notificationService.markAllNotificationsRead(userId);
  revalidatePath("/workspaces", "layout");
  publishNotifyRead(userId);
}

/** Bật/tắt một loại notification của chính user. */
export async function setNotificationPreferenceAction(
  type: string,
  enabled: boolean,
): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!(NOTIFICATION_TYPES as string[]).includes(type)) {
    return { error: "Unknown notification type." };
  }
  await notificationService.setPreference(userId, type as NotificationType, enabled);
  revalidatePath("/account");
  return {};
}