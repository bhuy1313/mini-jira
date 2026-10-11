import { describe, expect, it, vi } from "vitest";
import type { Actor } from "@/features/authorization/actor";
import {
  calculateTimesheetReport,
  createTimesheetService,
  generateTimesheetDays,
  getMonthDateRange,
  getWeekDateRange,
  type TimesheetMemberInput,
  type TimesheetRepository,
  type TimesheetWorklogItem,
  toISODateString,
} from "./timesheet-service";

describe("timesheet-service", () => {
  describe("date helpers", () => {
    it("toISODateString formats Date as YYYY-MM-DD", () => {
      const d = new Date("2026-10-02T12:00:00+07:00");
      expect(toISODateString(d)).toBe("2026-10-02");
    });

    it("getWeekDateRange starts on Monday and ends on Sunday", () => {
      // Wednesday, Oct 7, 2026 (giờ VN tường minh — đúng mọi TZ server)
      const wednesday = new Date("2026-10-07T12:00:00+07:00");
      const { startDate, endDate } = getWeekDateRange(wednesday);

      expect(toISODateString(startDate)).toBe("2026-10-05"); // Monday
      // Ranh giới là instant nửa đêm theo zone app (+07), đúng mọi TZ server.
      expect(startDate.toISOString()).toBe("2026-10-04T17:00:00.000Z");
      expect(endDate.toISOString()).toBe("2026-10-11T16:59:59.999Z");

      expect(toISODateString(endDate)).toBe("2026-10-11"); // Sunday
    });

    it("getMonthDateRange starts on 1st and ends on last day of month", () => {
      const midMonth = new Date("2026-10-15T12:00:00+07:00"); // October
      const { startDate, endDate } = getMonthDateRange(midMonth);

      expect(toISODateString(startDate)).toBe("2026-10-01");
      expect(toISODateString(endDate)).toBe("2026-10-31");
    });

    it("generateTimesheetDays creates continuous days with weekend flags", () => {
      const start = new Date("2026-10-05T12:00:00+07:00"); // Mon
      const end = new Date("2026-10-11T12:00:00+07:00"); // Sun
      const days = generateTimesheetDays(start, end);

      expect(days).toHaveLength(7);
      expect(days[0].date).toBe("2026-10-05");
      expect(days[0].dayLabel).toBe("Mon 5");
      expect(days[0].isWeekend).toBe(false);

      expect(days[5].date).toBe("2026-10-10");
      expect(days[5].dayLabel).toBe("Sat 10");
      expect(days[5].isWeekend).toBe(true);

      expect(days[6].date).toBe("2026-10-11");
      expect(days[6].dayLabel).toBe("Sun 11");
      expect(days[6].isWeekend).toBe(true);
    });
  });

  describe("calculateTimesheetReport", () => {
    const members: TimesheetMemberInput[] = [
      { id: "user-1", name: "Alice Nguyen", email: "alice@example.com" },
      { id: "user-2", name: "Bob Tran", email: "bob@example.com" },
      { id: "user-3", name: "Charlie Le", email: "charlie@example.com" },
    ];

    const days = generateTimesheetDays(new Date("2026-10-05T12:00:00+07:00"), new Date("2026-10-11T12:00:00+07:00"));

    it("handles zero worklogs gracefully with empty matrix", () => {
      const report = calculateTimesheetReport([], members, days);

      expect(report.grandTotalMinutes).toBe(0);
      expect(report.activeContributors).toBe(0);
      expect(report.avgHoursPerWorkday).toBe(0);
      expect(report.topProject).toBeUndefined();
      expect(report.rows).toHaveLength(3);
      expect(report.rows[0].totalMinutes).toBe(0);
    });

    it("correctly aggregates worklogs by member, day, and project", () => {
      const worklogs: TimesheetWorklogItem[] = [
        {
          id: "log-1",
          taskId: "task-1",
          taskTitle: "Design Database",
          authorId: "user-1",
          authorName: "Alice Nguyen",
          authorEmail: "alice@example.com",
          projectId: "proj-1",
          projectName: "Backend Core",
          timeSpentMinutes: 240, // 4h
          startedAt: new Date("2026-10-05T09:00:00+07:00"), // Mon Oct 5
          description: "Schema design",
          createdAt: new Date(),
        },
        {
          id: "log-2",
          taskId: "task-1",
          taskTitle: "Design Database",
          authorId: "user-1",
          authorName: "Alice Nguyen",
          authorEmail: "alice@example.com",
          projectId: "proj-1",
          projectName: "Backend Core",
          timeSpentMinutes: 240, // 4h
          startedAt: new Date("2026-10-05T14:00:00+07:00"), // Mon Oct 5
          description: "Prisma migrations",
          createdAt: new Date(),
        },
        {
          id: "log-3",
          taskId: "task-2",
          taskTitle: "API Endpoints",
          authorId: "user-1",
          authorName: "Alice Nguyen",
          authorEmail: "alice@example.com",
          projectId: "proj-1",
          projectName: "Backend Core",
          timeSpentMinutes: 480, // 8h
          startedAt: new Date("2026-10-06T09:00:00+07:00"), // Tue Oct 6
          description: null,
          createdAt: new Date(),
        },
        {
          id: "log-4",
          taskId: "task-3",
          taskTitle: "Frontend UI",
          authorId: "user-2",
          authorName: "Bob Tran",
          authorEmail: "bob@example.com",
          projectId: "proj-2",
          projectName: "Web App",
          timeSpentMinutes: 300, // 5h
          startedAt: new Date("2026-10-05T10:00:00+07:00"), // Mon Oct 5
          description: "Component layout",
          createdAt: new Date(),
        },
      ];

      const report = calculateTimesheetReport(worklogs, members, days);

      // Total minutes: 240 + 240 + 480 + 300 = 1260m (21h)
      expect(report.grandTotalMinutes).toBe(1260);
      expect(report.activeContributors).toBe(2);

      // Alice logged 960m (16h), Bob logged 300m (5h), Charlie 0m
      expect(report.rows[0].member.id).toBe("user-1");
      expect(report.rows[0].totalMinutes).toBe(960);
      expect(report.rows[0].dailyMinutes["2026-10-05"]).toBe(480); // 8h on Mon
      expect(report.rows[0].dailyMinutes["2026-10-06"]).toBe(480); // 8h on Tue
      expect(report.rows[0].dailyMinutes["2026-10-07"]).toBe(0);

      expect(report.rows[1].member.id).toBe("user-2");
      expect(report.rows[1].totalMinutes).toBe(300);

      expect(report.rows[2].member.id).toBe("user-3");
      expect(report.rows[2].totalMinutes).toBe(0);

      // Team daily sum
      expect(report.teamDailyMinutes["2026-10-05"]).toBe(780); // Alice (480) + Bob (300) = 13h
      expect(report.teamDailyMinutes["2026-10-06"]).toBe(480);

      // Top project is Backend Core (proj-1: 960m vs proj-2: 300m)
      expect(report.topProject?.name).toBe("Backend Core");
      expect(report.topProject?.minutes).toBe(960);
    });

    it("creates a fallback row when worklog author is not in members list", () => {
      const worklogs: TimesheetWorklogItem[] = [
        {
          id: "log-ext",
          taskId: "task-x",
          taskTitle: "Consulting",
          authorId: "external-user",
          authorName: "External Contractor",
          authorEmail: "contractor@partner.com",
          projectId: "proj-1",
          projectName: "Backend Core",
          timeSpentMinutes: 120,
          startedAt: new Date("2026-10-05T12:00:00+07:00"),
          description: "Consultation",
          createdAt: new Date(),
        },
      ];

      const report = calculateTimesheetReport(worklogs, members, days);
      const contractorRow = report.rows.find((r) => r.member.id === "external-user");
      expect(contractorRow).toBeDefined();
      expect(contractorRow?.member.name).toBe("External Contractor");
      expect(contractorRow?.totalMinutes).toBe(120);
    });
  });

  describe("createTimesheetService", () => {
    it("fetches report for actor with valid permission", async () => {
      const mockRepo: TimesheetRepository = {
        queryTimesheetWorklogs: vi.fn().mockResolvedValue([
          {
            id: "l1",
            taskId: "t1",
            taskTitle: "Task 1",
            authorId: "u1",
            authorName: "User One",
            authorEmail: "u1@test.com",
            projectId: "p1",
            projectName: "Project One",
            timeSpentMinutes: 60,
            startedAt: new Date("2026-10-05T12:00:00+07:00"),
            description: null,
            createdAt: new Date(),
          },
        ]),
      };

      const mockGetMembers = vi.fn().mockResolvedValue([
        { id: "u1", name: "User One", email: "u1@test.com" },
      ]);

      const service = createTimesheetService({
        repo: mockRepo,
        getMembers: mockGetMembers,
      });

      const actor: Actor = {
        userId: "u1",
        workspaceId: "ws-1",
        role: "Member",
      };

      const report = await service.getTimesheetReport(actor, {
        startDate: new Date("2026-10-05T12:00:00+07:00"),
        endDate: new Date("2026-10-11T12:00:00+07:00"),
      });

      expect(report.grandTotalMinutes).toBe(60);
      expect(mockRepo.queryTimesheetWorklogs).toHaveBeenCalledWith("ws-1", expect.any(Object));
      expect(mockGetMembers).toHaveBeenCalledWith("ws-1");
    });
  });
});
