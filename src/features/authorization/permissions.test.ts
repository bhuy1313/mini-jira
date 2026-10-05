import { describe, expect, it } from "vitest";

import {
  canAddComment,
  canAddMember,
  canArchiveProject,
  canAssignTask,
  canChangeDueDate,
  canChangeMemberRole,
  canChangePriority,
  canChangeStatus,
  canCreateProject,
  canCreateTask,
  canDeleteComment,
  canDeleteTask,
  canDeleteWorkspace,
  canEditComment,
  canEditTask,
  canEditTaskField,
  canModifyActivity,
  canPermanentlyDeleteProject,
  canRemoveMember,
  canRestoreProject,
  canUpdateProject,
  canUpdateWorkspace,
  canViewActivity,
  canViewComments,
  canViewMembers,
  canViewProjects,
  canViewTasks,
  canViewWorkspace,
  type Role,
  type TaskField,
} from "./permissions";

const ROLES: Role[] = ["Owner", "Admin", "Member"];

describe("Ma trận quyền §2.4 — workspace & members", () => {
  it("tất cả role xem được workspace và members", () => {
    for (const role of ROLES) {
      expect(canViewWorkspace(role)).toBe(true);
      expect(canViewMembers(role)).toBe(true);
    }
  });

  it("chỉ Owner update/delete workspace", () => {
    expect(canUpdateWorkspace("Owner")).toBe(true);
    expect(canUpdateWorkspace("Admin")).toBe(false);
    expect(canUpdateWorkspace("Member")).toBe(false);
    expect(canDeleteWorkspace("Owner")).toBe(true);
    expect(canDeleteWorkspace("Admin")).toBe(false);
    expect(canDeleteWorkspace("Member")).toBe(false);
  });

  it("Owner và Admin thêm member; Member thì không", () => {
    expect(canAddMember("Owner")).toBe(true);
    expect(canAddMember("Admin")).toBe(true);
    expect(canAddMember("Member")).toBe(false);
  });

  it("chỉ Owner đổi role member", () => {
    expect(canChangeMemberRole("Owner")).toBe(true);
    expect(canChangeMemberRole("Admin")).toBe(false);
    expect(canChangeMemberRole("Member")).toBe(false);
  });

  it("remove member: Owner bỏ Admin/Member (không tự xoá), Admin chỉ bỏ Member, Member không bỏ ai", () => {
    // Owner xoá Admin/Member
    expect(canRemoveMember("Owner", "Admin", false)).toBe(true);
    expect(canRemoveMember("Owner", "Member", false)).toBe(true);
    // Owner không tự xoá chính mình
    expect(canRemoveMember("Owner", "Owner", true)).toBe(false);
    // Admin chỉ xoá Member
    expect(canRemoveMember("Admin", "Member", false)).toBe(true);
    expect(canRemoveMember("Admin", "Admin", false)).toBe(false);
    expect(canRemoveMember("Admin", "Owner", false)).toBe(false);
    expect(canRemoveMember("Admin", "Member", true)).toBe(false);
    // Member không xoá ai
    expect(canRemoveMember("Member", "Member", false)).toBe(false);
  });
});

describe("Ma trận quyền §2.4 — projects", () => {
  it("tất cả role xem active projects", () => {
    for (const role of ROLES) {
      expect(canViewProjects(role)).toBe(true);
    }
  });

  it("Owner/Admin create, update, archive, restore; Member thì không", () => {
    const matrix = {
      Owner: { create: true, update: true, archive: true, restore: true },
      Admin: { create: true, update: true, archive: true, restore: true },
      Member: { create: false, update: false, archive: false, restore: false },
    };
    for (const role of ROLES) {
      expect(canCreateProject(role)).toBe(matrix[role].create);
      expect(canUpdateProject(role)).toBe(matrix[role].update);
      expect(canArchiveProject(role)).toBe(matrix[role].archive);
      expect(canRestoreProject(role)).toBe(matrix[role].restore);
    }
  });

  it("chỉ Owner permanetly delete project; Admin tuyệt đối không", () => {
    expect(canPermanentlyDeleteProject("Owner")).toBe(true);
    expect(canPermanentlyDeleteProject("Admin")).toBe(false);
    expect(canPermanentlyDeleteProject("Member")).toBe(false);
  });
});

describe("Ma trận quyền §2.4 — tasks (theo vai trò)", () => {
  it("tất cả role tạo và xem task", () => {
    for (const role of ROLES) {
      expect(canCreateTask(role)).toBe(true);
      expect(canViewTasks(role)).toBe(true);
    }
  });

  it("Owner/Admin delete, assign, priority, due date; Member thì không", () => {
    const manageActions = [
      canDeleteTask,
      canAssignTask,
      canChangePriority,
      canChangeDueDate,
    ];
    for (const action of manageActions) {
      expect(action("Owner")).toBe(true);
      expect(action("Admin")).toBe(true);
      expect(action("Member")).toBe(false);
    }
  });

  it("Owner/Admin sửa mọi task; Member chỉ sửa task mình là creator hoặc assignee (BR-008)", () => {
    expect(canEditTask({ role: "Owner", isCreator: false, isAssignee: false })).toBe(true);
    expect(canEditTask({ role: "Admin", isCreator: false, isAssignee: false })).toBe(true);
    expect(canEditTask({ role: "Member", isCreator: true, isAssignee: false })).toBe(true);
    expect(canEditTask({ role: "Member", isCreator: false, isAssignee: true })).toBe(true);
    expect(canEditTask({ role: "Member", isCreator: false, isAssignee: false })).toBe(false);
  });

  it("Member chỉ sửa title/description/status trên task của mình; không sửa field quản trị (BR-009)", () => {
    const memberOwned = { role: "Member" as const, isCreator: true, isAssignee: false };
    expect(canEditTaskField("title", memberOwned)).toBe(true);
    expect(canEditTaskField("description", memberOwned)).toBe(true);
    expect(canEditTaskField("status", memberOwned)).toBe(true);
    expect(canEditTaskField("priority", memberOwned)).toBe(false);
    expect(canEditTaskField("assigneeId", memberOwned)).toBe(false);
    expect(canEditTaskField("dueDate", memberOwned)).toBe(false);
    expect(canEditTaskField("position", memberOwned)).toBe(false);
  });

  it("Member không sửa được field nào trên task không thuộc quyền", () => {
    const stranger = { role: "Member" as const, isCreator: false, isAssignee: false };
    const fields: TaskField[] = [
      "title",
      "description",
      "status",
      "priority",
      "assigneeId",
      "dueDate",
      "position",
    ];
    for (const field of fields) {
      expect(canEditTaskField(field, stranger)).toBe(false);
    }
  });

  it("Owner/Admin sửa mọi field trên task bất kỳ", () => {
    const fields: TaskField[] = [
      "title",
      "description",
      "status",
      "priority",
      "assigneeId",
      "dueDate",
      "position",
    ];
    for (const role of ["Owner", "Admin"] as const) {
      for (const field of fields) {
        expect(canEditTaskField(field, { role, isCreator: false, isAssignee: false })).toBe(true);
      }
    }
  });

  it("đổi status: Owner/Admin mọi task; Member chỉ task thuộc quyền (FR-045)", () => {
    expect(canChangeStatus({ role: "Owner", isCreator: false, isAssignee: false })).toBe(true);
    expect(canChangeStatus({ role: "Admin", isCreator: false, isAssignee: false })).toBe(true);
    expect(canChangeStatus({ role: "Member", isCreator: true, isAssignee: false })).toBe(true);
    expect(canChangeStatus({ role: "Member", isCreator: false, isAssignee: true })).toBe(true);
    expect(canChangeStatus({ role: "Member", isCreator: false, isAssignee: false })).toBe(false);
  });
});

describe("Ma trận quyền §2.4 — comments", () => {
  it("tất cả role thêm và xem comment", () => {
    for (const role of ROLES) {
      expect(canAddComment(role)).toBe(true);
      expect(canViewComments(role)).toBe(true);
    }
  });

  it("chỉ sửa comment của chính mình; Owner/Admin không sửa comment người khác (FR-062)", () => {
    for (const role of ROLES) {
      expect(canEditComment(role, true)).toBe(true);
    }
    expect(canEditComment("Owner", false)).toBe(false);
    expect(canEditComment("Admin", false)).toBe(false);
    expect(canEditComment("Member", false)).toBe(false);
  });

  it("xoá comment của mình; Owner/Admin xoá được comment bất kỳ (FR-063)", () => {
    for (const role of ROLES) {
      expect(canDeleteComment(role, true)).toBe(true);
    }
    expect(canDeleteComment("Owner", false)).toBe(true);
    expect(canDeleteComment("Admin", false)).toBe(true);
    expect(canDeleteComment("Member", false)).toBe(false);
  });
});

describe("Activity", () => {
  it("tất cả role xem activity; không ai modify (immutable BR-015)", () => {
    for (const role of ROLES) {
      expect(canViewActivity(role)).toBe(true);
      expect(canModifyActivity(role)).toBe(false);
    }
  });
});

describe("Custom Fields (Mốc 18)", () => {
  it("Owner và Admin có quyền manage custom fields, Member thì không", async () => {
    const { canManageCustomFields } = await import("./permissions");
    expect(canManageCustomFields("Owner")).toBe(true);
    expect(canManageCustomFields("Admin")).toBe(true);
    expect(canManageCustomFields("Member")).toBe(false);
  });
});

describe("Automation Rules (Mốc 19)", () => {
  it("Owner và Admin có quyền manage automation rules, Member thì không", async () => {
    const { canManageAutomationRules } = await import("./permissions");
    expect(canManageAutomationRules("Owner")).toBe(true);
    expect(canManageAutomationRules("Admin")).toBe(true);
    expect(canManageAutomationRules("Member")).toBe(false);
  });
});

describe("API Keys (Mốc 20)", () => {
  it("Owner và Admin có quyền manage api keys, Member thì không", async () => {
    const { canManageApiKeys } = await import("./permissions");
    expect(canManageApiKeys("Owner")).toBe(true);
    expect(canManageApiKeys("Admin")).toBe(true);
    expect(canManageApiKeys("Member")).toBe(false);
  });
});

describe("Worklogs (Mốc P5)", () => {
  it("tất cả role được xem và log work", async () => {
    const { canLogWork, canViewWorklogs } = await import("./permissions");
    for (const role of ROLES) {
      expect(canLogWork(role)).toBe(true);
      expect(canViewWorklogs(role)).toBe(true);
    }
  });

  it("chỉ author mới sửa được worklog", async () => {
    const { canEditWorklog } = await import("./permissions");
    for (const role of ROLES) {
      expect(canEditWorklog(role, true)).toBe(true);
      expect(canEditWorklog(role, false)).toBe(false);
    }
  });

  it("author xoá được worklog của mình; Owner/Admin xoá được của bất kỳ ai", async () => {
    const { canDeleteWorklog } = await import("./permissions");
    expect(canDeleteWorklog("Member", true)).toBe(true);
    expect(canDeleteWorklog("Member", false)).toBe(false);
    expect(canDeleteWorklog("Admin", false)).toBe(true);
    expect(canDeleteWorklog("Owner", false)).toBe(true);
  });
});



