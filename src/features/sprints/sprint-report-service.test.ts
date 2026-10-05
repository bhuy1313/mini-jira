import { describe, expect, it } from "vitest";
import type { ProjectActor } from "@/features/authorization/actor";
import {
  calculateSprintReport,
  createSprintReportService,
  generateSprintDays,
  toISODateString,
  type RawActivityData,
  type RawSprintData,
  type RawTaskData,
  type RawWorklogData,
  type SprintReportRepository,
} from "./sprint-report-service";

describe("sprint-report-service", () => {
  describe("generateSprintDays", () => {
    it("generates correct array of consecutive days", () => {
      const start = new Date(2026, 9, 1); // 2026-10-01
      const end = new Date(2026, 9, 5); // 2026-10-05
      const days = generateSprintDays(start, end);
      expect(days.length).toBe(5);
      expect(toISODateString(days[0])).toBe("2026-10-01");
      expect(toISODateString(days[4])).toBe("2026-10-05");
    });

    it("handles single-day sprint", () => {
      const d = new Date(2026, 9, 1);
      const days = generateSprintDays(d, d);
      expect(days.length).toBe(1);
      expect(toISODateString(days[0])).toBe("2026-10-01");
    });
  });

  describe("calculateSprintReport", () => {
    const baseSprint: RawSprintData = {
      id: "sprint-1",
      name: "Sprint 1",
      goal: "Launch MVP",
      startDate: new Date("2026-10-01T00:00:00.000Z"),
      endDate: new Date("2026-10-05T00:00:00.000Z"),
      projectId: "proj-1",
      workspaceId: "ws-1",
    };

    it("handles sprint with no start or end date gracefully", () => {
      const sprintNoDates = { ...baseSprint, startDate: null, endDate: null };
      const tasks: RawTaskData[] = [
        {
          id: "t-1",
          title: "Task 1",
          originalEstimateMinutes: 240, // 4h
          statusId: "s-open",
          statusName: "To Do",
          isDone: false,
          priority: "Medium",
          createdAt: new Date("2026-09-30T00:00:00.000Z"),
          updatedAt: new Date("2026-09-30T00:00:00.000Z"),
          assignee: null,
        },
      ];

      const report = calculateSprintReport(sprintNoDates, tasks, [], []);
      expect(report.hasDates).toBe(false);
      expect(report.points).toHaveLength(0);
      expect(report.totalEstimateMinutes).toBe(240);
      expect(report.remainingEstimateMinutes).toBe(240);
      expect(report.totalTasks).toBe(1);
      expect(report.completedTasks).toBe(0);
    });

    it("computes ideal and actual burndown lines in hours metric", () => {
      const tasks: RawTaskData[] = [
        {
          id: "t-1",
          title: "Design DB",
          originalEstimateMinutes: 480, // 8h
          statusId: "s-done",
          statusName: "Done",
          isDone: true,
          priority: "High",
          createdAt: new Date("2026-09-30T00:00:00.000Z"),
          updatedAt: new Date("2026-10-02T12:00:00.000Z"),
          assignee: { id: "u-1", name: "Alice" },
        },
        {
          id: "t-2",
          title: "Build API",
          originalEstimateMinutes: 720, // 12h
          statusId: "s-prog",
          statusName: "In Progress",
          isDone: false,
          priority: "Medium",
          createdAt: new Date("2026-09-30T00:00:00.000Z"),
          updatedAt: new Date("2026-10-01T00:00:00.000Z"),
          assignee: { id: "u-2", name: "Bob" },
        },
      ];

      const activities: RawActivityData[] = [
        {
          taskId: "t-1",
          type: "StatusChanged",
          oldValue: "s-prog",
          newValue: "s-done",
          createdAt: new Date("2026-10-02T14:00:00.000Z"),
        },
      ];

      const worklogs: RawWorklogData[] = [
        {
          taskId: "t-1",
          timeSpentMinutes: 420,
          startedAt: new Date("2026-10-02T09:00:00.000Z"),
        },
      ];

      // Evaluation date is Oct 03 (day 2 index of 5 days: Oct 1, 2, 3, 4, 5)
      const now = new Date("2026-10-03T10:00:00.000Z");
      const report = calculateSprintReport(baseSprint, tasks, activities, worklogs, "hours", now);

      expect(report.hasDates).toBe(true);
      expect(report.totalDays).toBe(5);
      expect(report.totalEstimateMinutes).toBe(1200); // 20h
      expect(report.completedEstimateMinutes).toBe(480); // 8h
      expect(report.remainingEstimateMinutes).toBe(720); // 12h
      expect(report.totalTimeSpentMinutes).toBe(420); // 7h

      expect(report.points).toHaveLength(5);
      // Day 0: Ideal = 20h, Actual = 20h (neither task completed yet)
      expect(report.points[0].idealRemaining).toBe(20);
      expect(report.points[0].actualRemaining).toBe(20);

      // Day 1 (Oct 2): t-1 completed at 14:00 -> actual remaining = 12h
      expect(report.points[1].actualRemaining).toBe(12);

      // Day 2 (Oct 3 - today): actual remaining = 12h
      expect(report.points[2].actualRemaining).toBe(12);

      // Day 3 (Oct 4 - future): actual remaining = null
      expect(report.points[3].actualRemaining).toBeNull();
      // Day 4 (Oct 5 - future): ideal = 0h, actual = null
      expect(report.points[4].idealRemaining).toBe(0);
      expect(report.points[4].actualRemaining).toBeNull();
    });

    it("computes burndown in issue count metric", () => {
      const tasks: RawTaskData[] = [
        {
          id: "t-1",
          title: "Task 1",
          originalEstimateMinutes: null,
          statusId: "s-done",
          statusName: "Done",
          isDone: true,
          priority: "Medium",
          createdAt: new Date("2026-09-30T00:00:00.000Z"),
          updatedAt: new Date("2026-10-02T10:00:00.000Z"),
          assignee: null,
        },
        {
          id: "t-2",
          title: "Task 2",
          originalEstimateMinutes: null,
          statusId: "s-todo",
          statusName: "To Do",
          isDone: false,
          priority: "Low",
          createdAt: new Date("2026-09-30T00:00:00.000Z"),
          updatedAt: new Date("2026-09-30T00:00:00.000Z"),
          assignee: null,
        },
      ];

      const now = new Date("2026-10-03T10:00:00.000Z");
      const report = calculateSprintReport(baseSprint, tasks, [], [], "issues", now);

      expect(report.points[0].idealRemaining).toBe(2);
      expect(report.points[0].actualRemaining).toBe(2); // Neither completed on Oct 1
      expect(report.points[1].actualRemaining).toBe(1); // t-1 completed on Oct 2 -> 1 remaining
    });

    it("detects scope creep (tasks added after sprint start)", () => {
      const tasks: RawTaskData[] = [
        {
          id: "t-1",
          title: "Original task",
          originalEstimateMinutes: 240, // 4h
          statusId: "s-open",
          statusName: "To Do",
          isDone: false,
          priority: "Medium",
          createdAt: new Date("2026-09-20T00:00:00.000Z"),
          updatedAt: new Date("2026-09-20T00:00:00.000Z"),
          assignee: null,
        },
        {
          id: "t-2",
          title: "Added mid sprint",
          originalEstimateMinutes: 180, // 3h
          statusId: "s-open",
          statusName: "To Do",
          isDone: false,
          priority: "Urgent",
          createdAt: new Date("2026-10-02T11:00:00.000Z"), // after sprint start
          updatedAt: new Date("2026-10-02T11:00:00.000Z"),
          assignee: null,
        },
      ];

      const report = calculateSprintReport(baseSprint, tasks, [], [], "hours");

      expect(report.addedIssues).toHaveLength(1);
      expect(report.addedIssues[0].id).toBe("t-2");
      expect(report.addedIssues[0].addedAfterStart).toBe(true);
      expect(report.scopeChangeTasks).toBe(1);
      expect(report.scopeChangeMinutes).toBe(180);
    });
  });

  describe("createSprintReportService", () => {
    const mockRepo: SprintReportRepository = {
      async getSprintWithProject(sprintId: string) {
        if (sprintId !== "sprint-1") return null;
        return {
          id: "sprint-1",
          name: "Sprint 1",
          goal: "Build UI",
          startDate: new Date("2026-10-01"),
          endDate: new Date("2026-10-10"),
          projectId: "proj-1",
          workspaceId: "ws-1",
        };
      },
      async getSprintTasks() {
        return [];
      },
      async getSprintActivities() {
        return [];
      },
      async getSprintWorklogs() {
        return [];
      },
    };

    const service = createSprintReportService(mockRepo);

    const validActor: ProjectActor = {
      userId: "user-1",
      workspaceId: "ws-1",
      projectId: "proj-1",
      role: "Member",
      projectRole: "Member",
    };

    it("rejects unauthorized project context", async () => {
      const invalidActor = { ...validActor, projectId: "other-proj" };
      await expect(
        service.getSprintReport(invalidActor, { sprintId: "sprint-1" }),
      ).rejects.toThrow("Project context mismatch.");
    });

    it("returns sprint report data successfully", async () => {
      const res = await service.getSprintReport(validActor, { sprintId: "sprint-1" });
      expect(res.sprintId).toBe("sprint-1");
      expect(res.sprintName).toBe("Sprint 1");
      expect(res.hasDates).toBe(true);
    });
  });
});
