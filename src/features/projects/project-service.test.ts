import { describe, expect, it, vi } from "vitest";

import { UnauthorizedError } from "@/features/authorization/errors";
import type { Role } from "@/features/authorization/permissions";
import type { ProjectActor } from "@/features/authorization/actor";
import type {
  CreateNotificationInput,
  NotificationPublisher,
} from "@/features/notifications/notification-service";
import {
  createProjectService,
  type ProjectRecord,
  type ProjectRepository,
} from "./project-service";

const actor = {
  userId: "alice",
  workspaceId: "ws1",
  role: "Owner" as const,
};

const active: ProjectRecord = {
  id: "p1",
  name: "Website",
  description: null,
  archivedAt: null,
  workspaceId: "ws1",
};
const archived: ProjectRecord = {
  id: "p2",
  name: "Legacy",
  description: null,
  archivedAt: new Date("2026-01-01T00:00:00Z"),
  workspaceId: "ws1",
};
const otherWs: ProjectRecord = {
  id: "p9",
  name: "Other",
  description: null,
  archivedAt: null,
  workspaceId: "ws9",
};

function makeRepo(overrides: Partial<ProjectRepository> = {}): { repo: ProjectRepository; calls: { [k: string]: unknown[] } } {
  const records: ProjectRecord[] = [
    { ...active, archivedAt: null },
    { ...archived, archivedAt: new Date(archived.archivedAt as Date) },
    { ...otherWs, archivedAt: null },
  ];
  const calls: { [k: string]: unknown[] } = {};
  function track(name: string, args: unknown) {
    (calls[name] ??= []).push(args);
  }

  const repo: ProjectRepository = {
    listActiveProjects: vi.fn(async (workspaceId) =>
      records.filter((r) => r.workspaceId === workspaceId && r.archivedAt === null),
    ),
    listArchivedProjects: vi.fn(async (workspaceId) =>
      records.filter((r) => r.workspaceId === workspaceId && r.archivedAt !== null),
    ),
    getProject: vi.fn(async (projectId) => records.find((r) => r.id === projectId) ?? null),
    createProject: vi.fn(async ({ workspaceId, name, description }) => {
      track("createProject", { workspaceId, name, description });
      return { id: "p_new", name, description, archivedAt: null, workspaceId };
    }),
    updateProject: vi.fn(async ({ projectId, name, description }) => {
      track("updateProject", { projectId, name, description });
      const r = records.find((x) => x.id === projectId);
      if (!r) throw new Error("missing");
      if (name !== undefined) r.name = name;
      if (description !== undefined) r.description = description;
      return r;
    }),
    setProjectArchived: vi.fn(async ({ projectId, archivedAt }) => {
      track("setProjectArchived", { projectId, archivedAt });
      const r = records.find((x) => x.id === projectId);
      if (!r) throw new Error("missing");
      r.archivedAt = archivedAt;
      return r;
    }),
    deleteProject: vi.fn(async (projectId) => {
      track("deleteProject", { projectId });
      const i = records.findIndex((x) => x.id === projectId);
      if (i >= 0) records.splice(i, 1);
    }),
    createProjectWithOwner: vi.fn(async ({ workspaceId, name, description, creatorId }) => {
      track("createProjectWithOwner", { workspaceId, name, description, creatorId });
      const p = { id: "p_new_owned", name, description, archivedAt: null, workspaceId };
      records.push(p);
      return p;
    }),
    listWorkspaceMemberIds: vi.fn(async (_workspaceId) => ["alice", "bob"]),
    ...overrides,
  };
  return { repo, calls };
}

function svc(repo: ProjectRepository) {
  return createProjectService({ repo });
}

function act(role: Role) {
  return { ...actor, role };
}

function projectActor(overrides: Partial<ProjectActor>): ProjectActor {
  return {
    userId: "alice",
    workspaceId: "ws1",
    role: "Admin",
    projectId: "p1",
    projectRole: "Member",
    ...overrides,
  };
}

describe("Project service — xem project", () => {
  it("mọi member xem được danh sách active (FR-031)", async () => {
    const { repo } = makeRepo();
    for (const role of ["Owner", "Admin", "Member"] as const) {
      const list = await svc(repo).listProjects(act(role));
      expect(list.map((p) => p.id)).toEqual(["p1"]);
    }
  });

  it("mọi member xem được project detail (FR-032)", async () => {
    const { repo } = makeRepo();
    const got = await svc(repo).getProject(act("Member"), "p1");
    expect(got.id).toBe("p1");
  });

  it("project của workspace khác không xem được (cross-workspace bị chặn)", async () => {
    const { repo } = makeRepo();
    await expect(svc(repo).getProject(actor, "p9")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("project không tồn tại → UnauthorizedError", async () => {
    const { repo } = makeRepo();
    await expect(svc(repo).getProject(actor, "missing")).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("Project service — tạo / sửa (Owner/Admin, không Member)", () => {
  it("Owner và Admin tạo được project (FR-030)", async () => {
    const { repo, calls } = makeRepo();
    for (const role of ["Owner", "Admin"] as const) {
      const created = await svc(repo).createProject(act(role), { name: "New", description: null });
      expect(created.name).toBe("New");
      expect(created.workspaceId).toBe("ws1");
    }
    expect(calls.createProject).toHaveLength(2);
  });

  it("Member bị từ chối tạo project trước khi chạm repo", async () => {
    const { repo } = makeRepo();
    await expect(svc(repo).createProject(act("Member"), { name: "X" })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("Owner/Admin sửa được name/description (FR-033)", async () => {
    const { repo } = makeRepo();
    const updated = await svc(repo).updateProject(act("Admin"), "p1", { name: "Website 2" });
    expect(updated.name).toBe("Website 2");
  });

  it("Member bị từ chối sửa project", async () => {
    const { repo } = makeRepo();
    await expect(svc(repo).updateProject(act("Member"), "p1", { name: "X" })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});

describe("Project service — archive / restore (Owner/Admin)", () => {
  it("Owner/Admin archive được project; Member thì không (FR-034)", async () => {
    const { repo } = makeRepo();
    for (const role of ["Owner", "Admin"] as const) {
      const archivedP = await svc(repo).archiveProject(act(role), "p1");
      expect(archivedP.archivedAt).not.toBeNull();
    }
    await expect(svc(repo).archiveProject(act("Member"), "p1")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("archive chỉ đặt archivedAt — dữ liệu task giữ nguyên (BR-012)", async () => {
    const { repo, calls } = makeRepo();
    await svc(repo).archiveProject(actor, "p1");
    expect(calls.setProjectArchived[0]).toMatchObject({ projectId: "p1" });
  });

  it("restore được project đã archive (FR-035)", async () => {
    const { repo } = makeRepo();
    const restored = await svc(repo).restoreProject(actor, "p2");
    expect(restored.archivedAt).toBeNull();
  });

  it("restore project active → UnauthorizedError", async () => {
    const { repo } = makeRepo();
    await expect(svc(repo).restoreProject(actor, "p1")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("Member bị từ chối restore", async () => {
    const { repo } = makeRepo();
    await expect(svc(repo).restoreProject(act("Member"), "p2")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });
});

describe("Project service — permanent delete (chỉ Owner)", () => {
  it("Owner xoá vĩnh viễn được (FR-036)", async () => {
    const { repo, calls } = makeRepo();
    await svc(repo).deleteProjectPermanently(actor, "p1");
    expect(calls.deleteProject).toHaveLength(1);
  });

  it("Admin tuyệt đối không xoá vĩnh viễn được (BR-013)", async () => {
    const { repo, calls } = makeRepo();
    await expect(svc(repo).deleteProjectPermanently(act("Admin"), "p1")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(calls.deleteProject ?? []).toHaveLength(0);
  });

  it("Member bị từ chối", async () => {
    const { repo } = makeRepo();
    await expect(svc(repo).deleteProjectPermanently(act("Member"), "p1")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("không thể xoá project của workspace khác", async () => {
    const { repo, calls } = makeRepo();
    await expect(svc(repo).deleteProjectPermanently(actor, "p9")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(calls.deleteProject ?? []).toHaveLength(0);
  });
});

describe("Project service — createProjectWithMember (Mốc 11)", () => {
  it("Owner/Admin tạo project và trở thành Owner (gọi createProjectWithOwner)", async () => {
    for (const role of ["Owner", "Admin"] as const) {
      const { repo, calls } = makeRepo();
      const created = await svc(repo).createProjectWithMember(act(role), { name: "New" });
      expect(created.name).toBe("New");
      expect(calls.createProjectWithOwner).toBeDefined();
      expect(calls.createProjectWithOwner[0]).toMatchObject({
        workspaceId: "ws1",
        creatorId: "alice",
        name: "New",
      });
    }
  });

  it("Member bị từ chối tạo project với member (FR-030)", async () => {
    const { repo } = makeRepo();
    await expect(
      svc(repo).createProjectWithMember(act("Member"), { name: "X" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

describe("Project service — ProjectActor threading (Mốc 11)", () => {
  it("Admin workspace nhưng project Member KHÔNG sửa/archive/xoá project (effectiveRole)", async () => {
    const { repo, calls } = makeRepo();
    const restrictedAdmin = projectActor({ role: "Admin", projectRole: "Member" });

    await expect(svc(repo).updateProject(restrictedAdmin, "p1", { name: "X" })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(svc(repo).archiveProject(restrictedAdmin, "p1")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await expect(svc(repo).deleteProjectPermanently(restrictedAdmin, "p1")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(calls.updateProject ?? []).toHaveLength(0);
    expect(calls.setProjectArchived ?? []).toHaveLength(0);
    expect(calls.deleteProject ?? []).toHaveLength(0);
  });

  it("ProjectActor với projectRole Owner xoá vĩnh viễn được project (effectiveRole)", async () => {
    const { repo, calls } = makeRepo();
    const projectOwner = projectActor({ role: "Member", projectRole: "Owner", projectId: "p1" });
    await svc(repo).deleteProjectPermanently(projectOwner, "p1");
    expect(calls.deleteProject ?? []).toHaveLength(1);
  });

  it("Member workspace nhưng projectRole Admin (elevate) được sửa project", async () => {
    const { repo } = makeRepo();
    const elevated = projectActor({ role: "Member", projectRole: "Admin", projectId: "p1" });
    const updated = await svc(repo).updateProject(elevated, "p1", { name: "Website 2" });
    expect(updated.name).toBe("Website 2");
  });

  it("chặn ProjectActor thao tác project khác với actor.projectId (scope)", async () => {
    const { repo, calls } = makeRepo();
    // actor thuộc p1 nhưng cố gắng sửa p2 (cùng workspace)
    const actorOnP1 = projectActor({ role: "Owner", projectRole: "Owner", projectId: "p1" });
    await expect(svc(repo).updateProject(actorOnP1, "p2", { name: "X" })).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(calls.updateProject ?? []).toHaveLength(0);
  });
});

describe("Project service — ProjectArchived notifications (Mốc 13)", () => {
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

  it("archive project → gửi ProjectArchived cho mọi member, loại chính actor", async () => {
    const { repo } = makeRepo();
    const { publisher, sent } = makePublisher();
    const service = createProjectService({ repo, notifications: publisher });

    // listWorkspaceMemberIds trả ["alice","bob"]; actor = alice
    await service.archiveProject(actor, "p1");

    expect(publisher.notify).toHaveBeenCalledTimes(1);
    expect(sent[0]).toMatchObject({
      userId: "bob",
      type: "ProjectArchived",
      payload: { projectId: "p1", projectName: "Website", workspaceId: "ws1" },
    });
  });

  it("không gửi notification cho chính actor khi archive", async () => {
    const { repo } = makeRepo();
    const { publisher, sent } = makePublisher();
    const service = createProjectService({ repo, notifications: publisher });

    await service.archiveProject(actor, "p1");
    expect(sent.every((n) => n.userId !== "alice")).toBe(true);
  });

  it("Member bị chặn archive → không gửi notification (không lộ thông tin)", async () => {
    const { repo } = makeRepo();
    const { publisher, sent } = makePublisher();
    const service = createProjectService({ repo, notifications: publisher });

    await expect(service.archiveProject(act("Member"), "p1")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(sent).toHaveLength(0);
  });
});
