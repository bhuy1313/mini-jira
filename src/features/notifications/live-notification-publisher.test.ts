import { describe, expect, it, vi } from "vitest";

import { LiveHub } from "@/features/live/live-hub";
import type { CreateNotificationInput, NotificationPublisher } from "./notification-service";
import { createLiveNotificationPublisher } from "./live-notification-publisher";

class SpyPublisher implements NotificationPublisher {
  public calls: CreateNotificationInput[] = [];
  async notify(input: CreateNotificationInput): Promise<void> {
    this.calls.push(input);
  }
}

describe("liveNotificationPublisher (Mốc 14) — ghi DB rồi bắn notify real-time", () => {
  it("gọi base.notify trước rồi publish notify tới user trên workspace của payload", async () => {
    const base = new SpyPublisher();
    const hub = new LiveHub();
    const send = vi.fn();
    const unsubscribe = hub.subscribe("ws1", "alice", send);

    const publisher = createLiveNotificationPublisher(base, hub);
    await publisher.notify({
      userId: "alice",
      type: "TaskAssigned",
      payload: { workspaceId: "ws1", projectId: "p1", taskTitle: "A" },
    });

    expect(base.calls).toHaveLength(1);
    expect(send).toHaveBeenCalledTimes(1);
    const event = send.mock.calls[0][0];
    expect(event).toMatchObject({ kind: "notify", userId: "alice", workspaceId: "ws1" });
    unsubscribe();
  });

  it("không publish khi payload thiếu workspaceId", async () => {
    const base = new SpyPublisher();
    const hub = new LiveHub();
    const send = vi.fn();
    hub.subscribe("ws1", "alice", send);

    const publisher = createLiveNotificationPublisher(base, hub);
    await publisher.notify({ userId: "alice", type: "NewComment", payload: { taskTitle: "A" } });

    expect(base.calls).toHaveLength(1);
    expect(send).not.toHaveBeenCalled();
  });
});