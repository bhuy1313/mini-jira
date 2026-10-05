import { describe, expect, it, vi } from "vitest";

import type { ProjectActor } from "@/features/authorization/actor";
import {
  createSprintService,
  type SprintRecord,
  type SprintRepository,
} from "./sprint-service";

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

function createFakeRepo(overrides?: Partial<SprintRepository>): SprintRepository {
  const sprint1: SprintRecord = {
    id: "sp-1",
    projectId: "proj-1",
    workspaceId: "ws-1",
    name: "Sprint 1",
    goal: "Ship Mốc 15",
    startDate: new Date("2026-09-01"),
    endDate: new Date("2026-09-14"),
    position: "1000.00000000000000000000",
    createdAt: new Date("2026-09-01"),
  };

  const sprint2: SprintRecord = {
    id: "sp-2",
    projectId: "proj-1",
    workspaceId: "ws-1",
    name: "Sprint 2",
    goal: null,
    startDate: null,
    endDate: null,
    position: "2000.00000000000000000000",
    createdAt: new Date("2026-09-15"),
  };

  let sprints: SprintRecord[] = [sprint1, sprint2];

  return {
    getSprint: vi.fn(async (id) => sprints.find((s) => s.id === id) ?? null),
    getProjectWorkspaceId: vi.fn(async () => "ws-1"),
    getSprintProjectId: vi.fn(async (id) =>
      sprints.find((s) => s.id === id)?.projectId ?? null,
    ),
    listSprintsByProject: vi.fn(async () => [...sprints]),
    createSprint: vi.fn(async (input) => {
      const created: SprintRecord = {
        id: `sp-${sprints.length + 1}`,
        projectId: input.projectId,
        workspaceId: "ws-1",
        name: input.name,
        goal: input.goal,
        startDate: input.startDate,
        endDate: input.endDate,
        position: input.position,
        createdAt: new Date(),
      };
      sprints.push(created);
      return created;
    }),
    updateSprint: vi.fn(async (input) => {
      const idx = sprints.findIndex((s) => s.id === input.sprintId);
      if (idx === -1) throw new Error("Not found");
      sprints[idx] = { ...sprints[idx]!, ...input };
      return sprints[idx]!;
    }),
    deleteSprint: vi.fn(async (id) => {
      sprints = sprints.filter((s) => s.id !== id);
    }),
    countTasksBySprint: vi.fn(async () => ({ backlog: 2, "sp-1": 3 })),
    countDoneTasksBySprint: vi.fn(async () => ({ "sp-1": 1 })),
    reorderSprints: vi.fn(async (items) => {
      for (const item of items) {
        const s = sprints.find((sp) => sp.id === item.id);
        if (s) s.position = item.position;
      }
    }),
    ...overrides,
  };
}

describe("sprint-service", () => {
  it("allows all project members to list sprints in position order", async () => {
    const repo = createFakeRepo();
    const service = createSprintService(repo);
    const actor = createActor({ projectRole: "Member" });

    const result = await service.listSprints(actor, "proj-1");
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Sprint 1");
    expect(result[1].name).toBe("Sprint 2");
  });

  it("throws if project does not belong to workspace", async () => {
    const repo = createFakeRepo({
      getProjectWorkspaceId: vi.fn(async () => "ws-other"),
    });
    const service = createSprintService(repo);
    const actor = createActor();

    await expect(service.listSprints(actor, "proj-1")).rejects.toThrow(
      "Project not found in this workspace.",
    );
  });

  it("allows Owner and Admin to create a sprint with fractional position", async () => {
    const repo = createFakeRepo();
    const service = createSprintService(repo);

    const created = await service.createSprint(createActor({ projectRole: "Owner" }), {
      name: "Sprint 3",
      goal: "Finish analytics",
    });
    expect(created.name).toBe("Sprint 3");
    expect(Number(created.position)).toBe(3000);

    const byAdmin = await service.createSprint(createActor({ projectRole: "Admin" }), {
      name: "Sprint 4",
    });
    expect(byAdmin.name).toBe("Sprint 4");
    expect(Number(byAdmin.position)).toBe(4000);
  });

  it("uses position 1000 for the very first sprint in a project", async () => {
    const repo = createFakeRepo({ listSprintsByProject: vi.fn(async () => []) });
    const service = createSprintService(repo);
    const actor = createActor();

    const created = await service.createSprint(actor, { name: "First" });
    expect(created.position).toBe("1000.00000000000000000000");
  });

  it("denies Member from creating a sprint", async () => {
    const repo = createFakeRepo();
    const service = createSprintService(repo);
    const actor = createActor({ projectRole: "Member" });

    await expect(service.createSprint(actor, { name: "Sprint X" })).rejects.toThrow(
      "Only project Owner or Admin can manage sprints.",
    );
  });

  it("validates sprint name constraints (length and duplicate)", async () => {
    const repo = createFakeRepo();
    const service = createSprintService(repo);
    const actor = createActor();

    await expect(service.createSprint(actor, { name: "   " })).rejects.toThrow(
      "Sprint name must be between 1 and 100 characters.",
    );
    await expect(service.createSprint(actor, { name: "sprint 1" })).rejects.toThrow(
      'Sprint "sprint 1" already exists in this project.',
    );
  });

  it("validates endDate >= startDate (BR)", async () => {
    const repo = createFakeRepo();
    const service = createSprintService(repo);
    const actor = createActor();

    await expect(
      service.createSprint(actor, {
        name: "Bad dates",
        startDate: new Date("2026-09-14"),
        endDate: new Date("2026-09-01"),
      }),
    ).rejects.toThrow("Sprint end date must be on or after the start date.");
  });

  it("allows Owner to update sprint name and dates", async () => {
    const repo = createFakeRepo();
    const service = createSprintService(repo);
    const actor = createActor({ projectRole: "Owner" });

    const updated = await service.updateSprint(actor, "sp-2", {
      name: "Sprint 2 (rev)",
      startDate: new Date("2026-10-01"),
      endDate: new Date("2026-10-14"),
    });
    expect(updated.name).toBe("Sprint 2 (rev)");
    expect(updated.endDate?.toISOString()).toBe(new Date("2026-10-14").toISOString());
  });

  it("cannot rename a sprint to another sprint's name", async () => {
    const repo = createFakeRepo();
    const service = createSprintService(repo);
    const actor = createActor();

    await expect(service.updateSprint(actor, "sp-2", { name: "Sprint 1" })).rejects.toThrow(
      'Sprint "Sprint 1" already exists in this project.',
    );
  });

  it("throws when updating a sprint from another project", async () => {
    const repo = createFakeRepo({
      getSprint: vi.fn(async () => ({
        id: "sp-other",
        projectId: "proj-2",
        workspaceId: "ws-1",
        name: "Other",
        goal: null,
        startDate: null,
        endDate: null,
        position: "1000",
        createdAt: new Date(),
      })),
    });
    const service = createSprintService(repo);
    const actor = createActor();

    await expect(service.updateSprint(actor, "sp-other", { name: "Hacked" })).rejects.toThrow(
      "Sprint not found in this project.",
    );
  });

  it("denies Member from deleting a sprint", async () => {
    const repo = createFakeRepo();
    const service = createSprintService(repo);
    const actor = createActor({ projectRole: "Member" });

    await expect(service.deleteSprint(actor, "sp-1")).rejects.toThrow(
      "Only project Owner or Admin can manage sprints.",
    );
  });

  it("deletes a sprint (tasks fall back to backlog via SetNull)", async () => {
    const repo = createFakeRepo();
    const service = createSprintService(repo);
    const actor = createActor();

    await service.deleteSprint(actor, "sp-2");
    expect(repo.deleteSprint).toHaveBeenCalledWith("sp-2");

    const remaining = await service.listSprints(actor, "proj-1");
    expect(remaining.map((s) => s.id)).toEqual(["sp-1"]);
  });

  it("requires all sprint IDs for reorder and rejects foreign IDs", async () => {
    const repo = createFakeRepo();
    const service = createSprintService(repo);
    const actor = createActor();

    await expect(service.reorderSprints(actor, ["sp-1"])).rejects.toThrow(
      "Must provide all sprint IDs to reorder.",
    );
    await expect(
      service.reorderSprints(actor, ["sp-1", "sp-9"]),
    ).rejects.toThrow("Sprint sp-9 does not belong to this project.");
  });

  it("reorders sprints with sequential fractional positions", async () => {
    const repo = createFakeRepo();
    const service = createSprintService(repo);
    const actor = createActor();

    await service.reorderSprints(actor, ["sp-2", "sp-1"]);
    expect(repo.reorderSprints).toHaveBeenCalledWith([
      { id: "sp-2", position: "1000.00000000000000000000" },
      { id: "sp-1", position: "2000.00000000000000000000" },
    ]);
  });
});