import type { LiveEvent } from "@/features/live/live-events";

/**
 * Hub phát sự kiện real-time in-process (ROADMAP Mốc 14).
 *
 * Mỗi kết nối SSE đăng ký với `workspaceId` + `userId` của session. Routing:
 * - `board`: broadcast tới các connection cùng `workspaceId`.
 * - `notify`: chỉ tới connection của user sở hữu, trên đúng workspace đó.
 * - `notifyRead`: tới mọi connection của user đó.
 *
 * Lưu ý kiến trúc: hub sống trong 1 process — đủ cho dev/single-instance.
 * Nếu deploy nhiều instance cần thay bằng Redis pub/sub (đã ghi ở ROADMAP).
 */

interface Subscriber {
  workspaceId: string;
  userId: string;
  send: (event: LiveEvent) => void;
}

export class LiveHub {
  private readonly subscribers = new Set<Subscriber>();
  private readonly history: LiveEvent[] = [];
  private static readonly MAX_HISTORY = 64;

  private matches(sub: Subscriber, event: LiveEvent): boolean {
    switch (event.kind) {
      case "board":
        return sub.workspaceId === event.workspaceId;
      case "notify":
        return sub.userId === event.userId && sub.workspaceId === event.workspaceId;
      case "notifyRead":
        return sub.userId === event.userId;
    }
  }

  subscribe(
    workspaceId: string,
    userId: string,
    send: (event: LiveEvent) => void,
  ): () => void {
    const sub: Subscriber = { workspaceId, userId, send };
    this.subscribers.add(sub);
    // Replay các event gần đây mà connection này bỏ lỡ (bắn ra trước khi
    // subscribe kịp đăng ký — thường là khoảng khắc mới mở trang/đăng ký SSE).
    for (const event of this.history) {
      if (this.matches(sub, event)) sub.send(event);
    }
    return () => {
      this.subscribers.delete(sub);
    };
  }

  publish(event: LiveEvent): void {
    this.history.push(event);
    if (this.history.length > LiveHub.MAX_HISTORY) {
      this.history.shift();
    }
    for (const sub of this.subscribers) {
      if (this.matches(sub, event)) sub.send(event);
    }
  }
}

/** Singleton dùng chung toàn app, gắn lên globalThis. */
interface LiveHubGlobal {
  liveHub?: LiveHub;
}

const globalForLive = globalThis as unknown as LiveHubGlobal;

/**
 * Server actions và route handlers được Turbopack bundle riêng → module singleton
 * thường sẽ bị nhân đôi thành 2 hub rời nhau (action publish hub này, SSE
 * subscribe hub kia). Đặt trên `globalThis` để mọi bundle trong cùng process
 * dùng đúng 1 instance; HMR reload cũng giữ nguyên subscribers.
 */
export const liveHub = globalForLive.liveHub ?? new LiveHub();
globalForLive.liveHub = liveHub;