import { liveHub } from "@/features/live/live-hub";

/** Helper gọi từ server actions sau khi mutation thành công (ROADMAP Mốc 14). */

export function publishBoardUpdate(
  workspaceId: string,
  projectId: string,
  actorId: string,
): void {
  liveHub.publish({ kind: "board", workspaceId, projectId, actorId, ts: Date.now() });
}

export function publishNotify(
  userId: string,
  workspaceId: string,
): void {
  liveHub.publish({ kind: "notify", userId, workspaceId, ts: Date.now() });
}

export function publishNotifyRead(userId: string): void {
  liveHub.publish({ kind: "notifyRead", userId, ts: Date.now() });
}