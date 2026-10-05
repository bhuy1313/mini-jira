import { describe, expect, it } from "vitest";

import type { Actor, ProjectActor } from "@/features/authorization/actor";
import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import {
  createLabelService,
  type LabelRecord,
  type LabelRepository,
} from "./label-service";

class InMemoryLabelRepo implements LabelRepository {
  public labels: LabelRecord[] = [];
  public projectWorkspaces: Record<string, string> = {};
  public taskWorkspaces: Record<string, string> = {};
  public taskProjects: Record<string, string> = {};
  public taskLabels: Record<string, string[]> = {};
  public tasksToLabels: Record<string, string> = {};
  private nextId = 1;

  async getLabel(labelId: string): Promise<LabelRecord | null> {
    return this.labels.find((l) => l.id === labelId) ?? null;
  }

  async getProjectWorkspaceId(projectId: string): Promise<string | null> {
    return this.projectWorkspaces[projectId] ?? null;
  }

  async getTaskWorkspaceId(taskId: string): Promise<string | null> {
    return this.taskWorkspaces[taskId] ?? null;
  }

  async getTaskProjectId(taskId: string): Promise<string | null> {
    return this.taskProjects[taskId] ?? null;
  }

  async listLabelsByProject(projectId: string): Promise<LabelRecord[]> {
    return this.labels
      .filter((l) => l.projectId === projectId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createLabel(input: { projectId: string; name: string; color: string }): Promise<LabelRecord> {
    const record: LabelRecord = {
      id: `label-${this.nextId++}`,
      name: input.name,
      color: input.color,
      projectId: input.projectId,
      workspaceId: this.projectWorkspaces[input.projectId],
    };
    this.labels.push(record);
    this.tasksToLabels[record.id] = input.projectId;
    return record;
  }

  async updateLabel(input: { labelId: string; name?: string; color?: string }): Promise<LabelRecord> {
    const idx = this.labels.findIndex((l) => l.id === input.labelId);
    if (idx === -1) throw new Error("Not found");
    const updated = {
      ...this.labels[idx],
      name: input.name ?? this.labels[idx].name,
      color: input.color ?? this.labels[idx].color,
    };
    this.labels[idx] = updated;
    return updated;
  }

  async deleteLabel(labelId: string): Promise<void> {
    this.labels = this.labels.filter((l) => l.id !== labelId);
    delete this.tasksToLabels[labelId];
    for (const taskId of Object.keys(this.taskLabels)) {
      this.taskLabels[taskId] = this.taskLabels[taskId].filter((id) => id !== labelId);
    }
  }

  async listTaskLabelIds(taskId: string): Promise<string[]> {
    return this.taskLabels[taskId] ?? [];
  }

  async addLabelToTask(taskId: string, labelId: string): Promise<void> {
    (this.taskLabels[taskId] ??= []).push(labelId);
  }

  async removeLabelFromTask(taskId: string, labelId: string): Promise<void> {
    this.taskLabels[taskId] = (this.taskLabels[taskId] ?? []).filter((id) => id !== labelId);
  }

  async listLabelsByTaskIds(taskIds: string[]): Promise<{ taskId: string; label: LabelRecord }[]> {
    const result: { taskId: string; label: LabelRecord }[] = [];
    for (const taskId of taskIds) {
      for (const labelId of this.taskLabels[taskId] ?? []) {
        const label = this.labels.find((l) => l.id === labelId);
        if (label) result.push({ taskId, label });
      }
    }
    return result;
  }
}

describe("LabelService", () => {
  const ownerActor: Actor = { userId: "user-owner", workspaceId: "ws-1", role: "Owner" };
  const adminActor: Actor = { userId: "user-admin", workspaceId: "ws-1", role: "Admin" };
  const memberA: Actor = { userId: "user-member-a", workspaceId: "ws-1", role: "Member" };
  const memberB: Actor = { userId: "user-member-b", workspaceId: "ws-1", role: "Member" };
  const otherWsMember: Actor = { userId: "user-other", workspaceId: "ws-2", role: "Member" };

  function setup() {
    const repo = new InMemoryLabelRepo();
    repo.projectWorkspaces["project-1"] = "ws-1";
    repo.taskWorkspaces["task-1"] = "ws-1";
    repo.taskProjects["task-1"] = "project-1";
    const service = createLabelService({ repo });
    return { repo, service };
  }

  async function seedLabel(repo: InMemoryLabelRepo, name = "Frontend", color = "#0f766e") {
    return repo.createLabel({ projectId: "project-1", name, color });
  }

  it("Owner/Admin tạo được label trong project của mình", async () => {
    const { service, repo } = setup();
    const label = await service.createLabel(ownerActor, "project-1", { name: "Frontend", color: "#0f766e" });
    expect(label.name).toBe("Frontend");
    expect(label.projectId).toBe("project-1");
    expect(repo.labels).toHaveLength(1);

    const label2 = await service.createLabel(adminActor, "project-1", { name: "Backend", color: "#3a5a6e" });
    expect(label2.name).toBe("Backend");
  });

  it("Member KHÔNG tạo/sửa/xoá được label", async () => {
    const { service, repo } = setup();
    await seedLabel(repo);
    const label = repo.labels[0];

    await expect(service.createLabel(memberA, "project-1", { name: "X", color: "#0f766e" })).rejects.toThrow(
      UnauthorizedError,
    );
    await expect(service.updateLabel(memberA, label.id, { name: "Hacked" })).rejects.toThrow(UnauthorizedError);
    await expect(service.deleteLabel(memberA, label.id)).rejects.toThrow(UnauthorizedError);
  });

  it("owner tạo label trong project thuộc workspace khác bị chặn", async () => {
    const { service } = setup();
    await expect(
      service.createLabel(otherWsMember, "project-1", { name: "X", color: "#0f766e" }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("validate tên label và màu hex", async () => {
    const { service } = setup();
    await expect(service.createLabel(ownerActor, "project-1", { name: "  ", color: "#0f766e" })).rejects.toThrow(
      ValidationError,
    );
    await expect(
      service.createLabel(ownerActor, "project-1", { name: "a".repeat(51), color: "#0f766e" }),
    ).rejects.toThrow(ValidationError);
    await expect(
      service.createLabel(ownerActor, "project-1", { name: "Valid", color: "red" }),
    ).rejects.toThrow(ValidationError);
  });

  it("update label: sửa tên và màu; giữ nguyên field không truyền", async () => {
    const { service, repo } = setup();
    await seedLabel(repo);
    const label = repo.labels[0];

    const updated = await service.updateLabel(ownerActor, label.id, { name: "Frontend v2" });
    expect(updated.name).toBe("Frontend v2");
    expect(updated.color).toBe("#0f766e");

    const recolored = await service.updateLabel(ownerActor, label.id, { color: "#a16207" });
    expect(recolored.name).toBe("Frontend v2");
    expect(recolored.color).toBe("#a16207");
  });

  it("mọi member gắn label vào task; label phải thuộc cùng project với task", async () => {
    const { service, repo } = setup();
    const label = await seedLabel(repo);

    await service.addLabelToTask(memberB, "task-1", label.id);
    expect(await repo.listTaskLabelIds("task-1")).toEqual([label.id]);
  });

  it("chặn gắn label của project khác vào task (label thuộc workspace khác)", async () => {
    const { service, repo } = setup();
    repo.projectWorkspaces["project-2"] = "ws-1";
    const label = await repo.createLabel({ projectId: "project-2", name: "Other", color: "#b91c1c" });

    await expect(service.addLabelToTask(memberA, "task-1", label.id)).rejects.toThrow(UnauthorizedError);
  });

  it("chặn thao tác label với task thuộc workspace khác", async () => {
    const { service, repo } = setup();
    const label = await seedLabel(repo);
    repo.taskWorkspaces["task-2"] = "ws-2";
    repo.taskProjects["task-2"] = "project-2";

    await expect(service.addLabelToTask(otherWsMember, "task-1", label.id)).rejects.toThrow(UnauthorizedError);
    await expect(service.removeLabelFromTask(otherWsMember, "task-1", label.id)).rejects.toThrow(UnauthorizedError);
  });

  it("member gỡ label khỏi task", async () => {
    const { service, repo } = setup();
    const label = await seedLabel(repo);
    await service.addLabelToTask(memberA, "task-1", label.id);

    await service.removeLabelFromTask(memberB, "task-1", label.id);
    expect(await repo.listTaskLabelIds("task-1")).toEqual([]);
  });

  it("Owner/Admin xoá label; TaskLabel cascade dọn (repo đảm nhiệm)", async () => {
    const { service, repo } = setup();
    const label = await seedLabel(repo);
    await service.addLabelToTask(memberA, "task-1", label.id);

    await service.deleteLabel(ownerActor, label.id);
    expect(repo.labels).toHaveLength(0);
    expect(await repo.listTaskLabelIds("task-1")).toEqual([]);
  });

  it("gắn label trùng lần 2 không nhân đôi (idempotent add)", async () => {
    const { service, repo } = setup();
    const label = await seedLabel(repo);
    await service.addLabelToTask(memberA, "task-1", label.id);
    await service.addLabelToTask(memberA, "task-1", label.id);
    expect(await repo.listTaskLabelIds("task-1")).toEqual([label.id]);
  });

  it("ProjectActor: Admin workspace nhung project Member KHÔNG quản lý label (effectiveRole)", async () => {
    const { service, repo } = setup();
    await seedLabel(repo);
    // Workspace Admin nhưng bị restrict thành project Member -> cũng bị từ chối
    const projectMemberAdmin: ProjectActor = {
      userId: "user-admin",
      workspaceId: "ws-1",
      role: "Admin",
      projectId: "project-1",
      projectRole: "Member",
    };

    await expect(
      service.createLabel(projectMemberAdmin, "project-1", { name: "X", color: "#0f766e" }),
    ).rejects.toThrow(UnauthorizedError);
    await expect(service.deleteLabel(projectMemberAdmin, repo.labels[0].id)).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("ProjectActor with projectRole Owner manage được label (effectiveRole)", async () => {
    const { service, repo } = setup();
    const projectOwner: ProjectActor = {
      userId: "user-owner",
      workspaceId: "ws-1",
      role: "Member",
      projectId: "project-1",
      projectRole: "Owner",
    };

    const label = await service.createLabel(projectOwner, "project-1", { name: "Frontend", color: "#0f766e" });
    await service.deleteLabel(projectOwner, label.id);
    expect(repo.labels).toHaveLength(0);
  });

  it("chặn ProjectActor thao tác label của project khác", async () => {
    const { service, repo } = setup();
    repo.projectWorkspaces["project-2"] = "ws-1";
    const label = await repo.createLabel({ projectId: "project-2", name: "Other", color: "#b91c1c" });

    const otherProjectActor: ProjectActor = {
      userId: "user-owner",
      workspaceId: "ws-1",
      role: "Owner",
      projectId: "project-2",
      projectRole: "Owner",
    };
    // Label thuộc project-2 nhưng task thuộc project-1 -> từ chối (BR-006 scope)
    await expect(service.addLabelToTask(otherProjectActor, "task-1", label.id)).rejects.toThrow(
      UnauthorizedError,
    );
  });
});