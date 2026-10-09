import { beforeEach, describe, expect, it, vi } from "vitest";

import { UnauthorizedError } from "@/features/authorization/errors";

const mocks = vi.hoisted(() => ({
  findWorkspaceMember: vi.fn(),
  findProjectMember: vi.fn(),
  findProject: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    workspaceMember: { findUnique: mocks.findWorkspaceMember },
    projectMember: { findUnique: mocks.findProjectMember },
    project: { findUnique: mocks.findProject },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

import { requireProjectActor } from "@/features/workspaces/session";

const USER_ID = "user-h1-test";

function mockSession() {
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
}

describe("requireProjectActor — H1 cross-workspace guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession();
  });

  it("rejects when the project belongs to another workspace (H1)", async () => {
    mocks.findWorkspaceMember.mockResolvedValue({
      userId: USER_ID,
      workspaceId: "ws-A",
      role: "Owner",
    });
    mocks.findProjectMember.mockResolvedValue(null);
    mocks.findProject.mockResolvedValue({ workspaceId: "ws-B" });

    await expect(requireProjectActor("ws-A", "project-x")).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("rejects when the project does not exist", async () => {
    mocks.findWorkspaceMember.mockResolvedValue({
      userId: USER_ID,
      workspaceId: "ws-A",
      role: "Owner",
    });
    mocks.findProjectMember.mockResolvedValue(null);
    mocks.findProject.mockResolvedValue(null);

    await expect(requireProjectActor("ws-A", "missing")).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("rejects workspace non-members even for valid projects", async () => {
    mocks.findWorkspaceMember.mockResolvedValue(null);
    mocks.findProjectMember.mockResolvedValue(null);
    mocks.findProject.mockResolvedValue({ workspaceId: "ws-A" });

    // NOTE: distinct project id per case — requireProjectActor is
    // React.cache()-memoized by arguments.
    await expect(requireProjectActor("ws-A", "project-nonmember")).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("falls back to the workspace role without a project membership row", async () => {
    mocks.findWorkspaceMember.mockResolvedValue({
      userId: USER_ID,
      workspaceId: "ws-A",
      role: "Member",
    });
    mocks.findProjectMember.mockResolvedValue(null);
    mocks.findProject.mockResolvedValue({ workspaceId: "ws-A" });

    const actor = await requireProjectActor("ws-A", "project-y");
    expect(actor.projectId).toBe("project-y");
    expect(actor.projectRole).toBe("Member");
  });

  it("prefers the explicit project membership role", async () => {
    mocks.findWorkspaceMember.mockResolvedValue({
      userId: USER_ID,
      workspaceId: "ws-A",
      role: "Member",
    });
    mocks.findProjectMember.mockResolvedValue({ role: "Admin" });
    mocks.findProject.mockResolvedValue({ workspaceId: "ws-A" });

    const actor = await requireProjectActor("ws-A", "project-z");
    expect(actor.projectRole).toBe("Admin");
  });

  it("keeps workspace Owners as Owners in every project", async () => {
    mocks.findWorkspaceMember.mockResolvedValue({
      userId: USER_ID,
      workspaceId: "ws-A",
      role: "Owner",
    });
    mocks.findProjectMember.mockResolvedValue({ role: "Member" });
    mocks.findProject.mockResolvedValue({ workspaceId: "ws-A" });

    const actor = await requireProjectActor("ws-A", "project-w");
    expect(actor.projectRole).toBe("Owner");
  });
});
