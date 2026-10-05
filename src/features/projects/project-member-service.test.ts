import { describe, expect, it, vi } from "vitest";

import { UnauthorizedError } from "@/features/authorization/errors";
import type { ProjectActor } from "@/features/authorization/actor";
import type { Role } from "@/features/authorization/permissions";
import {
  createProjectMemberService,
  type ProjectMemberRecord,
  type ProjectMemberRepository,
} from "./project-member-service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const WS_ID = "ws1";
const PROJECT_ID = "proj1";

function makeProjectActor(opts: {
  userId?: string;
  role?: Role;
  projectRole?: Role;
}): ProjectActor {
  return {
    userId: opts.userId ?? "alice",
    workspaceId: WS_ID,
    role: opts.role ?? "Owner",
    projectId: PROJECT_ID,
    projectRole: opts.projectRole ?? opts.role ?? "Owner",
  };
}

function makeMember(userId: string, role: Role): ProjectMemberRecord {
  return { projectId: PROJECT_ID, userId, role };
}

function makeRepo(
  initial: ProjectMemberRecord[] = [],
  overrides: Partial<ProjectMemberRepository> = {},
): ProjectMemberRepository {
  const store: ProjectMemberRecord[] = [...initial];

  return {
    getProjectWorkspaceId: vi.fn(async (projectId) =>
      projectId === PROJECT_ID ? WS_ID : null,
    ),
    getProjectMember: vi.fn(async (projectId, userId) =>
      store.find((m) => m.projectId === projectId && m.userId === userId) ?? null,
    ),
    listProjectMembers: vi.fn(async (projectId) =>
      store.filter((m) => m.projectId === projectId),
    ),
    addProjectMember: vi.fn(async (input) => {
      const record: ProjectMemberRecord = {
        projectId: input.projectId,
        userId: input.userId,
        role: input.role,
      };
      store.push(record);
      return record;
    }),
    changeProjectMemberRole: vi.fn(async (projectId, userId, role) => {
      const m = store.find((x) => x.projectId === projectId && x.userId === userId);
      if (!m) throw new Error("not found");
      m.role = role;
      return m;
    }),
    removeProjectMember: vi.fn(async (projectId, userId) => {
      const i = store.findIndex((x) => x.projectId === projectId && x.userId === userId);
      if (i >= 0) store.splice(i, 1);
    }),
    ...overrides,
  };
}

function svc(repo: ProjectMemberRepository) {
  return createProjectMemberService({ repo });
}

// ─── listMembers ─────────────────────────────────────────────────────────────

describe("listMembers", () => {
  it("mọi projectRole đều xem được danh sách member", async () => {
    const members = [makeMember("alice", "Owner"), makeMember("bob", "Member")];
    const repo = makeRepo(members);

    for (const role of ["Owner", "Admin", "Member"] as const) {
      const actor = makeProjectActor({ projectRole: role });
      const result = await svc(repo).listMembers(actor, PROJECT_ID);
      expect(result).toHaveLength(2);
    }
  });
});

// ─── addMember ───────────────────────────────────────────────────────────────

describe("addMember", () => {
  const workspaceMemberIds = ["alice", "bob", "charlie"];

  it("Owner thêm được member", async () => {
    const repo = makeRepo([makeMember("alice", "Owner")]);
    const actor = makeProjectActor({ userId: "alice", projectRole: "Owner" });
    const result = await svc(repo).addMember(actor, PROJECT_ID, "bob", "Member", workspaceMemberIds);
    expect(result.userId).toBe("bob");
    expect(result.role).toBe("Member");
  });

  it("Admin thêm được member", async () => {
    const repo = makeRepo([makeMember("alice", "Admin")]);
    const actor = makeProjectActor({ userId: "alice", projectRole: "Admin" });
    const result = await svc(repo).addMember(actor, PROJECT_ID, "bob", "Member", workspaceMemberIds);
    expect(result.userId).toBe("bob");
  });

  it("Member bị chặn không thêm được", async () => {
    const repo = makeRepo([makeMember("alice", "Member")]);
    const actor = makeProjectActor({ userId: "alice", projectRole: "Member" });
    await expect(
      svc(repo).addMember(actor, PROJECT_ID, "bob", "Member", workspaceMemberIds),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("target không phải workspace member bị chặn", async () => {
    const repo = makeRepo([makeMember("alice", "Owner")]);
    const actor = makeProjectActor({ userId: "alice", projectRole: "Owner" });
    await expect(
      svc(repo).addMember(actor, PROJECT_ID, "outsider", "Member", workspaceMemberIds),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("thêm trùng bị chặn", async () => {
    const repo = makeRepo([makeMember("alice", "Owner"), makeMember("bob", "Member")]);
    const actor = makeProjectActor({ userId: "alice", projectRole: "Owner" });
    await expect(
      svc(repo).addMember(actor, PROJECT_ID, "bob", "Member", workspaceMemberIds),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

// ─── changeRole ──────────────────────────────────────────────────────────────

describe("changeRole", () => {
  it("Owner đổi được role của member khác", async () => {
    const repo = makeRepo([makeMember("alice", "Owner"), makeMember("bob", "Member")]);
    const actor = makeProjectActor({ userId: "alice", projectRole: "Owner" });
    const result = await svc(repo).changeRole(actor, PROJECT_ID, "bob", "Admin");
    expect(result.role).toBe("Admin");
  });

  it("Admin không đổi được role", async () => {
    const repo = makeRepo([makeMember("alice", "Admin"), makeMember("bob", "Member")]);
    const actor = makeProjectActor({ userId: "alice", projectRole: "Admin" });
    await expect(
      svc(repo).changeRole(actor, PROJECT_ID, "bob", "Owner"),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("Member không đổi được role", async () => {
    const repo = makeRepo([makeMember("alice", "Member"), makeMember("bob", "Member")]);
    const actor = makeProjectActor({ userId: "alice", projectRole: "Member" });
    await expect(
      svc(repo).changeRole(actor, PROJECT_ID, "bob", "Admin"),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("Owner không tự đổi role mình", async () => {
    const repo = makeRepo([makeMember("alice", "Owner")]);
    const actor = makeProjectActor({ userId: "alice", projectRole: "Owner" });
    await expect(
      svc(repo).changeRole(actor, PROJECT_ID, "alice", "Member"),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("target không tồn tại → UnauthorizedError", async () => {
    const repo = makeRepo([makeMember("alice", "Owner")]);
    const actor = makeProjectActor({ userId: "alice", projectRole: "Owner" });
    await expect(
      svc(repo).changeRole(actor, PROJECT_ID, "ghost", "Member"),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

// ─── removeMember ────────────────────────────────────────────────────────────

describe("removeMember", () => {
  it("Owner xoá được Admin", async () => {
    const repo = makeRepo([makeMember("alice", "Owner"), makeMember("bob", "Admin")]);
    const actor = makeProjectActor({ userId: "alice", projectRole: "Owner" });
    await expect(svc(repo).removeMember(actor, PROJECT_ID, "bob")).resolves.toBeUndefined();
  });

  it("Owner xoá được Member", async () => {
    const repo = makeRepo([makeMember("alice", "Owner"), makeMember("bob", "Member")]);
    const actor = makeProjectActor({ userId: "alice", projectRole: "Owner" });
    await expect(svc(repo).removeMember(actor, PROJECT_ID, "bob")).resolves.toBeUndefined();
  });

  it("Admin xoá được Member", async () => {
    const repo = makeRepo([makeMember("alice", "Admin"), makeMember("bob", "Member")]);
    const actor = makeProjectActor({ userId: "alice", projectRole: "Admin" });
    await expect(svc(repo).removeMember(actor, PROJECT_ID, "bob")).resolves.toBeUndefined();
  });

  it("Admin không xoá được Admin khác", async () => {
    const repo = makeRepo([makeMember("alice", "Admin"), makeMember("bob", "Admin")]);
    const actor = makeProjectActor({ userId: "alice", projectRole: "Admin" });
    await expect(
      svc(repo).removeMember(actor, PROJECT_ID, "bob"),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("Admin không xoá được Owner", async () => {
    const repo = makeRepo([makeMember("alice", "Admin"), makeMember("bob", "Owner")]);
    const actor = makeProjectActor({ userId: "alice", projectRole: "Admin" });
    await expect(
      svc(repo).removeMember(actor, PROJECT_ID, "bob"),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("Member không xoá được ai", async () => {
    const repo = makeRepo([makeMember("alice", "Member"), makeMember("bob", "Member")]);
    const actor = makeProjectActor({ userId: "alice", projectRole: "Member" });
    await expect(
      svc(repo).removeMember(actor, PROJECT_ID, "bob"),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("không xoá được Owner (isSelf=false, actor=Owner)", async () => {
    // Owner không tự xoá chính mình (isSelf → false allowed but canRemoveMember returns false for isSelf)
    const repo = makeRepo([makeMember("alice", "Owner")]);
    const actor = makeProjectActor({ userId: "alice", projectRole: "Owner" });
    await expect(
      svc(repo).removeMember(actor, PROJECT_ID, "alice"),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("target không tồn tại → UnauthorizedError", async () => {
    const repo = makeRepo([makeMember("alice", "Owner")]);
    const actor = makeProjectActor({ userId: "alice", projectRole: "Owner" });
    await expect(
      svc(repo).removeMember(actor, PROJECT_ID, "ghost"),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});

// ─── createProjectWithOwner (via service helper) ──────────────────────────────

describe("createProjectWithOwner — project mới có member Owner là creator", () => {
  it("addMember với workspace member ids chứa creator tạo được Owner member", async () => {
    // Simulate: project mới tạo đã có owner từ transaction → chỉ test addMember flow
    const repo = makeRepo([makeMember("creator", "Owner")]);
    const actor = makeProjectActor({ userId: "creator", projectRole: "Owner" });

    // Owner có thể thêm member mới (workspace member)
    const result = await svc(repo).addMember(actor, PROJECT_ID, "bob", "Admin", ["creator", "bob"]);
    expect(result.role).toBe("Admin");
    expect(result.userId).toBe("bob");

    // creator vẫn là Owner
    const members = await svc(repo).listMembers(actor, PROJECT_ID);
    const ownerMember = members.find((m) => m.userId === "creator");
    expect(ownerMember?.role).toBe("Owner");
  });
});

describe("project-scope guards (BR-006/H2)", () => {
  it("từ chối khi projectId khác actor.projectId", async () => {
    const repo = makeRepo([makeMember("alice", "Owner")]);
    const actor = { ...makeProjectActor({ userId: "alice", projectRole: "Owner" }), projectId: "proj-other" };
    await expect(
      svc(repo).addMember(actor, PROJECT_ID, "bob", "Member", ["alice", "bob"]),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("từ chối khi project thuộc workspace khác", async () => {
    const repo = makeRepo([makeMember("alice", "Owner")], {
      getProjectWorkspaceId: vi.fn(async () => "ws-other"),
    });
    const actor = makeProjectActor({ userId: "alice", projectRole: "Owner" });
    await expect(
      svc(repo).changeRole(actor, PROJECT_ID, "bob", "Member"),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
