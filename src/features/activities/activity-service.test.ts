import { describe, expect, it } from "vitest";

import type { Actor } from "@/features/authorization/actor";
import { UnauthorizedError } from "@/features/authorization/errors";
import { createActivityService, type ActivityRecord, type ActivityRepository } from "./activity-service";

class InMemoryActivityRepo implements ActivityRepository {
  public activities: ActivityRecord[] = [];
  public taskWorkspaces: Record<string, string> = {};

  async listActivitiesByTask(taskId: string): Promise<ActivityRecord[]> {
    return this.activities
      .filter((a) => a.taskId === taskId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async getTaskWorkspaceId(taskId: string): Promise<string | null> {
    return this.taskWorkspaces[taskId] ?? null;
  }
}

describe("ActivityService", () => {
  const memberActor: Actor = { userId: "user-1", workspaceId: "ws-1", role: "Member" };
  const otherWsActor: Actor = { userId: "user-2", workspaceId: "ws-2", role: "Member" };

  it("cho phép member trong workspace xem danh sách activity của task", async () => {
    const repo = new InMemoryActivityRepo();
    repo.taskWorkspaces["task-1"] = "ws-1";
    repo.activities.push({
      id: "act-1",
      type: "TaskCreated",
      taskId: "task-1",
      actorId: "user-1",
      oldValue: null,
      newValue: "Task Title",
      createdAt: new Date(),
    });

    const service = createActivityService({ repo });
    const result = await service.listActivities(memberActor, "task-1");

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("TaskCreated");
  });

  it("chặn truy cập nếu task không thuộc workspace của actor", async () => {
    const repo = new InMemoryActivityRepo();
    repo.taskWorkspaces["task-1"] = "ws-1";

    const service = createActivityService({ repo });
    await expect(service.listActivities(otherWsActor, "task-1")).rejects.toThrow(
      UnauthorizedError,
    );
  });
});
