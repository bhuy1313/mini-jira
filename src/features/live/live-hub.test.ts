import { describe, expect, it, vi } from "vitest";

import { LiveHub } from "./live-hub";
import type {
  BoardLiveEvent,
  LiveEvent,
  NotifyLiveEvent,
  NotifyReadLiveEvent,
} from "./live-events";

type SendFn = (event: LiveEvent) => void;

function subscribeWs(hub: LiveHub, workspaceId: string, userId: string) {
  const send = vi.fn<SendFn>();
  const unsubscribe = hub.subscribe(workspaceId, userId, send);
  return { send, unsubscribe };
}

const buildBoard = (workspaceId: string, projectId = "p1"): BoardLiveEvent => ({
  kind: "board",
  workspaceId,
  projectId,
  actorId: "u",
  ts: 1,
});

const buildNotify = (userId: string, workspaceId: string): NotifyLiveEvent => ({
  kind: "notify",
  userId,
  workspaceId,
  ts: 1,
});

const buildNotifyRead = (userId: string): NotifyReadLiveEvent => ({
  kind: "notifyRead",
  userId,
  ts: 1,
});

describe("LiveHub (Mốc 14) — routing board/notify/notifyRead theo sub", () => {
  it("board event chỉ đến các connection cùng workspaceId", () => {
    const hub = new LiveHub();
    const inWs = subscribeWs(hub, "ws1", "alice");
    const otherWs = subscribeWs(hub, "ws2", "alice");
    const otherUserWs = subscribeWs(hub, "ws1", "bob");

    hub.publish(buildBoard("ws1"));

    expect(inWs.send).toHaveBeenCalledTimes(1);
    expect(inWs.send).toHaveBeenCalledWith(buildBoard("ws1"));
    expect(otherWs.send).not.toHaveBeenCalled();
    expect(otherUserWs.send).toHaveBeenCalledTimes(1);
  });

  it("notify event chỉ đến user sở hữu trên đúng workspace", () => {
    const hub = new LiveHub();
    const ownerInWs = subscribeWs(hub, "ws1", "alice");
    const others = subscribeWs(hub, "ws1", "bob");
    const ownerOtherWs = subscribeWs(hub, "ws2", "alice");

    hub.publish(buildNotify("alice", "ws1"));

    expect(ownerInWs.send).toHaveBeenCalledTimes(1);
    expect(others.send).not.toHaveBeenCalled();
    expect(ownerOtherWs.send).not.toHaveBeenCalled();
  });

  it("notifyRead event đến mọi connection của user đó", () => {
    const hub = new LiveHub();
    const tabA = subscribeWs(hub, "ws1", "alice");
    const tabB = subscribeWs(hub, "ws2", "alice");
    const other = subscribeWs(hub, "ws1", "bob");

    hub.publish(buildNotifyRead("alice"));

    expect(tabA.send).toHaveBeenCalledTimes(1);
    expect(tabB.send).toHaveBeenCalledTimes(1);
    expect(other.send).not.toHaveBeenCalled();
  });

  it("unsubscribe dừng nhận event", () => {
    const hub = new LiveHub();
    const { send, unsubscribe } = subscribeWs(hub, "ws1", "alice");
    unsubscribe();

    hub.publish(buildBoard("ws1"));

    expect(send).not.toHaveBeenCalled();
  });

  it("subscribe trễ nhận replay event phát ra trước đó (chống bỏ lỡ lúc mới connect)", () => {
    const hub = new LiveHub();
    hub.publish(buildBoard("ws1", "p1"));
    hub.publish(buildNotify("alice", "ws1"));

    const { send } = subscribeWs(hub, "ws1", "alice");

    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith(buildBoard("ws1", "p1"));
    expect(send).toHaveBeenCalledWith(buildNotify("alice", "ws1"));
  });

  it("replay chỉ gửi event phù hợp với connection đó", () => {
    const hub = new LiveHub();
    hub.publish(buildNotify("alice", "ws1"));

    const other = subscribeWs(hub, "ws1", "bob");

    expect(other.send).not.toHaveBeenCalled();
  });

  it("history có giới hạn — event cũ nhất bị loại", () => {
    const hub = new LiveHub();
    for (let i = 0; i < 70; i++) {
      hub.publish(buildBoard("ws1", `p${i}`));
    }

    const { send } = subscribeWs(hub, "ws1", "alice");

    expect(send).toHaveBeenCalledTimes(64);
    expect(send).toHaveBeenCalledWith(buildBoard("ws1", "p6"));
    expect(send).not.toHaveBeenCalledWith(buildBoard("ws1", "p0"));
  });
});