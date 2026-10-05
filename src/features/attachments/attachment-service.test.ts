import { describe, expect, it } from "vitest";

import type { Actor, ProjectActor } from "@/features/authorization/actor";
import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import {
  createAttachmentService,
  type AttachmentRecord,
  type AttachmentRepository,
  type AttachmentStorage,
  MAX_ATTACHMENT_SIZE,
} from "./attachment-service";

class InMemoryAttachmentRepo implements AttachmentRepository {
  public attachments: AttachmentRecord[] = [];
  public taskWorkspaces: Record<string, string> = {};
  public taskProjects: Record<string, string> = {};
  private nextId = 1;

  async getAttachment(attachmentId: string): Promise<AttachmentRecord | null> {
    return this.attachments.find((a) => a.id === attachmentId) ?? null;
  }

  async listAttachmentsByTask(taskId: string): Promise<AttachmentRecord[]> {
    return this.attachments
      .filter((a) => a.taskId === taskId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getTaskWorkspaceId(taskId: string): Promise<string | null> {
    return this.taskWorkspaces[taskId] ?? null;
  }

  async getTaskProjectId(taskId: string): Promise<string | null> {
    return this.taskProjects[taskId] ?? null;
  }

  async createAttachment(input: {
    taskId: string;
    userId: string;
    filename: string;
    mimeType: string;
    size: number;
    storageKey: string;
  }): Promise<AttachmentRecord> {
    const record: AttachmentRecord = {
      id: `attachment-${this.nextId++}`,
      taskId: input.taskId,
      workspaceId: this.taskWorkspaces[input.taskId],
      projectId: this.taskProjects[input.taskId],
      userId: input.userId,
      filename: input.filename,
      mimeType: input.mimeType,
      size: input.size,
      storageKey: input.storageKey,
      createdAt: new Date(),
    };
    this.attachments.push(record);
    return record;
  }

  async deleteAttachment(attachmentId: string): Promise<void> {
    this.attachments = this.attachments.filter((a) => a.id !== attachmentId);
  }
}

class InMemoryStorage implements AttachmentStorage {
  public files = new Map<string, Uint8Array>();

  async save(input: { storageKey: string; data: Uint8Array }): Promise<void> {
    this.files.set(input.storageKey, input.data);
  }

  async read(storageKey: string): Promise<Uint8Array | null> {
    return this.files.get(storageKey) ?? null;
  }

  async delete(storageKey: string): Promise<void> {
    this.files.delete(storageKey);
  }
}

function makeFile(overrides: Partial<{ filename: string; mimeType: string; size: number; data: Uint8Array }>) {
  const data = overrides.data ?? new Uint8Array([1, 2, 3]);
  return {
    filename: overrides.filename ?? "spec.pdf",
    mimeType: overrides.mimeType ?? "application/pdf",
    size: overrides.size ?? data.byteLength,
    data,
  };
}

describe("AttachmentService", () => {
  const ownerActor: Actor = { userId: "user-owner", workspaceId: "ws-1", role: "Owner" };
  const adminActor: Actor = { userId: "user-admin", workspaceId: "ws-1", role: "Admin" };
  const memberA: Actor = { userId: "user-member-a", workspaceId: "ws-1", role: "Member" };
  const memberB: Actor = { userId: "user-member-b", workspaceId: "ws-1", role: "Member" };
  const otherWsMember: Actor = { userId: "user-other", workspaceId: "ws-2", role: "Member" };

  function setup() {
    const repo = new InMemoryAttachmentRepo();
    const storage = new InMemoryStorage();
    repo.taskWorkspaces["task-1"] = "ws-1";
    repo.taskProjects["task-1"] = "proj-1";
    const service = createAttachmentService({ repo, storage });
    return { repo, storage, service };
  }

  it("cho phép mọi member upload attachment (FR-090)", async () => {
    const { service, storage } = setup();
    const attachment = await service.addAttachment(memberA, "task-1", makeFile({}));

    expect(attachment.filename).toBe("spec.pdf");
    expect(attachment.userId).toBe("user-member-a");
    expect(attachment.workspaceId).toBe("ws-1");
    expect(storage.files.has(attachment.storageKey)).toBe(true);
  });

  it("chặn upload vào task thuộc workspace khác", async () => {
    const { service } = setup();
    await expect(
      service.addAttachment(otherWsMember, "task-1", makeFile({})),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("sanitize tên file (chỉ giữ basename)", async () => {
    const { service } = setup();
    const attachment = await service.addAttachment(
      memberA,
      "task-1",
      makeFile({ filename: "../../etc/passwd" }),
    );
    expect(attachment.filename).toBe("passwd");
  });

  it("chặn filename rỗng / quá dài", async () => {
    const { service } = setup();
    await expect(service.addAttachment(memberA, "task-1", makeFile({ filename: "  " }))).rejects.toThrow(
      ValidationError,
    );
    await expect(
      service.addAttachment(memberA, "task-1", makeFile({ filename: "a".repeat(300) })),
    ).rejects.toThrow(ValidationError);
  });

  it("chặn file rỗng và file quá 5MB (FR-093)", async () => {
    const { service } = setup();
    await expect(
      service.addAttachment(memberA, "task-1", makeFile({ size: 0 })),
    ).rejects.toThrow(ValidationError);
    await expect(
      service.addAttachment(
        memberA,
        "task-1",
        makeFile({ data: new Uint8Array(MAX_ATTACHMENT_SIZE + 1) }),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it("mọi member xem được attachment của task (FR-091)", async () => {
    const { service } = setup();
    await service.addAttachment(memberA, "task-1", makeFile({}));
    const list = await service.listAttachments(memberB, "task-1");
    expect(list).toHaveLength(1);
  });

  it("chặn xem attachment của task thuộc workspace khác", async () => {
    const { service } = setup();
    await service.addAttachment(memberA, "task-1", makeFile({}));
    await expect(service.listAttachments(otherWsMember, "task-1")).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("uploader xoá được attachment của mình; Member khác không xoá được (FR-092)", async () => {
    const { service, storage, repo } = setup();
    const attachment = await service.addAttachment(memberA, "task-1", makeFile({}));

    // Member B không xoá được file của Member A
    await expect(service.deleteAttachment(memberB, attachment.id)).rejects.toThrow(
      UnauthorizedError,
    );

    // Uploader tự xoá được
    await service.deleteAttachment(memberA, attachment.id);
    expect(await repo.getAttachment(attachment.id)).toBeNull();
    expect(storage.files.has(attachment.storageKey)).toBe(false);
  });

  it("Owner/Admin xoá được attachment bất kỳ (FR-092)", async () => {
    const { service, repo } = setup();
    const attachment = await service.addAttachment(memberA, "task-1", makeFile({}));

    await service.deleteAttachment(ownerActor, attachment.id);
    expect(await repo.getAttachment(attachment.id)).toBeNull();

    const attachment2 = await service.addAttachment(memberA, "task-1", makeFile({}));
    await service.deleteAttachment(adminActor, attachment2.id);
    expect(await repo.getAttachment(attachment2.id)).toBeNull();
  });

  it("xoá file khỏi storage dù tên file chứa ký tự không an toàn", async () => {
    const { service, storage } = setup();
    const attachment = await service.addAttachment(
      memberA,
      "task-1",
      makeFile({ filename: "odd name.txt" }),
    );
    await service.deleteAttachment(memberA, attachment.id);
    expect(storage.files.has(attachment.storageKey)).toBe(false);
  });

  it("KHÔNG ghi activity khi upload/xoá attachment (quyết định FR-071)", async () => {
    const { service, repo } = setup();
    const attachment = await service.addAttachment(memberA, "task-1", makeFile({}));
    await service.deleteAttachment(memberA, attachment.id);

    // Deps của attachment service không có hoạt động ghi activity — audit giữ gọn,
    // chỉ task-field change + create được log (theo nguyên tắc FR-071 đã chốt trong Mốc 5).
    const deps = { repo, storage: new InMemoryStorage() };
    const logger = createAttachmentService(deps);
    expect(Object.keys(logger).sort()).toEqual([
      "addAttachment",
      "deleteAttachment",
      "listAttachments",
    ]);
  });

  it("ProjectActor cùng project có thể upload/xem attachment", async () => {
    const { service, storage } = setup();
    const projectMember: ProjectActor = {
      userId: "user-member-a",
      workspaceId: "ws-1",
      role: "Member",
      projectId: "proj-1",
      projectRole: "Member",
    };
    const attachment = await service.addAttachment(projectMember, "task-1", makeFile({}));
    expect(storage.files.has(attachment.storageKey)).toBe(true);

    const list = await service.listAttachments(projectMember, "task-1");
    expect(list).toHaveLength(1);
  });

  it("chặn ProjectActor truy cập task thuộc project khác (scope H2)", async () => {
    const { service } = setup();
    const wrongProjectActor: ProjectActor = {
      userId: "user-member-a",
      workspaceId: "ws-1",
      role: "Member",
      projectId: "proj-9",
      projectRole: "Member",
    };
    await expect(service.addAttachment(wrongProjectActor, "task-1", makeFile({}))).rejects.toThrow(
      UnauthorizedError,
    );
    await expect(service.listAttachments(wrongProjectActor, "task-1")).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("ProjectActor: Admin workspace nhưng project Member không xoá attachment người khác (effectiveRole)", async () => {
    const { service } = setup();
    const attachment = await service.addAttachment(memberA, "task-1", makeFile({}));

    const restrictedAdmin: ProjectActor = {
      userId: "user-admin",
      workspaceId: "ws-1",
      role: "Admin",
      projectId: "proj-1",
      projectRole: "Member",
    };
    await expect(service.deleteAttachment(restrictedAdmin, attachment.id)).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("ProjectActor với projectRole Owner xoá được attachment bất kỳ (effectiveRole)", async () => {
    const { service, repo, storage } = setup();
    const attachment = await service.addAttachment(memberA, "task-1", makeFile({}));

    const projectOwner: ProjectActor = {
      userId: "user-owner",
      workspaceId: "ws-1",
      role: "Member",
      projectId: "proj-1",
      projectRole: "Owner",
    };
    await service.deleteAttachment(projectOwner, attachment.id);
    expect(await repo.getAttachment(attachment.id)).toBeNull();
    expect(storage.files.has(attachment.storageKey)).toBe(false);
  });

  it("chặn ProjectActor xoá attachment thuộc project khác", async () => {
    const { service } = setup();
    const attachment = await service.addAttachment(memberA, "task-1", makeFile({}));

    const wrongProjectOwner: ProjectActor = {
      userId: "user-owner",
      workspaceId: "ws-1",
      role: "Owner",
      projectId: "proj-9",
      projectRole: "Owner",
    };
    await expect(service.deleteAttachment(wrongProjectOwner, attachment.id)).rejects.toThrow(
      UnauthorizedError,
    );
  });
});