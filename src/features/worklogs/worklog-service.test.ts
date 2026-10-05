import { beforeEach, describe, expect, it } from "vitest";
import type { Actor, ProjectActor } from "@/features/authorization/actor";
import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import type { TaskRecord, TaskRepository } from "@/features/tasks/task-service";
import {
  calculateTimeTrackingSummary,
  createWorklogService,
  type WorklogRecord,
  type WorklogRepository,
} from "./worklog-service";

describe("Time Tracking & Worklog Service", () => {
  const workspaceId = "ws-1";
  const projectId = "proj-1";

  const ownerActor: ProjectActor = {
    userId: "user-owner",
    workspaceId,
    projectId,
    role: "Owner",
    projectRole: "Owner",
  };

  const memberActor: ProjectActor = {
    userId: "user-member-1",
    workspaceId,
    projectId,
    role: "Member",
    projectRole: "Member",
  };

  const otherMemberActor: ProjectActor = {
    userId: "user-member-2",
    workspaceId,
    projectId,
    role: "Member",
    projectRole: "Member",
  };

  const sampleTask: TaskRecord = {
    id: "task-1",
    projectId,
    workspaceId,
    creatorId: "user-owner",
    assigneeId: "user-member-1",
    title: "Implement feature",
    description: null,
    statusId: "status-1",
    priority: "High",
    dueDate: null,
    position: 100,
    parentId: null,
    sprintId: null,
    subtaskCount: 0,
    subtaskDoneCount: 0,
    originalEstimateMinutes: 480, // 8 hours (1 day)
  };

  let mockTasks: Map<string, TaskRecord>;
  let mockWorklogs: Map<string, WorklogRecord>;
  let taskRepo: TaskRepository;
  let worklogRepo: WorklogRepository;

  beforeEach(() => {
    mockTasks = new Map([[sampleTask.id, { ...sampleTask }]]);
    mockWorklogs = new Map();

    taskRepo = {
      getTask: async (id) => mockTasks.get(id) ?? null,
      getStatusName: async () => "Todo",
      getSprintName: async () => null,
      getSprintProjectId: async () => null,
      getDefaultProjectStatusId: async () => "status-1",
      getDoneProjectStatusId: async () => "status-done",
      listTasksByProject: async () => Array.from(mockTasks.values()),
      searchWorkspaceTasks: async () => Array.from(mockTasks.values()),
      listWorkspaceMemberIds: async () => ["user-owner", "user-member-1", "user-member-2"],
      listSubtasks: async () => [],
      createTask: async () => sampleTask,
      updateTask: async ({ taskId, originalEstimateMinutes }) => {
        const t = mockTasks.get(taskId)!;
        if (originalEstimateMinutes !== undefined) {
          t.originalEstimateMinutes = originalEstimateMinutes;
        }
        return t;
      },
      updateTaskPosition: async () => sampleTask,
      rebalanceColumn: async () => {},
      deleteTask: async () => {},
    };

    worklogRepo = {
      getWorklog: async (id) => mockWorklogs.get(id) ?? null,
      listWorklogsByTask: async (taskId) =>
        Array.from(mockWorklogs.values()).filter((w) => w.taskId === taskId),
      listWorklogsByTaskIds: async (taskIds) => {
        const res: Record<string, WorklogRecord[]> = {};
        for (const id of taskIds) {
          res[id] = Array.from(mockWorklogs.values()).filter((w) => w.taskId === id);
        }
        return res;
      },
      createWorklog: async (input) => {
        const rec: WorklogRecord = {
          id: `wl-${mockWorklogs.size + 1}`,
          taskId: input.taskId,
          workspaceId,
          projectId,
          authorId: input.authorId,
          timeSpentMinutes: input.timeSpentMinutes,
          startedAt: input.startedAt ?? new Date(),
          description: input.description ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
          author: { id: input.authorId, name: "Test User", email: "test@example.com" },
        };
        mockWorklogs.set(rec.id, rec);
        return rec;
      },
      updateWorklog: async ({ worklogId, timeSpentMinutes, description, startedAt }) => {
        const w = mockWorklogs.get(worklogId)!;
        if (timeSpentMinutes !== undefined) w.timeSpentMinutes = timeSpentMinutes;
        if (description !== undefined) w.description = description;
        if (startedAt !== undefined) w.startedAt = startedAt;
        return w;
      },
      deleteWorklog: async (worklogId) => {
        mockWorklogs.delete(worklogId);
      },
    };
  });

  describe("calculateTimeTrackingSummary", () => {
    it("handles task without original estimate", () => {
      const summary = calculateTimeTrackingSummary(null, [{ timeSpentMinutes: 120 }]);
      expect(summary.originalEstimateMinutes).toBeNull();
      expect(summary.totalSpentMinutes).toBe(120);
      expect(summary.remainingMinutes).toBeNull();
      expect(summary.percentSpent).toBe(0);
      expect(summary.isOverEstimate).toBe(false);
    });

    it("calculates partial progress on track", () => {
      const summary = calculateTimeTrackingSummary(480, [
        { timeSpentMinutes: 120 },
        { timeSpentMinutes: 120 },
      ]);
      expect(summary.originalEstimateMinutes).toBe(480);
      expect(summary.totalSpentMinutes).toBe(240);
      expect(summary.remainingMinutes).toBe(240);
      expect(summary.percentSpent).toBe(50);
      expect(summary.isOverEstimate).toBe(false);
    });

    it("calculates 100% completion", () => {
      const summary = calculateTimeTrackingSummary(480, [{ timeSpentMinutes: 480 }]);
      expect(summary.totalSpentMinutes).toBe(480);
      expect(summary.remainingMinutes).toBe(0);
      expect(summary.percentSpent).toBe(100);
      expect(summary.isOverEstimate).toBe(false);
    });

    it("calculates over-estimate (over budget)", () => {
      const summary = calculateTimeTrackingSummary(400, [{ timeSpentMinutes: 500 }]);
      expect(summary.totalSpentMinutes).toBe(500);
      expect(summary.remainingMinutes).toBe(0);
      expect(summary.percentSpent).toBe(125);
      expect(summary.isOverEstimate).toBe(true);
    });
  });

  describe("worklogService operations", () => {
    it("allows any project member to log work on a task", async () => {
      const service = createWorklogService({ repo: worklogRepo, taskRepo });
      const record = await service.logWork(memberActor, {
        taskId: "task-1",
        timeSpentMinutes: 150,
        description: "Implemented unit tests",
      });

      expect(record.id).toBeDefined();
      expect(record.timeSpentMinutes).toBe(150);
      expect(record.authorId).toBe("user-member-1");
      expect(record.description).toBe("Implemented unit tests");
    });

    it("validates positive time spent", async () => {
      const service = createWorklogService({ repo: worklogRepo, taskRepo });
      await expect(
        service.logWork(memberActor, {
          taskId: "task-1",
          timeSpentMinutes: 0,
        }),
      ).rejects.toThrow(ValidationError);

      await expect(
        service.logWork(memberActor, {
          taskId: "task-1",
          timeSpentMinutes: -30,
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("prevents editing other members' worklogs", async () => {
      const service = createWorklogService({ repo: worklogRepo, taskRepo });
      const record = await service.logWork(memberActor, {
        taskId: "task-1",
        timeSpentMinutes: 120,
      });

      await expect(
        service.updateWorklog(otherMemberActor, record.id, {
          timeSpentMinutes: 180,
        }),
      ).rejects.toThrow(UnauthorizedError);

      // But the author can edit it
      const updated = await service.updateWorklog(memberActor, record.id, {
        timeSpentMinutes: 180,
      });
      expect(updated.timeSpentMinutes).toBe(180);
    });

    it("author can delete worklog; Owner can also delete (moderation)", async () => {
      const service = createWorklogService({ repo: worklogRepo, taskRepo });
      const record1 = await service.logWork(memberActor, {
        taskId: "task-1",
        timeSpentMinutes: 60,
      });
      const record2 = await service.logWork(memberActor, {
        taskId: "task-1",
        timeSpentMinutes: 90,
      });

      // Other member cannot delete
      await expect(service.deleteWorklog(otherMemberActor, record1.id)).rejects.toThrow(
        UnauthorizedError,
      );

      // Author can delete record1
      await service.deleteWorklog(memberActor, record1.id);
      expect(mockWorklogs.has(record1.id)).toBe(false);

      // Owner can delete record2 for moderation
      await service.deleteWorklog(ownerActor, record2.id);
      expect(mockWorklogs.has(record2.id)).toBe(false);
    });

    it("returns summary with worklogs included", async () => {
      const service = createWorklogService({ repo: worklogRepo, taskRepo });
      await service.logWork(memberActor, {
        taskId: "task-1",
        timeSpentMinutes: 120,
      });
      await service.logWork(ownerActor, {
        taskId: "task-1",
        timeSpentMinutes: 240,
      });

      const summary = await service.getTimeTrackingSummary(memberActor, "task-1");
      expect(summary.originalEstimateMinutes).toBe(480);
      expect(summary.totalSpentMinutes).toBe(360);
      expect(summary.remainingMinutes).toBe(120);
      expect(summary.percentSpent).toBe(75);
    });
  });
});
