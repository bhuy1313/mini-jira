import { liveHub, type LiveHub } from "@/features/live/live-hub";
import type {
  CreateNotificationInput,
  NotificationPublisher,
} from "@/features/notifications/notification-service";

function workspaceIdFrom(payload: Record<string, unknown>): string | undefined {
  return typeof payload.workspaceId === "string" ? payload.workspaceId : undefined;
}

/**
 * Publisher nối `notify` của Mốc 13 với hub real-time của Mốc 14: vẫn ghi DB
 * (base — `prismaNotificationPublisher`) rồi bắn sự kiện `notify` tới connection
 * của user trên workspace tương ứng. Factory để unit-test dễ inject base + hub
 * (không phụ thuộc prisma).
 */
export function createLiveNotificationPublisher(
  base: NotificationPublisher,
  hub: LiveHub = liveHub,
): NotificationPublisher {
  return {
    async notify(input: CreateNotificationInput): Promise<void> {
      await base.notify(input);
      const workspaceId = workspaceIdFrom(input.payload);
      if (!workspaceId) return;
      hub.publish({ kind: "notify", userId: input.userId, workspaceId, ts: Date.now() });
    },
  };
}