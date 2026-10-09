import { describe, expect, it } from "vitest";

import {
  resolveRealTaskId,
  trackPendingTask,
} from "@/features/tasks/pending-task-ids";

describe("pending-task-ids registry", () => {
  it("passes through real ids untouched", async () => {
    await expect(
      resolveRealTaskId("9d5f3c2a-0000-4000-8000-000000000000"),
    ).resolves.toBe("9d5f3c2a-0000-4000-8000-000000000000");
  });

  it("awaits the real id for temp ids", async () => {
    let resolve!: (id: string | null) => void;
    const promise = new Promise<string | null>((r) => {
      resolve = r;
    });
    trackPendingTask("temp-test-1", promise);
    const pending = resolveRealTaskId("temp-test-1");
    resolve("real-id-1");
    await expect(pending).resolves.toBe("real-id-1");
  });

  it("falls back to the temp id when create failed", async () => {
    trackPendingTask("temp-test-2", Promise.resolve(null));
    await expect(resolveRealTaskId("temp-test-2")).resolves.toBe(
      "temp-test-2",
    );
  });

  it("falls back to the temp id when nothing was tracked", async () => {
    await expect(resolveRealTaskId("temp-unknown")).resolves.toBe(
      "temp-unknown",
    );
  });
});
