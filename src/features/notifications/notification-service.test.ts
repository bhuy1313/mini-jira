import { describe, expect, it } from "vitest";

import { UnauthorizedError } from "@/features/authorization/errors";
import {
  createNotificationService,
  type CreateNotificationInput,
  type NotificationRecord,
  type NotificationRepository,
} from "./notification-service";

class InMemoryNotificationRepo implements NotificationRepository {
  public notifications: NotificationRecord[] = [];
  private nextId = 1;

  async create(input: CreateNotificationInput): Promise<NotificationRecord> {
    const n: NotificationRecord = {
      id: `n-${this.nextId++}`,
      userId: input.userId,
      type: input.type,
      payload: input.payload,
      readAt: null,
      createdAt: new Date(),
    };
    this.notifications.push(n);
    return n;
  }

  async listForUser(userId: string, limit = 20): Promise<NotificationRecord[]> {
    return this.notifications
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async countUnread(userId: string): Promise<number> {
    return this.notifications.filter((n) => n.userId === userId && !n.readAt).length;
  }

  async getNotification(id: string): Promise<NotificationRecord | null> {
    return this.notifications.find((n) => n.id === id) ?? null;
  }

  async markRead({ userId, notificationId }: { userId: string; notificationId: string }): Promise<void> {
    const n = this.notifications.find((x) => x.id === notificationId && x.userId === userId);
    if (n) n.readAt = new Date();
  }

  async markAllRead(userId: string): Promise<void> {
    for (const n of this.notifications) {
      if (n.userId === userId && !n.readAt) n.readAt = new Date();
    }
  }
}

describe("Notification service (Mốc 13) — mỗi user chỉ đọc/đánh dấu của mình", () => {
  it("listNotifications chỉ trả về notification của chính user", async () => {
    const repo = new InMemoryNotificationRepo();
    const svc = createNotificationService({ repo });
    await repo.create({ userId: "alice", type: "TaskAssigned", payload: { taskTitle: "A" } });
    await repo.create({ userId: "bob", type: "NewComment", payload: { taskTitle: "B" } });

    const list = await svc.listNotifications("alice");
    expect(list).toHaveLength(1);
    expect(list[0].userId).toBe("alice");
  });

  it("countUnread đếm đúng số chưa đọc của từng user", async () => {
    const repo = new InMemoryNotificationRepo();
    const svc = createNotificationService({ repo });
    await repo.create({ userId: "alice", type: "TaskAssigned", payload: {} });
    await repo.create({ userId: "alice", type: "NewComment", payload: {} });
    await repo.create({ userId: "bob", type: "ProjectArchived", payload: {} });

    expect(await svc.countUnread("alice")).toBe(2);
    expect(await svc.countUnread("bob")).toBe(1);
  });

  it("markNotificationRead: user khác không đọc được notification của người khác", async () => {
    const repo = new InMemoryNotificationRepo();
    const svc = createNotificationService({ repo });
    const n = await repo.create({ userId: "alice", type: "TaskAssigned", payload: {} });

    await expect(svc.markNotificationRead("bob", n.id)).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
    expect(await svc.countUnread("alice")).toBe(1);

    await svc.markNotificationRead("alice", n.id);
    expect(await svc.countUnread("alice")).toBe(0);
  });

  it("markNotificationRead trên id không tồn tại → UnauthorizedError", async () => {
    const repo = new InMemoryNotificationRepo();
    const svc = createNotificationService({ repo });
    await expect(svc.markNotificationRead("alice", "missing")).rejects.toBeInstanceOf(
      UnauthorizedError,
    );
  });

  it("markNotificationRead khi đã đọc → no-op (không throw)", async () => {
    const repo = new InMemoryNotificationRepo();
    const svc = createNotificationService({ repo });
    const n = await repo.create({ userId: "alice", type: "TaskAssigned", payload: {} });

    await svc.markNotificationRead("alice", n.id);
    await expect(svc.markNotificationRead("alice", n.id)).resolves.toBeUndefined();
  });

  it("markAllNotificationsRead chỉ reset user đó, không đụng user khác", async () => {
    const repo = new InMemoryNotificationRepo();
    const svc = createNotificationService({ repo });
    await repo.create({ userId: "alice", type: "NewComment", payload: {} });
    await repo.create({ userId: "alice", type: "WorkspaceInvited", payload: {} });
    await repo.create({ userId: "bob", type: "TaskAssigned", payload: {} });

    await svc.markAllNotificationsRead("alice");
    expect(await svc.countUnread("alice")).toBe(0);
    expect(await svc.countUnread("bob")).toBe(1);
  });
});