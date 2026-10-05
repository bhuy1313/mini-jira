import { describe, expect, it } from "vitest";

import type { Actor } from "@/features/authorization/actor";
import {
  createAnalyticsService,
  type AnalyticsRepository,
  type ProjectAnalytics,
  type WorkspaceAnalyticsRaw,
} from "./analytics-service";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeActor(overrides?: Partial<Actor>): Actor {
  return {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "Owner",
    ...overrides,
  };
}

function makeRaw(overrides?: Partial<WorkspaceAnalyticsRaw>): WorkspaceAnalyticsRaw {
  return {
    tasksByStatus: [
      { statusId: "s-todo", statusName: "Todo", count: 3, isDone: false },
      { statusId: "s-done", statusName: "Done", count: 2, isDone: true },
    ],
    velocity: [
      { week: "2026-W37", created: 4, completed: 2 },
      { week: "2026-W38", created: 1, completed: 3 },
    ],
    assigneeWorkload: [
      { userId: "u-1", userName: "Alice", open: 2, done: 5 },
      { userId: "u-2", userName: "Bob", open: 0, done: 1 },
    ],
    overdue: { overdueCount: 1, noDueDateCount: 2, totalOpen: 3 },
    ...overrides,
  };
}

function makeRepo(overrides?: Partial<AnalyticsRepository>): AnalyticsRepository {
  const projects: ProjectAnalytics[] = [
    {
      projectId: "proj-1",
      projectName: "Alpha",
      tasksByStatus: [
        { statusId: "s-todo", statusName: "Todo", count: 2, isDone: false },
        { statusId: "s-done", statusName: "Done", count: 3, isDone: true },
      ],
      totalTasks: 5,
      completedTasks: 3,
    },
  ];

  return {
    getWorkspaceAnalytics: async () => makeRaw(),
    getProjectsAnalytics: async () => projects,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("analytics-service", () => {
  // 1. Owner can view analytics
  it("allows Owner to get workspace analytics", async () => {
    const service = createAnalyticsService(makeRepo());
    const result = await service.getWorkspaceAnalytics(makeActor({ role: "Owner" }));
    expect(result.totalTasks).toBe(5);
    expect(result.openTasks).toBe(3);
    expect(result.completedTasks).toBe(2);
  });

  // 2. Admin can view analytics
  it("allows Admin to get workspace analytics", async () => {
    const service = createAnalyticsService(makeRepo());
    const result = await service.getWorkspaceAnalytics(makeActor({ role: "Admin" }));
    expect(result.totalTasks).toBeGreaterThanOrEqual(0);
  });

  // 3. Member can view analytics (canViewTasks returns true for all roles)
  it("allows Member to get workspace analytics", async () => {
    const service = createAnalyticsService(makeRepo());
    const result = await service.getWorkspaceAnalytics(makeActor({ role: "Member" }));
    expect(result).toBeDefined();
  });

  // 4. totalTasks = sum of all status counts
  it("computes totalTasks as sum of all status counts", async () => {
    const raw = makeRaw({
      tasksByStatus: [
        { statusId: "s1", statusName: "Todo", count: 7, isDone: false },
        { statusId: "s2", statusName: "InProgress", count: 3, isDone: false },
        { statusId: "s3", statusName: "Done", count: 10, isDone: true },
      ],
    });
    const service = createAnalyticsService(makeRepo({ getWorkspaceAnalytics: async () => raw }));
    const result = await service.getWorkspaceAnalytics(makeActor());
    expect(result.totalTasks).toBe(20);
    expect(result.completedTasks).toBe(10);
    expect(result.openTasks).toBe(10);
  });

  // 5. Empty workspace returns zeros
  it("handles empty workspace (no tasks) gracefully", async () => {
    const raw = makeRaw({
      tasksByStatus: [],
      assigneeWorkload: [],
      velocity: [],
      overdue: { overdueCount: 0, noDueDateCount: 0, totalOpen: 0 },
    });
    const service = createAnalyticsService(makeRepo({ getWorkspaceAnalytics: async () => raw }));
    const result = await service.getWorkspaceAnalytics(makeActor());
    expect(result.totalTasks).toBe(0);
    expect(result.openTasks).toBe(0);
    expect(result.completedTasks).toBe(0);
    expect(result.tasksByStatus).toHaveLength(0);
    expect(result.assigneeWorkload).toHaveLength(0);
  });

  // 6. Velocity weeks are passed through from repo
  it("passes velocity data through unchanged", async () => {
    const velocityData = [
      { week: "2026-W30", created: 0, completed: 0 },
      { week: "2026-W31", created: 5, completed: 2 },
    ];
    const raw = makeRaw({ velocity: velocityData });
    const service = createAnalyticsService(makeRepo({ getWorkspaceAnalytics: async () => raw }));
    const result = await service.getWorkspaceAnalytics(makeActor());
    expect(result.velocity).toHaveLength(2);
    expect(result.velocity[0].week).toBe("2026-W30");
    expect(result.velocity[1].created).toBe(5);
    expect(result.velocity[1].completed).toBe(2);
  });

  // 7. Velocity week format validation (YYYY-WNN)
  it("velocity week labels match YYYY-WNN format", async () => {
    const raw = makeRaw({
      velocity: [
        { week: "2026-W01", created: 1, completed: 0 },
        { week: "2026-W52", created: 0, completed: 1 },
        { week: "2025-W08", created: 3, completed: 3 },
      ],
    });
    const service = createAnalyticsService(makeRepo({ getWorkspaceAnalytics: async () => raw }));
    const result = await service.getWorkspaceAnalytics(makeActor());
    const weekRegex = /^\d{4}-W\d{2}$/;
    for (const v of result.velocity) {
      expect(v.week).toMatch(weekRegex);
    }
  });

  // 8. Overdue stats are passed through correctly
  it("surfaces overdue stats from repo", async () => {
    const raw = makeRaw({
      overdue: { overdueCount: 5, noDueDateCount: 8, totalOpen: 20 },
    });
    const service = createAnalyticsService(makeRepo({ getWorkspaceAnalytics: async () => raw }));
    const result = await service.getWorkspaceAnalytics(makeActor());
    expect(result.overdue.overdueCount).toBe(5);
    expect(result.overdue.noDueDateCount).toBe(8);
    expect(result.overdue.totalOpen).toBe(20);
  });

  // 9. Assignee workload: open/done counts surfaced correctly
  it("surfaces assignee workload aggregation", async () => {
    const raw = makeRaw({
      assigneeWorkload: [
        { userId: "u-1", userName: "Alice", open: 5, done: 10 },
        { userId: "u-2", userName: "Bob", open: 0, done: 2 },
        { userId: "u-3", userName: "Carol", open: 3, done: 0 },
      ],
    });
    const service = createAnalyticsService(makeRepo({ getWorkspaceAnalytics: async () => raw }));
    const result = await service.getWorkspaceAnalytics(makeActor());
    expect(result.assigneeWorkload).toHaveLength(3);
    const alice = result.assigneeWorkload.find((a) => a.userName === "Alice");
    expect(alice?.open).toBe(5);
    expect(alice?.done).toBe(10);
    const bob = result.assigneeWorkload.find((a) => a.userName === "Bob");
    expect(bob?.open).toBe(0);
  });

  // 10. getProjectsAnalytics guard works for all roles
  it("allows Member to get projects analytics", async () => {
    const service = createAnalyticsService(makeRepo());
    const result = await service.getProjectsAnalytics(makeActor({ role: "Member" }));
    expect(Array.isArray(result)).toBe(true);
  });

  // 11. getProjectsAnalytics returns correct project shape
  it("returns per-project analytics with correct shape", async () => {
    const service = createAnalyticsService(makeRepo());
    const result = await service.getProjectsAnalytics(makeActor());
    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe("proj-1");
    expect(result[0].projectName).toBe("Alpha");
    expect(result[0].totalTasks).toBe(5);
    expect(result[0].completedTasks).toBe(3);
    expect(result[0].tasksByStatus).toHaveLength(2);
  });

  // 12. Multiple isDone statuses sum correctly into completedTasks
  it("sums multiple isDone statuses into completedTasks", async () => {
    const raw = makeRaw({
      tasksByStatus: [
        { statusId: "s1", statusName: "Todo", count: 4, isDone: false },
        { statusId: "s2", statusName: "Review", count: 2, isDone: false },
        { statusId: "s3", statusName: "Done", count: 6, isDone: true },
        { statusId: "s4", statusName: "Closed", count: 3, isDone: true },
      ],
    });
    const service = createAnalyticsService(makeRepo({ getWorkspaceAnalytics: async () => raw }));
    const result = await service.getWorkspaceAnalytics(makeActor());
    expect(result.totalTasks).toBe(15);
    expect(result.completedTasks).toBe(9); // s3 + s4
    expect(result.openTasks).toBe(6);      // s1 + s2
  });

  // 13. getWorkspaceAnalytics passes workspaceId to repo
  it("passes actor.workspaceId to the repository", async () => {
    let capturedId = "";
    const repo = makeRepo({
      getWorkspaceAnalytics: async (wsId) => {
        capturedId = wsId;
        return makeRaw();
      },
    });
    const service = createAnalyticsService(repo);
    await service.getWorkspaceAnalytics(makeActor({ workspaceId: "ws-XYZ" }));
    expect(capturedId).toBe("ws-XYZ");
  });

  // 14. getProjectsAnalytics passes workspaceId to repo
  it("passes actor.workspaceId to project analytics repository", async () => {
    let capturedId = "";
    const repo = makeRepo({
      getProjectsAnalytics: async (wsId) => {
        capturedId = wsId;
        return [];
      },
    });
    const service = createAnalyticsService(repo);
    await service.getProjectsAnalytics(makeActor({ workspaceId: "ws-ABC" }));
    expect(capturedId).toBe("ws-ABC");
  });
});
