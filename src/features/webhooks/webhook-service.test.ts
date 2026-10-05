import { describe, expect, it, vi } from "vitest";
import type { ProjectActor } from "@/features/authorization/actor";
import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import { createWebhookService } from "./webhook-service";
import type { WebhookRepository } from "./prisma-webhook-repository";
import type { WebhookDispatcher } from "./webhook-dispatcher";
import type { WebhookRecord } from "./webhook-types";

function makeActors(): {
  owner: ProjectActor;
  admin: ProjectActor;
  member: ProjectActor;
} {
  return {
    owner: {
      userId: "user-owner",
      workspaceId: "ws-1",
      role: "Owner",
      projectId: "proj-1",
      projectRole: "Owner",
    },
    admin: {
      userId: "user-admin",
      workspaceId: "ws-1",
      role: "Admin",
      projectId: "proj-1",
      projectRole: "Admin",
    },
    member: {
      userId: "user-member",
      workspaceId: "ws-1",
      role: "Member",
      projectId: "proj-1",
      projectRole: "Member",
    },
  };
}

function makeMockRepo(): WebhookRepository {
  const store: Record<string, WebhookRecord> = {
    "wh-1": {
      id: "wh-1",
      name: "Existing Webhook",
      url: "https://example.com/webhook",
      secret: null,
      format: "Generic",
      events: ["task.created"],
      enabled: true,
      projectId: "proj-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  };

  return {
    createWebhook: vi.fn().mockImplementation(async (input) => ({
      id: "wh-new",
      ...input,
      secret: input.secret ?? null,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    getWebhookById: vi.fn().mockImplementation(async (id) => store[id] ?? null),
    listWebhooksByProject: vi.fn().mockImplementation(async () => Object.values(store)),
    listActiveWebhooksByProjectAndEvent: vi.fn().mockImplementation(async () => Object.values(store)),
    updateWebhook: vi.fn().mockImplementation(async (id, data) => ({
      ...store[id],
      ...data,
    })),
    deleteWebhook: vi.fn().mockImplementation(async (id) => {
      delete store[id];
    }),
    recordDeliveryLog: vi.fn(),
    listDeliveryLogsByWebhook: vi.fn().mockResolvedValue([]),
    listDeliveryLogsByProject: vi.fn().mockResolvedValue([]),
  };
}

describe("Webhook Service (RBAC & Business Rules)", () => {
  const actors = makeActors();

  it("allows Owner and Admin to create a webhook", async () => {
    const repo = makeMockRepo();
    const service = createWebhookService(repo);

    const created = await service.createWebhook(actors.owner, "proj-1", {
      name: "Slack Channel",
      url: "https://hooks.slack.com/services/xxx",
      format: "Slack",
      events: ["task.created"],
    });

    expect(created.name).toBe("Slack Channel");
    expect(repo.createWebhook).toHaveBeenCalled();
  });

  it("denies Member from creating a webhook", async () => {
    const repo = makeMockRepo();
    const service = createWebhookService(repo);

    await expect(
      service.createWebhook(actors.member, "proj-1", {
        name: "Member Webhook",
        url: "https://example.com/wh",
        format: "Generic",
        events: ["task.created"],
      }),
    ).rejects.toThrow(UnauthorizedError);
  });

  it("validates URL format and requires HTTP or HTTPS", async () => {
    const repo = makeMockRepo();
    const service = createWebhookService(repo);

    await expect(
      service.createWebhook(actors.admin, "proj-1", {
        name: "Bad Webhook",
        url: "ftp://invalid-url.com",
        format: "Generic",
        events: ["task.created"],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("allows Owner/Admin to delete and toggle webhooks", async () => {
    const repo = makeMockRepo();
    const service = createWebhookService(repo);

    await service.updateWebhook(actors.admin, "proj-1", "wh-1", { enabled: false });
    expect(repo.updateWebhook).toHaveBeenCalledWith("wh-1", { enabled: false });

    await service.deleteWebhook(actors.owner, "proj-1", "wh-1");
    expect(repo.deleteWebhook).toHaveBeenCalledWith("wh-1");
  });

  it("triggers test ping and returns delivery log", async () => {
    const repo = makeMockRepo();
    const mockDispatcher: WebhookDispatcher = {
      dispatchToWebhook: vi.fn().mockResolvedValue({
        id: "log-1",
        webhookId: "wh-1",
        event: "ping",
        statusCode: 200,
        responseBody: "pong",
        durationMs: 45,
        success: true,
        createdAt: new Date(),
      }),
      broadcastProjectEvent: vi.fn(),
    };

    const service = createWebhookService(repo, mockDispatcher);
    const result = await service.testPingWebhook(actors.admin, "proj-1", "wh-1");

    expect(result.success).toBe(true);
    expect(mockDispatcher.dispatchToWebhook).toHaveBeenCalled();
  });
});
