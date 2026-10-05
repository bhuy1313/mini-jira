import { describe, expect, it, vi } from "vitest";

import type { Actor, ProjectActor } from "@/features/authorization/actor";
import { UnauthorizedError } from "@/features/authorization/errors";
import type {
  CreateNotificationInput,
  NotificationPublisher,
} from "@/features/notifications/notification-service";
import {
  createCommentService,
  type CommentRecord,
  type CommentRepository,
} from "./comment-service";

class InMemoryCommentRepo implements CommentRepository {
  public comments: CommentRecord[] = [];
  public taskWorkspaces: Record<string, string> = {};
  public taskProjects: Record<string, string> = {};
  public taskMeta: Record<
    string,
    { title: string; projectId: string; workspaceId: string; creatorId: string; assigneeId: string | null }
  > = {};
  private nextId = 1;

  async getComment(commentId: string): Promise<CommentRecord | null> {
    return this.comments.find((c) => c.id === commentId) ?? null;
  }

  async listCommentsByTask(taskId: string): Promise<CommentRecord[]> {
    return this.comments
      .filter((c) => c.taskId === taskId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async getTaskWorkspaceId(taskId: string): Promise<string | null> {
    return this.taskWorkspaces[taskId] ?? null;
  }

  async getTaskProjectId(taskId: string): Promise<string | null> {
    return this.taskProjects[taskId] ?? null;
  }

  async getTaskMeta(
    taskId: string,
  ): Promise<{ title: string; projectId: string; workspaceId: string; creatorId: string; assigneeId: string | null } | null> {
    return this.taskMeta[taskId] ?? null;
  }

  async createComment(input: {
    taskId: string;
    authorId: string;
    content: string;
  }): Promise<CommentRecord> {
    const comment: CommentRecord = {
      id: `comment-${this.nextId++}`,
      taskId: input.taskId,
      workspaceId: this.taskWorkspaces[input.taskId],
      projectId: this.taskProjects[input.taskId],
      authorId: input.authorId,
      content: input.content,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.comments.push(comment);
    return comment;
  }

  async updateComment(input: {
    commentId: string;
    content: string;
  }): Promise<CommentRecord> {
    const idx = this.comments.findIndex((c) => c.id === input.commentId);
    if (idx === -1) throw new Error("Not found");
    const updated = {
      ...this.comments[idx],
      content: input.content,
      updatedAt: new Date(),
    };
    this.comments[idx] = updated;
    return updated;
  }

  async deleteComment(commentId: string): Promise<void> {
    this.comments = this.comments.filter((c) => c.id !== commentId);
  }
}

describe("CommentService", () => {
  const ownerActor: Actor = { userId: "user-owner", workspaceId: "ws-1", role: "Owner" };
  const adminActor: Actor = { userId: "user-admin", workspaceId: "ws-1", role: "Admin" };
  const memberA: Actor = { userId: "user-member-a", workspaceId: "ws-1", role: "Member" };
  const memberB: Actor = { userId: "user-member-b", workspaceId: "ws-1", role: "Member" };
  const otherWsMember: Actor = { userId: "user-other", workspaceId: "ws-2", role: "Member" };

  function setup() {
    const repo = new InMemoryCommentRepo();
    repo.taskWorkspaces["task-1"] = "ws-1";
    repo.taskProjects["task-1"] = "proj-1";
    const service = createCommentService({ repo });
    return { repo, service };
  }

  it("cho phép mọi member thêm comment", async () => {
    const { service } = setup();
    const comment = await service.addComment(memberA, "task-1", "Hello world");
    expect(comment.content).toBe("Hello world");
    expect(comment.authorId).toBe("user-member-a");
  });

  it("chặn thêm comment rỗng", async () => {
    const { service } = setup();
    await expect(service.addComment(memberA, "task-1", "   ")).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("chặn truy cập task thuộc workspace khác khi comment", async () => {
    const { service } = setup();
    await expect(service.addComment(otherWsMember, "task-1", "Test")).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("chỉ tác giả mới được sửa comment (FR-062)", async () => {
    const { service } = setup();
    const comment = await service.addComment(memberA, "task-1", "Initial comment");

    // Member A (tác giả) sửa thành công
    const updated = await service.updateComment(memberA, comment.id, "Updated by author");
    expect(updated.content).toBe("Updated by author");

    // Member B không sửa được
    await expect(service.updateComment(memberB, comment.id, "Hacked")).rejects.toThrow(
      UnauthorizedError,
    );

    // Owner và Admin cũng KHÔNG được sửa comment của người khác
    await expect(service.updateComment(ownerActor, comment.id, "Owner edit")).rejects.toThrow(
      UnauthorizedError,
    );
    await expect(service.updateComment(adminActor, comment.id, "Admin edit")).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("tác giả xoá được comment của mình; Owner/Admin xoá được comment bất kỳ; Member khác không xoá được (FR-063)", async () => {
    const { service, repo } = setup();
    const comment1 = await service.addComment(memberA, "task-1", "Comment 1");
    const comment2 = await service.addComment(memberA, "task-1", "Comment 2");
    const comment3 = await service.addComment(memberA, "task-1", "Comment 3");

    // Member B không xoá được comment của Member A
    await expect(service.deleteComment(memberB, comment1.id)).rejects.toThrow(
      UnauthorizedError,
    );

    // Tác giả tự xoá comment1
    await service.deleteComment(memberA, comment1.id);
    expect(await repo.getComment(comment1.id)).toBeNull();

    // Admin xoá comment2 của Member A
    await service.deleteComment(adminActor, comment2.id);
    expect(await repo.getComment(comment2.id)).toBeNull();

    // Owner xoá comment3 của Member A
    await service.deleteComment(ownerActor, comment3.id);
    expect(await repo.getComment(comment3.id)).toBeNull();
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
    await expect(service.listComments(wrongProjectActor, "task-1")).rejects.toThrow(
      UnauthorizedError,
    );
    await expect(service.addComment(wrongProjectActor, "task-1", "Hi")).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("ProjectActor: Admin workspace nhưng project Member không xoá comment người khác (effectiveRole)", async () => {
    const { service } = setup();
    const comment = await service.addComment(memberA, "task-1", "Secret");

    const restrictedAdmin: ProjectActor = {
      userId: "user-admin",
      workspaceId: "ws-1",
      role: "Admin",
      projectId: "proj-1",
      projectRole: "Member",
    };
    await expect(service.deleteComment(restrictedAdmin, comment.id)).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it("ProjectActor với projectRole Owner xoá được comment bất kỳ (effectiveRole)", async () => {
    const { service, repo } = setup();
    const comment = await service.addComment(memberA, "task-1", "Secret");

    const projectOwner: ProjectActor = {
      userId: "user-owner",
      workspaceId: "ws-1",
      role: "Member",
      projectId: "proj-1",
      projectRole: "Owner",
    };
    await service.deleteComment(projectOwner, comment.id);
    expect(await repo.getComment(comment.id)).toBeNull();
  });

  it("chặn ProjectActor sửa/xoá comment thuộc project khác", async () => {
    const { service } = setup();
    const comment = await service.addComment(memberA, "task-1", "Secret");

    const wrongProjectOwner: ProjectActor = {
      userId: "user-owner",
      workspaceId: "ws-1",
      role: "Owner",
      projectId: "proj-9",
      projectRole: "Owner",
    };
    await expect(service.updateComment(wrongProjectOwner, comment.id, "Hacked")).rejects.toThrow(
      UnauthorizedError,
    );
    await expect(service.deleteComment(wrongProjectOwner, comment.id)).rejects.toThrow(
      UnauthorizedError,
    );
  });
});

describe("CommentService — NewComment notifications (Mốc 13)", () => {
  const ownerActor: Actor = { userId: "user-owner", workspaceId: "ws-1", role: "Owner" };
  const memberA: Actor = { userId: "user-member-a", workspaceId: "ws-1", role: "Member" };

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

  function taskRepo(meta: {
    title?: string;
    projectId?: string;
    workspaceId?: string;
    creatorId: string;
    assigneeId: string | null;
  }): InMemoryCommentRepo {
    const repo = new InMemoryCommentRepo();
    repo.taskWorkspaces["task-1"] = meta.workspaceId ?? "ws-1";
    repo.taskProjects["task-1"] = meta.projectId ?? "proj-1";
    repo.taskMeta["task-1"] = {
      title: meta.title ?? "Task 1",
      projectId: meta.projectId ?? "proj-1",
      workspaceId: meta.workspaceId ?? "ws-1",
      creatorId: meta.creatorId,
      assigneeId: meta.assigneeId,
    };
    return repo;
  }

  it("comment mới → notify cho creator + assignee, loại chính tác giả", async () => {
    const repo = taskRepo({ creatorId: "user-owner", assigneeId: "user-member-b" });
    const { publisher, sent } = makePublisher();
    const service = createCommentService({ repo, notifications: publisher });

    await service.addComment(memberA, "task-1", "New note");

    expect(publisher.notify).toHaveBeenCalledTimes(2);
    expect(sent.map((n) => n.userId).sort()).toEqual(["user-member-b", "user-owner"]);
    for (const n of sent) {
      expect(n.type).toBe("NewComment");
      expect(n.payload).toMatchObject({ taskId: "task-1", projectId: "proj-1", workspaceId: "ws-1" });
    }
  });

  it("comment vào task của chính mình → không gửi notification", async () => {
    const repo = taskRepo({ creatorId: memberA.userId, assigneeId: null });
    const { publisher } = makePublisher();
    const service = createCommentService({ repo, notifications: publisher });

    await service.addComment(memberA, "task-1", "Mine");
    expect(publisher.notify).not.toHaveBeenCalled();
  });

  it("creator == assignee (cùng một người) → chỉ 1 notification, không trùng", async () => {
    const repo = taskRepo({ creatorId: "user-owner", assigneeId: "user-owner" });
    const { publisher, sent } = makePublisher();
    const service = createCommentService({ repo, notifications: publisher });

    await service.addComment(memberA, "task-1", "Note");
    expect(publisher.notify).toHaveBeenCalledTimes(1);
    expect(sent[0].userId).toBe("user-owner");
  });

  it("task không có metadata → không gửi notification", async () => {
    const repo = new InMemoryCommentRepo();
    repo.taskWorkspaces["task-1"] = "ws-1";
    repo.taskProjects["task-1"] = "proj-1";
    const { publisher } = makePublisher();
    const service = createCommentService({ repo, notifications: publisher });

    await service.addComment(ownerActor, "task-1", "No meta");
    expect(publisher.notify).not.toHaveBeenCalled();
  });
});
