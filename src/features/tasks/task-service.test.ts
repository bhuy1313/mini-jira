import { describe, expect, it, vi } from "vitest";

import { UnauthorizedError } from "@/features/authorization/errors";
import type { Role } from "@/features/authorization/permissions";
import type {
  CreateNotificationInput,
  NotificationPublisher,
} from "@/features/notifications/notification-service";
import {
  applyBoardLimit,
  BOARD_TASK_LIMIT,
  createTaskService,
  type TaskRecord,
  type TaskRepository,
} from "./task-service";

const WS = "ws1";

const wsMembers = ["alice", "bob", "carol"];

interface MakeTaskInput {
  id: string;
  projectId: string;
  workspaceId?: string;
  creatorId: string;
  assigneeId?: string | null;
  title?: string;
  statusId?: string;
  statusName?: string;
  priority?: TaskRecord["priority"];
  position?: number;
  parentId?: string | null;
  parentTitle?: string | null;
  subtaskCount?: number;
  subtaskDoneCount?: number;
  subtasks?: TaskRecord["subtasks"];
}

function makeTask(input: MakeTaskInput): TaskRecord {
  return {
    id: input.id,
    key: null,
    projectId: input.projectId,
    workspaceId: input.workspaceId ?? WS,
    creatorId: input.creatorId,
    assigneeId: input.assigneeId ?? null,
    title: input.title ?? `Task ${input.id}`,
    description: null,
    statusId: input.statusId ?? "st-todo",
    statusName: input.statusName ?? "To Do",
    sprintId: null,
    priority: input.priority ?? "Medium",
    dueDate: null,
    position: input.position ?? 0,
    parentId: input.parentId ?? null,
    parentTitle: input.parentTitle ?? null,
    subtaskCount: input.subtaskCount ?? 0,
    subtaskDoneCount: input.subtaskDoneCount ?? 0,
    subtasks: input.subtasks ?? [],
  };
}

function makeRepo(tasks: TaskRecord[]): {
  repo: TaskRepository;
  calls: { [k: string]: unknown[] };
} {
  const calls: { [k: string]: unknown[] } = {};
  function track(name: string, args: unknown) {
    (calls[name] ??= []).push(args);
  }

  const statusNames: Record<string, string> = {
    "st-todo": "To Do",
    "st-inprogress": "In Progress",
    "st-done": "Done",
  };

  const sprintNames: Record<string, string> = {
    "sp-1": "Sprint 1",
    "sp-2": "Sprint 2",
  };

  const repo: TaskRepository = {
    getTask: vi.fn(async (taskId) => tasks.find((t) => t.id === taskId) ?? null),
    getStatusName: vi.fn(async (statusId) => statusNames[statusId] ?? statusId),
    getSprintName: vi.fn(async (sprintId) => sprintNames[sprintId] ?? sprintId),
    getSprintProjectId: vi.fn(async (sprintId) => (sprintId === "sp-other" ? "p2" : sprintId === "sp-1" || sprintId === "sp-2" ? "p1" : null)),
    getDefaultProjectStatusId: vi.fn(async () => "st-todo"),
    getDoneProjectStatusId: vi.fn(async () => "st-done"),
    listSubtasks: vi.fn(async (parentId) => tasks.filter((t) => t.parentId === parentId)),
    listTasksByProject: vi.fn(async (projectId, filter) => {
      track("listTasksByProject", { projectId, filter });
      let list = tasks.filter((t) => t.projectId === projectId);
      if (filter?.query) {
        const q = filter.query.toLowerCase();
        list = list.filter((t) => t.title.toLowerCase().includes(q));
      }
      if (filter?.statusId) {
        list = list.filter((t) => t.statusId === filter.statusId);
      }
      if (filter?.priority) {
        list = list.filter((t) => t.priority === filter.priority);
      }
      if (filter?.assigneeId) {
        list = list.filter((t) =>
          filter.assigneeId === "unassigned" ? t.assigneeId === null : t.assigneeId === filter.assigneeId,
        );
      }
      if (filter?.sprintId) {
        list = list.filter((t) =>
          filter.sprintId === "backlog" ? t.sprintId === null : t.sprintId === filter.sprintId,
        );
      }
      return list.map((t) => ({ ...t }));
    }),
    searchWorkspaceTasks: vi.fn(async (workspaceId, filter) => {
      track("searchWorkspaceTasks", { workspaceId, filter });
      let list = tasks.filter((t) => t.workspaceId === workspaceId);
      if (filter?.query) {
        const q = filter.query.toLowerCase();
        list = list.filter((t) => t.title.toLowerCase().includes(q));
      }
      if (filter?.statusId) {
        list = list.filter((t) => t.statusId === filter.statusId);
      }
      if (filter?.priority) {
        list = list.filter((t) => t.priority === filter.priority);
      }
      if (filter?.assigneeId) {
        list = list.filter((t) =>
          filter.assigneeId === "unassigned" ? t.assigneeId === null : t.assigneeId === filter.assigneeId,
        );
      }
      return list.map((t) => ({ ...t }));
    }),
    listWorkspaceMemberIds: vi.fn(async (workspaceId) =>
      workspaceId === WS ? [...wsMembers] : [],
    ),
    createTask: vi.fn(async (input) => {
      track("createTask", input);
      const t = makeTask({
        id: `new_${tasks.length + 1}`,
        projectId: input.projectId,
        creatorId: input.creatorId,
        assigneeId: input.assigneeId,
        title: input.title,
        statusId: input.statusId,
        statusName: statusNames[input.statusId] ?? input.statusId,
        priority: input.priority,
        position: input.position,
      });
      t.description = input.description;
      t.dueDate = input.dueDate;
      t.parentId = input.parentId ?? null;
      t.sprintId = input.sprintId ?? null;
      tasks.push(t);
      return { ...t };
    }),
    updateTask: vi.fn(async (input) => {
      track("updateTask", input);
      const t = tasks.find((x) => x.id === input.taskId);
      if (!t) throw new Error("missing");
      if (input.title !== undefined) t.title = input.title;
      if (input.description !== undefined) t.description = input.description;
      if (input.statusId !== undefined) {
        t.statusId = input.statusId;
        t.statusName = statusNames[input.statusId] ?? input.statusId;
      }
      if (input.priority !== undefined) t.priority = input.priority;
      if (input.assigneeId !== undefined) t.assigneeId = input.assigneeId;
      if (input.dueDate !== undefined) t.dueDate = input.dueDate;
      if (input.sprintId !== undefined) {
        t.sprintId = input.sprintId;
        t.sprintName = input.sprintId ? sprintNames[input.sprintId] ?? input.sprintId : undefined;
      }
      if (input.parentId !== undefined) {
        t.parentId = input.parentId;
      }
      return { ...t };
    }),
    updateTaskPosition: vi.fn(async ({ taskId, statusId, position, activity }) => {
      track("updateTaskPosition", { taskId, statusId, position, activity });
      const t = tasks.find((x) => x.id === taskId);
      if (!t) throw new Error("missing");
      t.statusId = statusId;
      t.statusName = statusNames[statusId] ?? statusId;
      t.position = position;
      return { ...t };
    }),
    rebalanceColumn: vi.fn(async ({ projectId, statusId, order, taskId, activity }) => {
      track("rebalanceColumn", { projectId, statusId, order, taskId, activity });
      for (const o of order) {
        const t = tasks.find((x) => x.id === o.taskId);
        if (t) {
          t.statusId = statusId;
          t.statusName = statusNames[statusId] ?? statusId;
          t.position = o.position;
        }
      }
    }),
    deleteTask: vi.fn(async (taskId) => {
      track("deleteTask", taskId);
      const i = tasks.findIndex((x) => x.id === taskId);
      if (i >= 0) tasks.splice(i, 1);
    }),
  };
  return { repo, calls };
}

function svc(repo: TaskRepository) {
  return createTaskService({ repo });
}

function act(role: Role) {
  return { userId: "alice", workspaceId: WS, role };
}

const baseTasks = [
  makeTask({ id: "t1", projectId: "p1", creatorId: "carol", assigneeId: "carol", position: 0 }),
  makeTask({ id: "t2", projectId: "p1", creatorId: "alice", assigneeId: "bob", position: 1 }),
];

describe("Task service — create", () => {
  it("mọi role tạo được task (FR-040)", async () => {
    for (const role of ["Owner", "Admin", "Member"] as const) {
      const { repo } = makeRepo([...baseTasks.map((t) => ({ ...t }))]);
      const created = await svc(repo).createTask(act(role), "p1", { title: "New" });
      expect(created.title).toBe("New");
      expect(created.creatorId).toBe("alice");
      expect(created.statusId).toBe("st-todo");
    }
  });

  it("assignee không phải member workspace → bị chặn (BR-007)", async () => {
    const { repo, calls } = makeRepo([...baseTasks.map((t) => ({ ...t }))]);
    await expect(
      svc(repo).createTask(act("Owner"), "p1", { title: "X", assigneeId: "stranger" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    expect(calls.createTask ?? []).toHaveLength(0);
  });

  it("assignee là member workspace thì hợp lệ (FR-044)", async () => {
    const { repo } = makeRepo([...baseTasks.map((t) => ({ ...t }))]);
    const created = await svc(repo).createTask(act("Owner"), "p1", { title: "X", assigneeId: "bob" });
    expect(created.assigneeId).toBe("bob");
  });

  it("task mới xếp cuối cột Todo (position đứng sau task hiện có)", async () => {
    const { repo } = makeRepo([...baseTasks.map((t) => ({ ...t }))]);
    const created = await svc(repo).createTask(act("Member"), "p1", { title: "New" });
    expect(created.position).toBe(2); // sau t1(0), t2(1)
  });

  it("tạo task ghi activity TaskCreated (FR-070)", async () => {
    const { repo, calls } = makeRepo([...baseTasks.map((t) => ({ ...t }))]);
    await svc(repo).createTask(act("Owner"), "p1", { title: "Task With Activity" });
    const lastCall = calls.createTask[0] as { activity?: { type: string; newValue: string } };
    expect(lastCall.activity?.type).toBe("TaskCreated");
    expect(lastCall.activity?.newValue).toBe("Task With Activity");
  });
});

describe("Task service — update field policy (FR-042, BR-008, BR-009)", () => {
  it("Member là creator/assignee sửa được title", async () => {
    const member = { userId: "carol", workspaceId: WS, role: "Member" as const };
    const { repo } = makeRepo([...baseTasks.map((t) => ({ ...t }))]);
    const t = await svc(repo).updateTask(member, "t1", "title", "Renamed");
    expect(t.title).toBe("Renamed");
  });

  it("Member không phải creator/assignee không sửa được title của người khác", async () => {
    const member = { userId: "carol", workspaceId: WS, role: "Member" as const };
    const { repo } = makeRepo([...baseTasks.map((t) => ({ ...t }))]);
    await expect(svc(repo).updateTask(member, "t2", "title", "X")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("Admin sửa được mọi field của mọi task", async () => {
    const { repo } = makeRepo([...baseTasks.map((t) => ({ ...t }))]);
    const t = await svc(repo).updateTask(act("Admin"), "t2", "priority", "Urgent");
    expect(t.priority).toBe("Urgent");
  });

  it("Member không đổi được priority (chỉ Owner/Admin, FR-046)", async () => {
    const member = { userId: "carol", workspaceId: WS, role: "Member" as const };
    const { repo } = makeRepo([
      makeTask({ id: "t1", projectId: "p1", creatorId: "carol", assigneeId: "carol" }),
    ]);
    await expect(svc(repo).updateTask(member, "t1", "priority", "High")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("Member không gán/reassign được (chỉ Owner/Admin, FR-044)", async () => {
    const member = { userId: "carol", workspaceId: WS, role: "Member" as const };
    const { repo } = makeRepo([
      makeTask({ id: "t1", projectId: "p1", creatorId: "carol", assigneeId: "carol" }),
    ]);
    await expect(svc(repo).updateTask(member, "t1", "assigneeId", "bob")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("Member không đổi được due date (FR-047)", async () => {
    const member = { userId: "carol", workspaceId: WS, role: "Member" as const };
    const { repo } = makeRepo([
      makeTask({ id: "t1", projectId: "p1", creatorId: "carol", assigneeId: "carol" }),
    ]);
    await expect(
      svc(repo).updateTask(member, "t1", "dueDate", new Date()),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("sửa title/status/priority/assignee/dueDate ghi activity tương ứng; sửa description KHÔNG ghi activity (FR-070, FR-071)", async () => {
    const { repo, calls } = makeRepo([
      makeTask({ id: "t2", projectId: "p1", creatorId: "alice", assigneeId: "bob", statusId: "st-todo", priority: "Medium" }),
    ]);

    // Title update
    await svc(repo).updateTask(act("Owner"), "t2", "title", "New Title");
    let lastUpdate = calls.updateTask[calls.updateTask.length - 1] as { activity?: { type: string } };
    expect(lastUpdate.activity?.type).toBe("TitleChanged");

    // Status update
    await svc(repo).updateTask(act("Owner"), "t2", "status", "st-inprogress");
    lastUpdate = calls.updateTask[calls.updateTask.length - 1] as { activity?: { type: string } };
    expect(lastUpdate.activity?.type).toBe("StatusChanged");

    // Priority update
    await svc(repo).updateTask(act("Owner"), "t2", "priority", "Urgent");
    lastUpdate = calls.updateTask[calls.updateTask.length - 1] as { activity?: { type: string } };
    expect(lastUpdate.activity?.type).toBe("PriorityChanged");

    // Assignee update
    await svc(repo).updateTask(act("Owner"), "t2", "assigneeId", "carol");
    lastUpdate = calls.updateTask[calls.updateTask.length - 1] as { activity?: { type: string } };
    expect(lastUpdate.activity?.type).toBe("AssigneeChanged");

    // DueDate update
    await svc(repo).updateTask(act("Owner"), "t2", "dueDate", new Date("2026-10-01"));
    lastUpdate = calls.updateTask[calls.updateTask.length - 1] as { activity?: { type: string } };
    expect(lastUpdate.activity?.type).toBe("DueDateChanged");

    // Description update -> NO activity (FR-071)
    await svc(repo).updateTask(act("Owner"), "t2", "description", "Some notes");
    lastUpdate = calls.updateTask[calls.updateTask.length - 1] as { activity?: { type: string } };
    expect(lastUpdate.activity).toBeUndefined();
  });
});

describe("Task service — move (status + position)", () => {
  it("Member move được task của chính mình (creator/assignee)", async () => {
    const member = { userId: "carol", workspaceId: WS, role: "Member" as const };
    const { repo, calls } = makeRepo([
      makeTask({ id: "t1", projectId: "p1", creatorId: "carol", assigneeId: "carol", statusId: "st-todo", position: 0 }),
    ]);
    const t = await svc(repo).moveTask(member, "t1", "st-inprogress", 0);
    expect(t.statusId).toBe("st-inprogress");
    expect(calls.updateTaskPosition).toHaveLength(1);
  });

  it("Member không move được task của người khác", async () => {
    const member = { userId: "carol", workspaceId: WS, role: "Member" as const };
    const { repo, calls } = makeRepo([
      makeTask({ id: "t2", projectId: "p1", creatorId: "alice", assigneeId: "bob", statusId: "st-todo", position: 0 }),
    ]);
    await expect(svc(repo).moveTask(member, "t2", "st-inprogress", 0)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(calls.updateTaskPosition ?? []).toHaveLength(0);
  });

  it("Admin move được mọi task", async () => {
    const { repo } = makeRepo([
      makeTask({ id: "t2", projectId: "p1", creatorId: "alice", assigneeId: "bob", statusId: "st-todo", position: 0 }),
    ]);
    const t = await svc(repo).moveTask(act("Admin"), "t2", "st-done", 0);
    expect(t.statusId).toBe("st-done");
    expect(t.position).toBe(0);
  });

  it("move giữa hai task cùng cột tính trung điểm vị trí (FR-052)", async () => {
    const { repo } = makeRepo([
      makeTask({ id: "a", projectId: "p1", creatorId: "alice", statusId: "st-todo", position: 0 }),
      makeTask({ id: "b", projectId: "p1", creatorId: "alice", statusId: "st-todo", position: 10 }),
      makeTask({ id: "m", projectId: "p1", creatorId: "alice", statusId: "st-inprogress", position: 0 }),
    ]);
    const t = await svc(repo).moveTask(act("Owner"), "m", "st-todo", 1);
    expect(t.statusId).toBe("st-todo");
    expect(t.position).toBe(5); // giữa 0 và 10
  });

  it("hết khoảng hợp lệ → rebalance toàn bộ cột (FR-053)", async () => {
    const { repo, calls } = makeRepo([
      makeTask({ id: "a", projectId: "p1", creatorId: "alice", statusId: "st-todo", position: 0 }),
      makeTask({ id: "c", projectId: "p1", creatorId: "alice", statusId: "st-todo", position: 0 }),
      makeTask({ id: "m", projectId: "p1", creatorId: "alice", statusId: "st-inprogress", position: 0 }),
    ]);
    const t = await svc(repo).moveTask(act("Owner"), "m", "st-todo", 1);
    expect(calls.rebalanceColumn).toHaveLength(1);
    expect(t.statusId).toBe("st-todo");
  });
});

describe("Task service — xoá (chỉ Owner/Admin, FR-043)", () => {
  it("Owner/Admin xoá được task", async () => {
    for (const role of ["Owner", "Admin"] as const) {
      const { repo, calls } = makeRepo([...baseTasks.map((t) => ({ ...t }))]);
      await svc(repo).deleteTask(act(role), "t1");
      expect(calls.deleteTask).toHaveLength(1);
    }
  });

  it("Member bị từ chối xoá task", async () => {
    const member = { userId: "carol", workspaceId: WS, role: "Member" as const };
    const { repo, calls } = makeRepo([...baseTasks.map((t) => ({ ...t }))]);
    await expect(svc(repo).deleteTask(member, "t1")).rejects.toBeInstanceOf(UnauthorizedError);
    expect(calls.deleteTask ?? []).toHaveLength(0);
  });
});

describe("Task service — search & filters (FR-080..FR-085)", () => {
  const searchTasks = [
    makeTask({ id: "t1", projectId: "p1", creatorId: "alice", title: "Frontend authentication bug", statusId: "st-todo", priority: "High", assigneeId: "bob" }),
    makeTask({ id: "t2", projectId: "p1", creatorId: "alice", title: "Backend API search", statusId: "st-inprogress", priority: "Urgent", assigneeId: "alice" }),
    makeTask({ id: "t3", projectId: "p1", creatorId: "alice", title: "Documentation review", statusId: "st-done", priority: "Low", assigneeId: null }),
    makeTask({ id: "t4", projectId: "p2", workspaceId: "ws9", creatorId: "alice", title: "Other workspace frontend task", statusId: "st-todo" }),
  ];

  it("search case-insensitive substring trong title (FR-080)", async () => {
    const { repo } = makeRepo([...searchTasks]);
    const results = await svc(repo).searchWorkspaceTasks(act("Owner"), { query: "FRONTEND" });
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe("Frontend authentication bug");
  });

  it("không trả về task của workspace khác khi search (FR-081)", async () => {
    const { repo } = makeRepo([...searchTasks]);
    const results = await svc(repo).searchWorkspaceTasks(act("Owner"), { query: "task" });
    expect(results.every((t) => t.workspaceId === WS)).toBe(true);
    expect(results.some((t) => t.id === "t4")).toBe(false);
  });

  it("filter kết hợp status, priority và assignee (FR-082..FR-084)", async () => {
    const { repo } = makeRepo([...searchTasks]);
    const filtered = await svc(repo).listBoard(act("Member"), "p1", {
      statusId: "st-inprogress",
      priority: "Urgent",
      assigneeId: "alice",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("t2");
  });

  it("filter unassigned task", async () => {
    const { repo } = makeRepo([...searchTasks]);
    const filtered = await svc(repo).listBoard(act("Member"), "p1", {
      assigneeId: "unassigned",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("t3");
  });
});

describe("Task service — board limit", () => {
  it("applyBoardLimit giữ nguyên list dưới cap", () => {
    const tasks = [makeTask({ id: "a", projectId: "p1", creatorId: "alice" })];
    const res = applyBoardLimit(tasks, 2);
    expect(res.truncated).toBe(false);
    expect(res.tasks).toHaveLength(1);
  });

  it("applyBoardLimit cắt đúng cap và báo truncated", () => {
    const tasks = ["a", "b", "c"].map((id) =>
      makeTask({ id, projectId: "p1", creatorId: "alice" }),
    );
    const res = applyBoardLimit(tasks, 2);
    expect(res.truncated).toBe(true);
    expect(res.tasks.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("listBoard chuyển limit xuống repo", async () => {
    const { repo, calls } = makeRepo([
      makeTask({ id: "a", projectId: "p1", creatorId: "alice" }),
    ]);
    await svc(repo).listBoard(act("Member"), "p1", { limit: 10 });
    const forwarded = calls.listTasksByProject?.[0] as {
      filter?: { limit?: number };
    };
    expect(forwarded.filter?.limit).toBe(10);
  });

  it("BOARD_TASK_LIMIT là số dương hợp lý", () => {
    expect(BOARD_TASK_LIMIT).toBeGreaterThanOrEqual(100);
  });
});

describe("Task service — cross-workspace bị chặn", () => {
  it("task thuộc workspace khác không get/update/move/delete được", async () => {
    const other = makeTask({ id: "o1", projectId: "p9", workspaceId: "ws9", creatorId: "alice" });
    const { repo, calls } = makeRepo([other]);
    await expect(svc(repo).getTask(actor(), "o1")).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(svc(repo).updateTask(act("Owner"), "o1", "title", "X")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(svc(repo).deleteTask(act("Owner"), "o1")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(calls.updateTask ?? []).toHaveLength(0);
    expect(calls.deleteTask ?? []).toHaveLength(0);
  });

  it("task không tồn tại → UnauthorizedError", async () => {
    const { repo } = makeRepo([]);
    await expect(svc(repo).getTask(actor(), "missing")).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("Task service — ProjectActor threading (Mốc 11, H2)", () => {
  function projectActor(overrides: Partial<{ role: Role; projectId: string; projectRole: Role }>) {
    return {
      userId: "alice",
      workspaceId: WS,
      role: overrides.role ?? "Admin" as Role,
      projectId: overrides.projectId ?? "p1",
      projectRole: overrides.projectRole ?? "Member",
    };
  }

  it("get/update/move/delete task thuộc project khác trong cùng workspace → bị chặn (H2)", async () => {
    const otherProjectTask = makeTask({ id: "other", projectId: "p2", creatorId: "alice", assigneeId: "alice" });
    const { repo, calls } = makeRepo([...baseTasks.map((t) => ({ ...t })), otherProjectTask]);

    // actor thuộc p1, task "other" thuộc p2 (cùng ws1) -> bị chặn
    const actorOnP1 = projectActor({ role: "Owner", projectId: "p1", projectRole: "Owner" });
    await expect(svc(repo).getTask(actorOnP1, "other")).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(svc(repo).updateTask(actorOnP1, "other", "title", "X")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(svc(repo).moveTask(actorOnP1, "other", "st-done", 0)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(svc(repo).deleteTask(actorOnP1, "other")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(calls.updateTask ?? []).toHaveLength(0);
    expect(calls.updateTaskPosition ?? []).toHaveLength(0);
    expect(calls.deleteTask ?? []).toHaveLength(0);
  });

  it("Admin workspace nhưng project Role Member KHÔNG xoá task (effectiveRole)", async () => {
    const { repo, calls } = makeRepo([...baseTasks.map((t) => ({ ...t }))]);
    const restrictedAdmin = projectActor({ role: "Admin", projectRole: "Member" });
    await expect(svc(repo).deleteTask(restrictedAdmin, "t1")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(calls.deleteTask ?? []).toHaveLength(0);
  });

  it("Member workspace với projectRole Owner được xoá task (effectiveRole)", async () => {
    const { repo, calls } = makeRepo([...baseTasks.map((t) => ({ ...t }))]);
    const projectOwner = projectActor({ role: "Member", projectRole: "Owner" });
    await svc(repo).deleteTask(projectOwner, "t1");
    expect(calls.deleteTask ?? []).toHaveLength(1);
  });

  it("Member workspace với project Role Member (restrict) không sửa task người khác", async () => {
    const { repo, calls } = makeRepo([...baseTasks.map((t) => ({ ...t }))]);
    // t1: creator carol, assignee carol. alice là Member trong project nhưng t1 không phải task của alice.
    const projectMember = projectActor({ role: "Admin", projectRole: "Member" });
    await expect(svc(repo).updateTask(projectMember, "t1", "title", "X")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(calls.updateTask ?? []).toHaveLength(0);
  });
});

describe("Task service — TaskAssigned notifications (Mốc 13)", () => {
  function makePublisher(): {
    publisher: NotificationPublisher;
    sent: CreateNotificationInput[];
  } {
    const sent: CreateNotificationInput[] = [];
    const publisher: NotificationPublisher = {
      notify: vi.fn(async (input) => {
        sent.push(input);
      }),
    };
    return { publisher, sent };
  }

  function svcWith(repo: TaskRepository, notifications?: NotificationPublisher) {
    return createTaskService({ repo, notifications });
  }

  function freshTasks() {
    return baseTasks.map((t) => ({ ...t }));
  }

  it("createTask có assignee khác actor → gửi TaskAssigned cho assignee", async () => {
    const { repo } = makeRepo(freshTasks());
    const { publisher, sent } = makePublisher();
    const service = svcWith(repo, publisher);

    const created = await service.createTask(act("Owner"), "p1", {
      title: "New Task",
      assigneeId: "bob",
    });

    expect(publisher.notify).toHaveBeenCalledTimes(1);
    expect(sent[0]).toMatchObject({
      userId: "bob",
      type: "TaskAssigned",
      payload: {
        taskId: created.id,
        taskTitle: "New Task",
        projectId: "p1",
        workspaceId: WS,
      },
    });
  });

  it("createTask tự gán → không gửi notification", async () => {
    const { repo } = makeRepo(freshTasks());
    const { publisher } = makePublisher();
    const service = svcWith(repo, publisher);

    await service.createTask(act("Owner"), "p1", { title: "Self", assigneeId: "alice" });
    expect(publisher.notify).not.toHaveBeenCalled();
  });

  it("createTask không có assignee → không gửi notification", async () => {
    const { repo } = makeRepo(freshTasks());
    const { publisher } = makePublisher();
    const service = svcWith(repo, publisher);

    await service.createTask(act("Owner"), "p1", { title: "No assignee" });
    expect(publisher.notify).not.toHaveBeenCalled();
  });

  it("updateTask đổi assignee bob→carol → TaskAssigned cho carol", async () => {
    const { repo } = makeRepo(freshTasks());
    const { publisher, sent } = makePublisher();
    const service = svcWith(repo, publisher);

    // t2: creator alice, assignee bob
    await service.updateTask(act("Owner"), "t2", "assigneeId", "carol");

    expect(publisher.notify).toHaveBeenCalledTimes(1);
    expect(sent[0]).toMatchObject({
      userId: "carol",
      type: "TaskAssigned",
      payload: { taskId: "t2", workspaceId: WS },
    });
  });

  it("updateTask giữ nguyên assignee → không gửi notification", async () => {
    const { repo } = makeRepo(freshTasks());
    const { publisher } = makePublisher();
    const service = svcWith(repo, publisher);

    await service.updateTask(act("Owner"), "t2", "assigneeId", "bob");
    expect(publisher.notify).not.toHaveBeenCalled();
  });

  it("updateTask gỡ assignee → không gửi notification", async () => {
    const { repo } = makeRepo(freshTasks());
    const { publisher } = makePublisher();
    const service = svcWith(repo, publisher);

    await service.updateTask(act("Owner"), "t2", "assigneeId", null);
    expect(publisher.notify).not.toHaveBeenCalled();
  });
});

describe("Task service — sprint assignment (Mốc 15)", () => {
  it("Owner gán task vào sprint ghi SprintChanged activity với tên sprint mới", async () => {
    const { repo, calls } = makeRepo([
      makeTask({ id: "t1", projectId: "p1", creatorId: "alice", assigneeId: "bob" }),
    ]);

    const t = await svc(repo).updateTask(act("Owner"), "t1", "sprintId", "sp-1");
    expect(t.sprintId).toBe("sp-1");
    expect(t.sprintName).toBe("Sprint 1");

    const lastUpdate = calls.updateTask[calls.updateTask.length - 1] as {
      activity?: { type: string; oldValue: string | null; newValue: string | null };
    };
    expect(lastUpdate.activity?.type).toBe("SprintChanged");
    expect(lastUpdate.activity?.oldValue).toBeNull();
    expect(lastUpdate.activity?.newValue).toBe("Sprint 1");
  });

  it("gỡ task về backlog (sprintId rỗng → null) ghi SprintChanged old=sprint, new=null", async () => {
    const { repo, calls } = makeRepo([]);
    const task = makeTask({ id: "t1", projectId: "p1", creatorId: "alice", assigneeId: "bob" });
    task.sprintId = "sp-1";
    task.sprintName = "Sprint 1";
    // push vào repo qua makeRepo không nhận task rỗng → seed bằng update
    await repo.createTask({
      projectId: "p1",
      creatorId: "alice",
      title: "seed",
      description: null,
      statusId: "st-todo",
      priority: "Medium",
      assigneeId: null,
      dueDate: null,
      position: 0,
    });
    const seeded = (await repo.listTasksByProject("p1"))[0]!;
    await repo.updateTask({ taskId: seeded.id, sprintId: "sp-1" });

    const t = await svc(repo).updateTask(act("Owner"), seeded.id, "sprintId", "");
    expect(t.sprintId).toBeNull();

    const lastUpdate = calls.updateTask[calls.updateTask.length - 1] as {
      activity?: { type: string; oldValue: string | null; newValue: string | null };
    };
    expect(lastUpdate.activity?.type).toBe("SprintChanged");
    expect(lastUpdate.activity?.oldValue).toBe("Sprint 1");
    expect(lastUpdate.activity?.newValue).toBeNull();
  });

  it("từ chối gán sprint thuộc project khác (cross-project guard)", async () => {
    const { repo } = makeRepo([
      makeTask({ id: "t1", projectId: "p1", creatorId: "alice", assigneeId: "bob" }),
    ]);

    await expect(
      svc(repo).updateTask(act("Owner"), "t1", "sprintId", "sp-other"),
    ).rejects.toThrow("Sprint not found in this task's project.");
  });

  it("Member (creator) đổi được sprint của task mình (matrix task)", async () => {
    const member = { userId: "carol", workspaceId: WS, role: "Member" as const };
    const { repo } = makeRepo([
      makeTask({ id: "t1", projectId: "p1", creatorId: "carol", assigneeId: "carol" }),
    ]);

    const t = await svc(repo).updateTask(member, "t1", "sprintId", "sp-1");
    expect(t.sprintId).toBe("sp-1");
  });

  it("Member không đổi được sprint của task của người khác", async () => {
    const member = { userId: "carol", workspaceId: WS, role: "Member" as const };
    const { repo } = makeRepo([
      makeTask({ id: "t2", projectId: "p1", creatorId: "alice", assigneeId: "bob" }),
    ]);

    await expect(svc(repo).updateTask(member, "t2", "sprintId", "sp-1")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("listBoard lọc theo sprintId và 'backlog'", async () => {
    const t1 = makeTask({ id: "t1", projectId: "p1", creatorId: "alice" });
    const t2 = makeTask({ id: "t2", projectId: "p1", creatorId: "alice" });
    t2.sprintId = "sp-1";
    const t3 = makeTask({ id: "t3", projectId: "p1", creatorId: "alice" });
    t3.sprintId = "sp-1";
    const { repo, calls } = makeRepo([t1, t2, t3]);

    const inSprint = await svc(repo).listBoard(act("Owner"), "p1", { sprintId: "sp-1" });
    expect(inSprint.map((t) => t.id).sort()).toEqual(["t2", "t3"]);

    const backlog = await svc(repo).listBoard(act("Owner"), "p1", { sprintId: "backlog" });
    expect(backlog.map((t) => t.id)).toEqual(["t1"]);

    const filterPassed = calls.listTasksByProject?.[0] as
      | { filter?: { sprintId?: string } }
      | undefined;
    expect(filterPassed?.filter?.sprintId).toBe("sp-1");
  });

  describe("Sub-tasks & Hierarchical Issues", () => {
    it("Tạo sub-task thành công dưới task cha", async () => {
      const parent = makeTask({ id: "p-1", projectId: "p1", creatorId: "alice" });
      const { repo } = makeRepo([parent]);

      const subtask = await svc(repo).createTask(actor(), "p1", {
        title: "Sub-task 1",
        parentId: "p-1",
      });

      expect(subtask.parentId).toBe("p-1");
      expect(subtask.title).toBe("Sub-task 1");
    });

    it("Sub-task tự động kế thừa sprintId từ task cha", async () => {
      const parent = makeTask({ id: "p-1", projectId: "p1", creatorId: "alice" });
      parent.sprintId = "sp-1";
      const { repo } = makeRepo([parent]);

      const subtask = await svc(repo).createTask(actor(), "p1", {
        title: "Sub-task with sprint",
        parentId: "p-1",
      });

      expect(subtask.parentId).toBe("p-1");
      expect(subtask.sprintId).toBe("sp-1");
    });

    it("Chặn tạo sub-task nếu task cha không tồn tại hoặc khác project", async () => {
      const { repo } = makeRepo([]);

      await expect(
        svc(repo).createTask(actor(), "p1", {
          title: "Orphan subtask",
          parentId: "non-existent",
        }),
      ).rejects.toThrow("Parent task not found or belongs to another project.");
    });

    it("1-Level Depth Guard: Chặn tạo sub-task nếu task cha vốn là một sub-task", async () => {
      const grandParent = makeTask({ id: "gp-1", projectId: "p1", creatorId: "alice" });
      const parent = makeTask({ id: "p-1", projectId: "p1", creatorId: "alice", parentId: "gp-1" });
      const { repo } = makeRepo([grandParent, parent]);

      await expect(
        svc(repo).createTask(actor(), "p1", {
          title: "Deep child subtask",
          parentId: "p-1",
        }),
      ).rejects.toThrow("Subtasks cannot have subtasks (max depth 1).");
    });

    it("listSubtasks trả về danh sách task con của task cha", async () => {
      const parent = makeTask({ id: "p-1", projectId: "p1", creatorId: "alice" });
      const sub1 = makeTask({ id: "s-1", projectId: "p1", creatorId: "alice", parentId: "p-1" });
      const sub2 = makeTask({ id: "s-2", projectId: "p1", creatorId: "alice", parentId: "p-1" });
      const { repo } = makeRepo([parent, sub1, sub2]);

      const list = await svc(repo).listSubtasks(actor(), "p-1");
      expect(list.map((t) => t.id)).toEqual(["s-1", "s-2"]);
    });

    it("toggleSubtaskDone chuyển trạng thái subtask sang Done và ngược lại", async () => {
      const sub = makeTask({ id: "s-1", projectId: "p1", creatorId: "alice", statusId: "st-todo" });
      const { repo } = makeRepo([sub]);

      const doneTask = await svc(repo).toggleSubtaskDone(actor(), "s-1", true);
      expect(doneTask.statusId).toBe("st-done");

      const undoneTask = await svc(repo).toggleSubtaskDone(actor(), "s-1", false);
      expect(undoneTask.statusId).toBe("st-todo");
    });

    it("unlinkSubtask tách subtask thành standalone task", async () => {
      const sub = makeTask({ id: "s-1", projectId: "p1", creatorId: "alice", parentId: "p-1" });
      const { repo } = makeRepo([sub]);

      const unlinked = await svc(repo).unlinkSubtask(actor(), "s-1");
      expect(unlinked.parentId).toBeNull();
    });
  });
});

function actor() {
  return { userId: "alice", workspaceId: WS, role: "Owner" as const };
}
