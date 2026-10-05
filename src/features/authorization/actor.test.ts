import { describe, expect, it } from "vitest";

import {
  effectiveRole,
  projectActorFromMembership,
  resolveProjectRole,
  type ProjectActor,
} from "./actor";

describe("resolveProjectRole — ma trận ghép project role (Mốc 11)", () => {
  it("workspace Owner LUÔN là Owner trong mọi project", () => {
    expect(resolveProjectRole("Owner", null)).toBe("Owner");
    expect(resolveProjectRole("Owner", "Member")).toBe("Owner");
    expect(resolveProjectRole("Owner", "Admin")).toBe("Owner");
  });

  it("chưa có row project role -> dùng workspace role (backward-compat)", () => {
    expect(resolveProjectRole("Admin", null)).toBe("Admin");
    expect(resolveProjectRole("Member", null)).toBe("Member");
  });

  it("row explicit ưu tiên hơn workspace role (elevate + restrict)", () => {
    expect(resolveProjectRole("Member", "Admin")).toBe("Admin");
    expect(resolveProjectRole("Member", "Owner")).toBe("Owner");
    expect(resolveProjectRole("Admin", "Member")).toBe("Member");
  });
});

describe("projectActorFromMembership — dựng ProjectActor", () => {
  it("giữ userId/workspaceId/role và thêm projectId + projectRole hợp lệ", () => {
    const actor = projectActorFromMembership(
      { userId: "u1", workspaceId: "ws1", role: "Admin" },
      "p1",
      "Member",
    );
    expect(actor).toEqual({
      userId: "u1",
      workspaceId: "ws1",
      role: "Admin",
      projectId: "p1",
      projectRole: "Member",
    });
  });

  it("không phải workspace member -> UnauthorizedError", () => {
    expect(() => projectActorFromMembership(null, "p1", null)).toThrow();
  });
});

describe("effectiveRole — role hiệu lực theo ngữ cảnh project (Mốc 11)", () => {
  it("Actor thường -> role workspace", () => {
    expect(effectiveRole({ userId: "u1", workspaceId: "ws1", role: "Admin" })).toBe("Admin");
  });

  it("ProjectActor -> projectRole (không phải role workspace)", () => {
    const restrictedAdmin: ProjectActor = {
      userId: "u1",
      workspaceId: "ws1",
      role: "Admin",
      projectId: "p1",
      projectRole: "Member",
    };
    expect(effectiveRole(restrictedAdmin)).toBe("Member");
  });

  it("ProjectActor với project role cao hơn workspace role -> ưu tiên projectRole", () => {
    const elevated: ProjectActor = {
      userId: "u1",
      workspaceId: "ws1",
      role: "Member",
      projectId: "p1",
      projectRole: "Owner",
    };
    expect(effectiveRole(elevated)).toBe("Owner");
  });
});