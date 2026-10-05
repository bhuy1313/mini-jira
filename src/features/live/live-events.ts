/**
 * Sự kiện real-time (ROADMAP Mốc 14).
 *
 * Event được publish bởi server actions (hub in-process) và đẩy tới client qua
 * SSE. 3 loại:
 * - `board`: dữ liệu board 1 project thay đổi — bắn cho mọi connection của
 *   workspace đó; client tự lọc theo projectId.
 * - `notify`: có notification mới cho 1 user — bắn cho connection của user đó
 *   trên đúng workspace của notification.
 * - `notifyRead`: user đánh dấu đọc — bắn cho mọi connection của user đó.
 */

export interface BoardLiveEvent {
  kind: "board";
  workspaceId: string;
  projectId: string;
  actorId: string;
  ts: number;
}

export interface NotifyLiveEvent {
  kind: "notify";
  userId: string;
  workspaceId: string;
  ts: number;
}

export interface NotifyReadLiveEvent {
  kind: "notifyRead";
  userId: string;
  ts: number;
}

export type LiveEvent = BoardLiveEvent | NotifyLiveEvent | NotifyReadLiveEvent;

/** Serialize 1 event thành frame SSE (event: <name>\ndata: <json>\n\n). */
export function serializeSseEvent(event: LiveEvent): string {
  return `event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`;
}