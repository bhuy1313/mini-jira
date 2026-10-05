import { describe, expect, it } from "vitest";

import { serializeSseEvent, type LiveEvent } from "./live-events";

describe("serializeSseEvent (Mốc 14) — frame SSE chuẩn", () => {
  it("board event thành event: board + data JSON", () => {
    const event: LiveEvent = {
      kind: "board",
      workspaceId: "ws1",
      projectId: "p1",
      actorId: "u1",
      ts: 123,
    };
    expect(serializeSseEvent(event)).toBe(
      `event: board\ndata: ${JSON.stringify(event)}\n\n`,
    );
  });

  it("notify/notifyRead dùng đúng event name", () => {
    const notify = serializeSseEvent({ kind: "notify", userId: "u1", workspaceId: "ws1", ts: 1 });
    expect(notify).toMatch(/^event: notify\n/);

    const read = serializeSseEvent({ kind: "notifyRead", userId: "u1", ts: 1 });
    expect(read).toMatch(/^event: notifyRead\n/);
  });
});