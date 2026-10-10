// FTS backend (Mốc 17): search_vector @@ websearch_to_tsquery
//
// Unit tests for full-text search behavior.
// Kiểm tra service forwarding + repo routing logic (không phụ thuộc DB thật).
// SQL path được coverage bởi E2E: e2e/search-filters.spec.ts

import { describe, expect, it, vi } from "vitest";

import { createTaskService, type TaskRecord, type TaskRepository } from "./task-service";

const WS = "ws1";
const WS2 = "ws2";

function makeTask(overrides: Partial<TaskRecord> & Pick<TaskRecord, "id" | "projectId" | "workspaceId">): TaskRecord {
  return {
    key: overrides.key ?? null,
    creatorId: "creator",
    assigneeId: null,
    title: overrides.title ?? `Task ${overrides.id}`,
    description: null,
    statusId: overrides.statusId ?? "st-todo",
    statusName: overrides.statusName ?? "To Do",
    sprintId: null,
    priority: overrides.priority ?? "Medium",
    dueDate: null,
    position: overrides.position ?? 0,
    parentId: null,
    parentTitle: null,
    subtaskCount: 0,
    subtaskDoneCount: 0,
    subtasks: [],
    ...overrides,
  };
}

function makeMinimalRepo(overrides: Partial<TaskRepository> = {}): TaskRepository {
  const base: TaskRepository = {
    getTask: vi.fn().mockResolvedValue(null),
    getStatusName: vi.fn().mockResolvedValue(null),
    getSprintName: vi.fn().mockResolvedValue(null),
    getSprintProjectId: vi.fn().mockResolvedValue(null),
    getDefaultProjectStatusId: vi.fn().mockResolvedValue("st-todo"),
    getDoneProjectStatusId: vi.fn().mockResolvedValue("st-done"),
    listSubtasks: vi.fn().mockResolvedValue([]),
    listTasksByProject: vi.fn().mockResolvedValue([]),
    searchWorkspaceTasks: vi.fn().mockResolvedValue([]),
    listWorkspaceMemberIds: vi.fn().mockResolvedValue([]),
    createTask: vi.fn().mockResolvedValue(makeTask({ id: "new", projectId: "p1", workspaceId: WS })),
    updateTask: vi.fn().mockResolvedValue(makeTask({ id: "t1", projectId: "p1", workspaceId: WS })),
    updateTaskPosition: vi.fn().mockResolvedValue(makeTask({ id: "t1", projectId: "p1", workspaceId: WS })),
    rebalanceColumn: vi.fn().mockResolvedValue(undefined),
    deleteTask: vi.fn().mockResolvedValue(undefined),
  };
  return { ...base, ...overrides };
}

function actor(role: "Owner" | "Admin" | "Member" = "Owner") {
  return { userId: "alice", workspaceId: WS, role };
}

// ─────────────────────────────────────────────────────────────────────────────
// searchWorkspaceTasks — service forwarding tests
// ─────────────────────────────────────────────────────────────────────────────

describe("Mốc 17 — searchWorkspaceTasks service forwarding", () => {
  it("gọi repo.searchWorkspaceTasks với đúng workspaceId từ actor", async () => {
    const repo = makeMinimalRepo();
    const service = createTaskService({ repo });

    await service.searchWorkspaceTasks(actor(), { query: "auth" });

    expect(repo.searchWorkspaceTasks).toHaveBeenCalledWith(WS, { query: "auth" });
  });

  it("chuyển toàn bộ filter sang repo (query + statusId + priority + assigneeId)", async () => {
    const repo = makeMinimalRepo();
    const service = createTaskService({ repo });

    const filter = { query: "login", statusId: "st-done", priority: "High" as const, assigneeId: "bob" };
    await service.searchWorkspaceTasks(actor(), filter);

    expect(repo.searchWorkspaceTasks).toHaveBeenCalledWith(WS, filter);
  });

  it("khi query empty string, vẫn gọi repo (fallback path là trách nhiệm của repo)", async () => {
    const repo = makeMinimalRepo();
    const service = createTaskService({ repo });

    await service.searchWorkspaceTasks(actor(), { query: "" });

    expect(repo.searchWorkspaceTasks).toHaveBeenCalledWith(WS, { query: "" });
  });

  it("khi query undefined, vẫn gọi repo", async () => {
    const repo = makeMinimalRepo();
    const service = createTaskService({ repo });

    await service.searchWorkspaceTasks(actor(), {});

    expect(repo.searchWorkspaceTasks).toHaveBeenCalledWith(WS, {});
  });

  it("service filter kết quả: tasks thuộc workspace khác bị loại bỏ sau khi repo trả về", async () => {
    const ws1Task = makeTask({ id: "t1", projectId: "p1", workspaceId: WS, title: "auth flow" });
    const ws2Task = makeTask({ id: "t2", projectId: "p2", workspaceId: WS2, title: "auth config" });

    const repo = makeMinimalRepo({
      searchWorkspaceTasks: vi.fn().mockResolvedValue([ws1Task, ws2Task]),
    });
    const service = createTaskService({ repo });

    const results = await service.searchWorkspaceTasks(actor(), { query: "auth" });

    // Service filter: chỉ trả về task thuộc ws1
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe("t1");
    expect(results[0].workspaceId).toBe(WS);
  });

  it("Member role được tìm kiếm (FR-080)", async () => {
    const repo = makeMinimalRepo({
      searchWorkspaceTasks: vi.fn().mockResolvedValue([
        makeTask({ id: "t1", projectId: "p1", workspaceId: WS, title: "backend search" }),
      ]),
    });
    const service = createTaskService({ repo });

    const results = await service.searchWorkspaceTasks(actor("Member"), { query: "backend" });
    expect(results).toHaveLength(1);
    expect(repo.searchWorkspaceTasks).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// listBoard — service forwarding tests (listTasksByProject)
// ─────────────────────────────────────────────────────────────────────────────

describe("Mốc 17 — listBoard/listTasksByProject service forwarding", () => {
  it("chuyển filter.query cho repo.listTasksByProject", async () => {
    const repo = makeMinimalRepo();
    const service = createTaskService({ repo });

    await service.listBoard(actor(), "p1", { query: "deployment" });

    expect(repo.listTasksByProject).toHaveBeenCalledWith("p1", { query: "deployment" });
  });

  it("khi query trống (blank spaces), repo nhận nguyên filter", async () => {
    const repo = makeMinimalRepo();
    const service = createTaskService({ repo });

    await service.listBoard(actor(), "p1", { query: "   " });

    expect(repo.listTasksByProject).toHaveBeenCalledWith("p1", { query: "   " });
  });

  it("service filter kết quả listBoard: loại tasks thuộc workspace khác", async () => {
    const wsTask = makeTask({ id: "a1", projectId: "p1", workspaceId: WS });
    const otherWsTask = makeTask({ id: "b1", projectId: "p1", workspaceId: WS2 });

    const repo = makeMinimalRepo({
      listTasksByProject: vi.fn().mockResolvedValue([wsTask, otherWsTask]),
    });
    const service = createTaskService({ repo });

    const results = await service.listBoard(actor(), "p1", {});
    expect(results.every((t) => t.workspaceId === WS)).toBe(true);
    expect(results).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FTS path routing — repo-level unit tests (mock-only, no DB)
// ─────────────────────────────────────────────────────────────────────────────

describe("Mốc 17 — FTS query routing via service mock", () => {
  it("searchWorkspaceTasks với query 'authentication' khớp task có từ đó trong title", async () => {
    const authTask = makeTask({ id: "t1", projectId: "p1", workspaceId: WS, title: "authentication flow" });
    const otherTask = makeTask({ id: "t2", projectId: "p1", workspaceId: WS, title: "database setup" });

    const repo = makeMinimalRepo({
      searchWorkspaceTasks: vi.fn(async (wsId, filter) => {
        // Simulate what FTS repo would return: only matching tasks
        const q = filter.query?.trim().toLowerCase() ?? "";
        if (!q) return [authTask, otherTask];
        return [authTask, otherTask].filter((t) => t.title.toLowerCase().includes(q));
      }),
    });
    const service = createTaskService({ repo });

    const results = await service.searchWorkspaceTasks(actor(), { query: "authentication" });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("authentication flow");
  });

  it("searchWorkspaceTasks với query rỗng trả về tất cả tasks trong workspace", async () => {
    const tasks = [
      makeTask({ id: "t1", projectId: "p1", workspaceId: WS, title: "task one" }),
      makeTask({ id: "t2", projectId: "p1", workspaceId: WS, title: "task two" }),
    ];

    const repo = makeMinimalRepo({
      searchWorkspaceTasks: vi.fn().mockResolvedValue(tasks),
    });
    const service = createTaskService({ repo });

    const results = await service.searchWorkspaceTasks(actor(), {});
    expect(results).toHaveLength(2);
  });
});
