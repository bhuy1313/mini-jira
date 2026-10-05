import { describe, expect, it } from "vitest";

import {
  isAssigneeInWorkspace,
  isDuplicateMembership,
  isProjectInWorkspace,
  isSingleOwnerMembership,
  isTaskInProject,
  keepsSingleOwner,
  type MemberIdentity,
} from "./rules";

describe("Ràng buộc nghiệp vụ — một Owner mỗi workspace (BR-001)", () => {
  const owner = (id: string): MemberIdentity => ({ userId: id, role: "Owner" });
  const member = (id: string): MemberIdentity => ({ userId: id, role: "Member" });

  it("thêm Member vào workspace 1-Owner không tạo ra thay đổi số Owner", () => {
    expect(keepsSingleOwner([owner("alice"), member("bob")])).toBe(true);
  });

  it("chuyển Member thành Owner khi workspace còn 1 Owner khác → tạo 2 Owner (cấm)", () => {
    expect(keepsSingleOwner([owner("alice"), owner("bob")])).toBe(false);
  });

  it("chuyển Owner thành Member khi còn một Owner khác → hợp lệ (1 Owner)", () => {
    // alice và carol là Owner; demote carol -> Member → còn đúng alice là Owner
    expect(keepsSingleOwner([owner("alice"), member("carol")])).toBe(true);
  });

  it("chuyển Owner thành Member khi không còn Owner nào khác → 0 Owner (cấm)", () => {
    // only alice là Owner; demote alice -> Member → không còn Owner
    expect(keepsSingleOwner([member("alice"), member("bob")])).toBe(false);
  });

  it("tạo workspace mới phải có đúng một Owner (BR-001)", () => {
    expect(isSingleOwnerMembership([owner("alice")])).toBe(true);
    expect(isSingleOwnerMembership([owner("alice"), owner("bob")])).toBe(false);
    expect(isSingleOwnerMembership([member("alice")])).toBe(false);
  });
});

describe("Ràng buộc nghiệp vụ — membership duy nhất (BR-002)", () => {
  it("user đã là member thì không được thêm lại", () => {
    const members = [
      { userId: "alice", role: "Owner" as const },
      { userId: "bob", role: "Member" as const },
    ];
    expect(isDuplicateMembership(members, "bob")).toBe(true);
    expect(isDuplicateMembership(members, "carol")).toBe(false);
  });
});

describe("Ràng buộc nghiệp vụ — assignee cùng workspace (BR-007)", () => {
  const workspaceMemberIds = ["alice", "bob", "carol"];

  it("assignee thuộc workspace thì hợp lệ", () => {
    expect(isAssigneeInWorkspace(workspaceMemberIds, "bob")).toBe(true);
  });

  it("assignee không thuộc workspace thì bị cấm", () => {
    expect(isAssigneeInWorkspace(workspaceMemberIds, "eve")).toBe(false);
  });

  it("bỏ assignee (null) luôn hợp lệ", () => {
    expect(isAssigneeInWorkspace(workspaceMemberIds, null)).toBe(true);
  });
});

describe("Ràng buộc nghiệp vụ — thuộc tính cha-con (BR-006)", () => {
  it("project thuộc workspace hiện tại", () => {
    const projectIds = ["p1", "p2"];
    expect(isProjectInWorkspace(projectIds, "p1")).toBe(true);
    expect(isProjectInWorkspace(projectIds, "pX")).toBe(false);
  });

  it("task thuộc project hiện tại", () => {
    const taskIds = ["t1", "t2"];
    expect(isTaskInProject(taskIds, "t2")).toBe(true);
    expect(isTaskInProject(taskIds, "tX")).toBe(false);
  });
});

describe("Không thao tác khi không thuộc phạm vi", () => {
  it("task không thuộc project thì comment/update bị chặn ở tầng validate", () => {
    // đảm bảo hàm tồn tại và hành xử một nghĩa (không có hàm bỏ qua authz)
    expect(isTaskInProject(["t1"], "t9")).toBe(false);
  });
});
