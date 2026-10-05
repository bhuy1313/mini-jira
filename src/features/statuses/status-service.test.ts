import { describe, expect, it, vi } from "vitest";

import type { ProjectActor } from "@/features/authorization/actor";
import {
  createStatusService,
  type StatusRecord,
  type StatusRepository,
} from "./status-service";

function createActor(overrides?: Partial<ProjectActor>): ProjectActor {
  return {
    userId: "user-1",
    workspaceId: "ws-1",
    role: "Owner",
    projectId: "proj-1",
    projectRole: "Owner",
    ...overrides,
  };
}

function createFakeRepo(overrides?: Partial<StatusRepository>): StatusRepository {
  const defaultStatus: StatusRecord = {
    id: "st-1",
    projectId: "proj-1",
    workspaceId: "ws-1",
    name: "To Do",
    position: "1000.00000000000000000000",
    isDefault: true,
    isDone: false,
    createdAt: new Date("2026-01-01"),
  };

  const inProgressStatus: StatusRecord = {
    id: "st-2",
    projectId: "proj-1",
    workspaceId: "ws-1",
    name: "In Progress",
    position: "2000.00000000000000000000",
    isDefault: false,
    isDone: false,
    createdAt: new Date("2026-01-01"),
  };

  const doneStatus: StatusRecord = {
    id: "st-3",
    projectId: "proj-1",
    workspaceId: "ws-1",
    name: "Done",
    position: "3000.00000000000000000000",
    isDefault: false,
    isDone: true,
    createdAt: new Date("2026-01-01"),
  };

  let statuses: StatusRecord[] = [defaultStatus, inProgressStatus, doneStatus];

  return {
    getStatus: vi.fn(async (id) => statuses.find((s) => s.id === id) ?? null),
    getProjectWorkspaceId: vi.fn(async () => "ws-1"),
    listStatusesByProject: vi.fn(async () => [...statuses]),
    createStatus: vi.fn(async (input) => {
      const created: StatusRecord = {
        id: `st-${Date.now()}`,
        projectId: input.projectId,
        workspaceId: "ws-1",
        name: input.name,
        position: input.position,
        isDefault: input.isDefault ?? false,
        isDone: input.isDone ?? false,
        createdAt: new Date(),
      };
      statuses.push(created);
      return created;
    }),
    updateStatus: vi.fn(async (input) => {
      const idx = statuses.findIndex((s) => s.id === input.statusId);
      if (idx === -1) throw new Error("Not found");
      statuses[idx] = {
        ...statuses[idx],
        ...(input.name ? { name: input.name } : {}),
        ...(input.position ? { position: input.position } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        ...(input.isDone !== undefined ? { isDone: input.isDone } : {}),
      };
      return statuses[idx];
    }),
    deleteStatus: vi.fn(async (id) => {
      statuses = statuses.filter((s) => s.id !== id);
    }),
    countTasksInStatus: vi.fn(async () => 0),
    countStatusesInProject: vi.fn(async () => statuses.length),
    getDefaultStatus: vi.fn(async () => statuses.find((s) => s.isDefault) ?? statuses[0] ?? null),
    reorderStatuses: vi.fn(async (items) => {
      for (const item of items) {
        const s = statuses.find((st) => st.id === item.id);
        if (s) s.position = item.position;
      }
    }),
    ...overrides,
  };
}

describe("status-service", () => {
  it("allows all project members to list statuses in position order", async () => {
    const repo = createFakeRepo();
    const service = createStatusService(repo);
    const actor = createActor({ projectRole: "Member" });

    const result = await service.listStatuses(actor, "proj-1");
    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("To Do");
    expect(result[1].name).toBe("In Progress");
    expect(result[2].name).toBe("Done");
  });

  it("throws NotFoundError if project does not belong to workspace", async () => {
    const repo = createFakeRepo({
      getProjectWorkspaceId: vi.fn(async () => "ws-other"),
    });
    const service = createStatusService(repo);
    const actor = createActor();

    await expect(service.listStatuses(actor, "proj-1")).rejects.toThrow("Project not found in this workspace.");
  });

  it("allows Owner and Admin to create a new custom status", async () => {
    const repo = createFakeRepo();
    const service = createStatusService(repo);
    const actor = createActor({ projectRole: "Owner" });

    const created = await service.createStatus(actor, { name: "In Review" });
    expect(created.name).toBe("In Review");
    expect(created.position).toBe("4000.00000000000000000000");

    const adminActor = createActor({ projectRole: "Admin" });
    const createdByAdmin = await service.createStatus(adminActor, { name: "Testing" });
    expect(createdByAdmin.name).toBe("Testing");
  });

  it("denies Member from creating a status", async () => {
    const repo = createFakeRepo();
    const service = createStatusService(repo);
    const actor = createActor({ projectRole: "Member" });

    await expect(service.createStatus(actor, { name: "In Review" })).rejects.toThrow(
      "Only project Owner or Admin can manage statuses.",
    );
  });

  it("validates status name constraints (length and duplicates)", async () => {
    const repo = createFakeRepo();
    const service = createStatusService(repo);
    const actor = createActor();

    await expect(service.createStatus(actor, { name: "   " })).rejects.toThrow(
      "Status name must be between 1 and 50 characters.",
    );
    await expect(service.createStatus(actor, { name: "to do" })).rejects.toThrow(
      'Status "to do" already exists in this project.',
    );
  });

  it("allows Owner and Admin to update a status name", async () => {
    const repo = createFakeRepo();
    const service = createStatusService(repo);
    const actor = createActor({ projectRole: "Owner" });

    const updated = await service.updateStatus(actor, "st-2", { name: "In Dev" });
    expect(updated.name).toBe("In Dev");
  });

  it("blocks deleting the only remaining status in a project", async () => {
    const repo = createFakeRepo({
      countStatusesInProject: vi.fn(async () => 1),
    });
    const service = createStatusService(repo);
    const actor = createActor();

    await expect(service.deleteStatus(actor, "st-1")).rejects.toThrow(
      "Cannot delete the only status in a project.",
    );
  });

  it("blocks deleting a status that currently contains tasks", async () => {
    const repo = createFakeRepo({
      countTasksInStatus: vi.fn(async () => 5),
    });
    const service = createStatusService(repo);
    const actor = createActor();

    await expect(service.deleteStatus(actor, "st-1")).rejects.toThrow(
      'Cannot delete status "To Do" because it contains 5 task(s). Move them first.',
    );
  });

  it("allows deleting an empty status when other statuses exist", async () => {
    const repo = createFakeRepo();
    const service = createStatusService(repo);
    const actor = createActor();

    await service.deleteStatus(actor, "st-3");
    expect(repo.deleteStatus).toHaveBeenCalledWith("st-3");
  });

  it("allows reordering statuses", async () => {
    const repo = createFakeRepo();
    const service = createStatusService(repo);
    const actor = createActor();

    await service.reorderStatuses(actor, ["st-3", "st-1", "st-2"]);
    expect(repo.reorderStatuses).toHaveBeenCalledWith([
      { id: "st-3", position: "1000.00000000000000000000" },
      { id: "st-1", position: "2000.00000000000000000000" },
      { id: "st-2", position: "3000.00000000000000000000" },
    ]);
  });

  it("toggles isDone flag on a status (Mốc 15 — sprint progress)", async () => {
    const repo = createFakeRepo();
    const service = createStatusService(repo);
    const actor = createActor({ projectRole: "Owner" });

    const updated = await service.updateStatus(actor, "st-1", { isDone: true });
    expect(updated.isDone).toBe(true);

    const reverted = await service.updateStatus(actor, "st-1", { isDone: false });
    expect(reverted.isDone).toBe(false);
  });

  it("creates a status with isDone when specified", async () => {
    const repo = createFakeRepo();
    const service = createStatusService(repo);
    const actor = createActor();

    const created = await service.createStatus(actor, { name: "Shipped", isDone: true });
    expect(created.isDone).toBe(true);
  });

  it("denies Member from toggling isDone", async () => {
    const repo = createFakeRepo();
    const service = createStatusService(repo);
    const actor = createActor({ projectRole: "Member" });

    await expect(service.updateStatus(actor, "st-1", { isDone: true })).rejects.toThrow(
      "Only project Owner or Admin can manage statuses.",
    );
  });
});
