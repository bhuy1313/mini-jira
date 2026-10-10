import { describe, expect, it, vi } from "vitest";
import { createWebhookDispatcher } from "./webhook-dispatcher";
import type { WebhookRepository } from "./prisma-webhook-repository";
import type {
  WebhookDeliveryLogRecord,
  WebhookEventContext,
  WebhookRecord,
} from "./webhook-types";

function makeMockRepo(): {
  repo: WebhookRepository;
  recordedLogs: unknown[];
} {
  const recordedLogs: unknown[] = [];
  const repo: WebhookRepository = {
    createWebhook: vi.fn(),
    getWebhookById: vi.fn(),
    listWebhooksByProject: vi.fn(),
    listActiveWebhooksByProjectAndEvent: vi.fn(),
    updateWebhook: vi.fn(),
    deleteWebhook: vi.fn(),
    recordDeliveryLog: vi.fn().mockImplementation(async (log) => {
      recordedLogs.push(log);
      return {
        id: "log-1",
        ...log,
        createdAt: new Date(),
      } as WebhookDeliveryLogRecord;
    }),
    listDeliveryLogsByWebhook: vi.fn(),
    listDeliveryLogsByProject: vi.fn(),
  };

  return { repo, recordedLogs };
}

const mockWebhook: WebhookRecord = {
  id: "wh-1",
  name: "Slack Channel",
  url: "https://hooks.slack.com/services/T00/B00/X00",
  secret: "secret-key-123",
  format: "Slack",
  events: ["task.created"],
  enabled: true,
  projectId: "proj-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockContext: WebhookEventContext = {
  event: "task.created",
  timestamp: "2026-10-01T12:00:00.000Z",
  actor: { id: "user-1", name: "Alice" },
  project: { id: "proj-1", name: "Project Alpha", workspaceId: "ws-1" },
  task: {
    id: "task-1",
    title: "Build feature",
    statusId: "st-todo",
    priority: "High",
    projectId: "proj-1",
  },
};

describe("Webhook Dispatcher", () => {
  it("dispatches HTTP POST with HMAC signature and records success log", async () => {
    const { repo, recordedLogs } = makeMockRepo();

    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      text: vi.fn().mockResolvedValue("ok"),
    } as unknown as Response);

    const dispatcher = createWebhookDispatcher(repo, mockFetch);
    const log = await dispatcher.dispatchToWebhook(mockWebhook, mockContext);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(mockWebhook.url);
    expect(options.method).toBe("POST");

    const headers = options.headers as Record<string, string>;
    expect(headers["X-MiniJira-Event"]).toBe("task.created");
    expect(headers["X-MiniJira-Signature-256"]).toMatch(/^sha256=[a-f0-9]{64}$/);

    expect(log.success).toBe(true);
    expect(log.statusCode).toBe(200);
    expect(recordedLogs.length).toBe(1);
  });

  it("handles fetch failure gracefully and records error log without throwing", async () => {
    const { repo, recordedLogs } = makeMockRepo();

    const mockFetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

    const dispatcher = createWebhookDispatcher(repo, mockFetch, { delayFn: () => Promise.resolve() });
    const log = await dispatcher.dispatchToWebhook(mockWebhook, mockContext);

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(log.success).toBe(false);
    expect(log.statusCode).toBeNull();
    expect(log.responseBody).toContain("Connection refused");
    expect(recordedLogs.length).toBe(1);
  });

  it("retries once then succeeds after a transient 500", async () => {
    const { repo, recordedLogs } = makeMockRepo();

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        status: 500,
        ok: false,
        text: vi.fn().mockResolvedValue("boom"),
      } as unknown as Response)
      .mockResolvedValueOnce({
        status: 200,
        ok: true,
        text: vi.fn().mockResolvedValue("ok"),
      } as unknown as Response);

    const dispatcher = createWebhookDispatcher(repo, mockFetch, { delayFn: () => Promise.resolve() });
    const log = await dispatcher.dispatchToWebhook(mockWebhook, mockContext);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(log.success).toBe(true);
    expect(log.statusCode).toBe(200);
    expect(recordedLogs.length).toBe(1);
  });

  it("does not retry client errors (400)", async () => {
    const { repo } = makeMockRepo();

    const mockFetch = vi.fn().mockResolvedValue({
      status: 400,
      ok: false,
      text: vi.fn().mockResolvedValue("bad request"),
    } as unknown as Response);

    const dispatcher = createWebhookDispatcher(repo, mockFetch, { delayFn: () => Promise.resolve() });
    const log = await dispatcher.dispatchToWebhook(mockWebhook, mockContext);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(log.success).toBe(false);
    expect(log.statusCode).toBe(400);
  });

  it("gives up after max attempts on persistent 503 and notes the attempt count", async () => {
    const { repo, recordedLogs } = makeMockRepo();

    const mockFetch = vi.fn().mockResolvedValue({
      status: 503,
      ok: false,
      text: vi.fn().mockResolvedValue("unavailable"),
    } as unknown as Response);

    const dispatcher = createWebhookDispatcher(repo, mockFetch, { delayFn: () => Promise.resolve() });
    const log = await dispatcher.dispatchToWebhook(mockWebhook, mockContext);

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(log.success).toBe(false);
    expect(log.responseBody).toContain("After 3 attempts");
    expect(recordedLogs.length).toBe(1);
  });
});
