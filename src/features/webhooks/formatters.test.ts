import { describe, expect, it } from "vitest";
import {
  formatDiscordPayload,
  formatGenericPayload,
  formatSlackPayload,
  formatWebhookPayload,
} from "./formatters";
import type { WebhookEventContext } from "./webhook-types";

const mockContext: WebhookEventContext = {
  event: "task.status_changed",
  timestamp: "2026-10-01T12:00:00.000Z",
  actor: {
    id: "user-1",
    name: "Alice",
    email: "alice@demo.com",
  },
  project: {
    id: "proj-1",
    name: "Core Platform",
    workspaceId: "ws-1",
  },
  task: {
    id: "task-100",
    title: "Implement SSO",
    statusId: "st-done",
    statusName: "Done",
    priority: "High",
    projectId: "proj-1",
  },
  changes: {
    field: "status",
    oldValue: "In Progress",
    newValue: "Done",
  },
};

describe("Webhook Formatters", () => {
  it("formats standard Generic JSON payload with all fields", () => {
    const payload = formatGenericPayload(mockContext);
    expect(payload.event).toBe("task.status_changed");
    expect(payload.timestamp).toBe(mockContext.timestamp);
    expect(payload.task).toEqual(mockContext.task);
    expect(payload.changes).toEqual(mockContext.changes);
  });

  it("formats Slack Block Kit payload with header, section, and context", () => {
    const payload = formatSlackPayload(mockContext);
    expect(payload.text).toContain("Task Status Changed in Core Platform");
    expect(Array.isArray(payload.blocks)).toBe(true);

    const blocks = payload.blocks as Array<{ type: string; text?: { text: string } }>;
    expect(blocks[0].type).toBe("header");
    expect(blocks[1].text?.text).toContain("Implement SSO");
    expect(blocks[1].text?.text).toContain("Alice");
    expect(blocks[1].text?.text).toContain("In Progress");
  });

  it("formats Discord Rich Embed payload with embed colors and fields", () => {
    const payload = formatDiscordPayload(mockContext);
    expect(Array.isArray(payload.embeds)).toBe(true);

    const embeds = payload.embeds as Array<{
      title: string;
      color: number;
      fields: Array<{ name: string; value: string }>;
    }>;
    expect(embeds[0].title).toBe("Task Status Changed");
    expect(embeds[0].color).toBe(0x3b82f6);
    expect(embeds[0].fields.some((f) => f.name === "Task" && f.value === "Implement SSO")).toBe(true);
    expect(embeds[0].fields.some((f) => f.name === "Project" && f.value === "Core Platform")).toBe(true);
  });

  it("routes through formatWebhookPayload correctly", () => {
    const generic = formatWebhookPayload("Generic", mockContext);
    expect(generic.event).toBe("task.status_changed");

    const slack = formatWebhookPayload("Slack", mockContext);
    expect(slack.blocks).toBeDefined();

    const discord = formatWebhookPayload("Discord", mockContext);
    expect(discord.embeds).toBeDefined();
  });
});
