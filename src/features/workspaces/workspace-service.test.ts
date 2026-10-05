import { describe, expect, it, vi } from "vitest";

import type { Membership } from "@/features/authorization/actor";
import { UnauthorizedError } from "@/features/authorization/errors";
import type {
  CreateNotificationInput,
  NotificationPublisher,
} from "@/features/notifications/notification-service";
import {
  createWorkspaceService,
  type MemberRecord,
  type WorkspaceRecord,
  type WorkspaceRepository,
} from "./workspace-service";

const actor = {
  userId: "alice",
  workspaceId: "ws1",
  role: "Owner" as const,
};

const aliceMembership: Membership = { userId: "alice", workspaceId: "ws1", role: "Owner" };

function makeRepo(overrides: Partial<WorkspaceRepository> = {}): { repo: WorkspaceRepository; calls: { [k: string]: unknown[] } } {
  const members: MemberRecord[] = [
    { userId: "alice", role: "Owner" },
    { userId: "bob", role: "Member" },
  ];
  const records: WorkspaceRecord[] = [{ id: "ws1", name: "Alpha", description: null }];
  const calls: { [k: string]: unknown[] } = {};

  function track(name: string, args: unknown) {
    (calls[name] ??= []).push(args);
  }

  const repo: WorkspaceRepository = {
    listWorkspacesForUser: vi.fn(async (userId) =>
      userId === "alice" ? records.filter((record) => record.id === "ws1") : [],
    ),
    getWorkspace: vi.fn(async (workspaceId) => records.find((r) => r.id === workspaceId) ?? null),
    getMembership: vi.fn(async (userId, workspaceId) =>
      userId === "alice" && workspaceId === "ws1" ? aliceMembership : null,
    ),
    listMembers: vi.fn(async () => [...members]),
    listMembersWithUsers: vi.fn(async () =>
      members.map((m) => ({ ...m, name: m.userId, email: `${m.userId}@example.com` })),
    ),
    createWorkspaceWithOwner: vi.fn(async ({ name, description, ownerUserId }) => {
      track("createWorkspaceWithOwner", { name, description, ownerUserId });
      return { id: "ws_new", name, description };
    }),
    addMember: vi.fn(async ({ workspaceId, userId, role }) => {
      track("addMember", { workspaceId, userId, role });
      members.push({ userId, role });
      return { userId, role };
    }),
    changeMemberRole: vi.fn(async ({ workspaceId, userId, role }) => {
      track("changeMemberRole", { workspaceId, userId, role });
      const m = members.find((x) => x.userId === userId);
      if (m) m.role = role;
      return { userId, role };
    }),
    removeMember: vi.fn(async ({ workspaceId, userId }) => {
      track("removeMember", { workspaceId, userId });
      const i = members.findIndex((m) => m.userId === userId);
      if (i >= 0) members.splice(i, 1);
    }),
    updateWorkspace: vi.fn(async ({ workspaceId, name, description }) => {
      track("updateWorkspace", { workspaceId, name, description });
      const r = records.find((x) => x.id === workspaceId);
      if (!r) throw new Error("missing");
      if (name !== undefined) r.name = name;
      if (description !== undefined) r.description = description;
      return r;
    }),
    deleteWorkspace: vi.fn(async (workspaceId) => {
      track("deleteWorkspace", { workspaceId });
    }),
    ...overrides,
  };
  return { repo, calls };
}

describe("Workspace service — authorization được thực thi ở mọi thao tác", () => {
  it("getWorkspace chỉ thành viên xem được; workspaceId lấy từ actor", async () => {
    const { repo } = makeRepo(); // alice là member
    const svc = createWorkspaceService({ repo });
    const ws = await svc.getWorkspace(actor);
    expect(ws.id).toBe("ws1");
  });

  it("getWorkspace của người không phải member bị chặn (nếu có thể gọi với workspaceId lạ)", async () => {
    const { repo } = makeRepo({
      getMembership: vi.fn(async () => null),
    });
    const svc = createWorkspaceService({ repo });
    await expect(svc.getWorkspace(actor)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("createWorkspace tạo Owner là creator (FR-014) trong cùng repo call", async () => {
    const { repo, calls } = makeRepo();
    const svc = createWorkspaceService({ repo });
    const ws = await svc.createWorkspace({ userId: "alice" }, { name: "Beta" });
    expect(ws.name).toBe("Beta");
    expect(calls.createWorkspaceWithOwner).toHaveLength(1);
    expect(calls.createWorkspaceWithOwner[0]).toMatchObject({ ownerUserId: "alice", name: "Beta", description: null });
  });

  it("updateWorkspace — chỉ Owner; Admin bị từ chối trước khi chạm repo", async () => {
    const { repo } = makeRepo();
    const svc = createWorkspaceService({ repo });
    await expect(
      svc.updateWorkspace({ ...actor, role: "Admin" }, { name: "X" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(
      svc.updateWorkspace({ ...actor, role: "Member" }, { name: "X" }),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("updateWorkspace — Owner sửa được name", async () => {
    const { repo } = makeRepo();
    const svc = createWorkspaceService({ repo });
    const updated = await svc.updateWorkspace(actor, { name: "Alpha 2" });
    expect(updated.name).toBe("Alpha 2");
  });

  it("deleteWorkspace — chỉ Owner; Admin bị từ chối", async () => {
    const { repo } = makeRepo();
    const svc = createWorkspaceService({ repo });
    await expect(svc.deleteWorkspace({ ...actor, role: "Admin" })).rejects.toBeInstanceOf(UnauthorizedError);
    await expect(svc.deleteWorkspace(actor)).resolves.toBeUndefined();
  });
});

describe("Workspace service — membership", () => {
  it("addMember: Owner/Admin thêm được; Member bị chặn", async () => {
    const { repo, calls } = makeRepo();
    const svc = createWorkspaceService({ repo });
    await expect(svc.addMember({ ...actor, role: "Member" }, "carol", "Member")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    await svc.addMember(actor, "carol", "Member");
    expect(calls.addMember).toHaveLength(1);
  });

  it("addMember: chặn membership trùng (BR-002)", async () => {
    const { repo } = makeRepo();
    const svc = createWorkspaceService({ repo });
    await expect(svc.addMember(actor, "bob", "Member")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("addMember: không thể thêm Owner thứ hai (BR-001)", async () => {
    const { repo } = makeRepo();
    const svc = createWorkspaceService({ repo });
    await expect(svc.addMember(actor, "carol", "Owner")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("changeMemberRole: chỉ Owner; danh sách có bob Member → chuyển bob thành Admin hợp lệ", async () => {
    const { repo, calls } = makeRepo();
    const svc = createWorkspaceService({ repo });
    await expect(svc.changeMemberRole({ ...actor, role: "Member" }, "bob", "Admin")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    const updated = await svc.changeMemberRole(actor, "bob", "Admin");
    expect(updated.role).toBe("Admin");
    expect(calls.changeMemberRole).toHaveLength(1);
  });

  it("changeMemberRole: Owner tạo ra 2 Owner bị chặn (BR-001)", async () => {
    const { repo } = makeRepo();
    const svc = createWorkspaceService({ repo });
    // workspace có 1 Owner (alice); chuyển bob lên Owner → 2 Owner, bị chặn
    await expect(svc.changeMemberRole(actor, "bob", "Owner")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("removeMember: Owner không tự xoá và không thể để 0 Owner (BR-001)", async () => {
    const { repo } = makeRepo();
    const svc = createWorkspaceService({ repo });
    await expect(svc.removeMember(actor, "alice")).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("removeMember: Owner gỡ Member hợp lệ", async () => {
    const { repo, calls } = makeRepo();
    const svc = createWorkspaceService({ repo });
    await svc.removeMember(actor, "bob");
    expect(calls.removeMember).toHaveLength(1);
    expect(calls.removeMember[0]).toMatchObject({ workspaceId: "ws1", userId: "bob" });
  });

  it("removeMember: Admin chỉ gỡ được Member", async () => {
    const { repo } = makeRepo();
    const svc = createWorkspaceService({ repo });
    const adminActor = { ...actor, role: "Admin" as const };
    await svc.removeMember(adminActor, "bob"); // Admin gỡ Member OK
    await expect(svc.removeMember(adminActor, "alice")).rejects.toBeInstanceOf(UnauthorizedError); // Admin không gỡ Owner
  });
});

describe("Workspace service — WorkspaceInvited notifications (Mốc 13)", () => {
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

  it("addMember → gửi WorkspaceInvited cho member mới", async () => {
    const { repo } = makeRepo();
    const { publisher, sent } = makePublisher();
    const svc = createWorkspaceService({ repo, notifications: publisher });

    await svc.addMember(actor, "carol", "Member");

    expect(publisher.notify).toHaveBeenCalledTimes(1);
    expect(sent[0]).toMatchObject({
      userId: "carol",
      type: "WorkspaceInvited",
      payload: { workspaceId: "ws1", workspaceName: "Alpha" },
    });
  });

  it("addMember bị chặn (Member role) → không gửi notification", async () => {
    const { repo } = makeRepo();
    const { publisher, sent } = makePublisher();
    const svc = createWorkspaceService({ repo, notifications: publisher });

    await expect(svc.addMember({ ...actor, role: "Member" }, "carol", "Member")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(sent).toHaveLength(0);
  });
});
