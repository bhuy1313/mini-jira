import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type {
  WebhookDeliveryLogRecord,
  WebhookFormat,
  WebhookRecord,
} from "./webhook-types";

export interface CreateWebhookInput {
  projectId: string;
  name: string;
  url: string;
  secret?: string | null;
  format: WebhookFormat;
  events: string[];
}

export interface WebhookRepository {
  createWebhook(input: CreateWebhookInput): Promise<WebhookRecord>;
  getWebhookById(id: string): Promise<WebhookRecord | null>;
  listWebhooksByProject(projectId: string): Promise<WebhookRecord[]>;
  listActiveWebhooksByProjectAndEvent(
    projectId: string,
    event: string,
  ): Promise<WebhookRecord[]>;
  updateWebhook(
    id: string,
    data: {
      name?: string;
      url?: string;
      secret?: string | null;
      format?: WebhookFormat;
      events?: string[];
      enabled?: boolean;
    },
  ): Promise<WebhookRecord>;
  deleteWebhook(id: string): Promise<void>;
  recordDeliveryLog(log: {
    webhookId: string;
    event: string;
    statusCode: number | null;
    responseBody: string | null;
    durationMs: number;
    success: boolean;
  }): Promise<WebhookDeliveryLogRecord>;
  listDeliveryLogsByWebhook(
    webhookId: string,
    limit?: number,
  ): Promise<WebhookDeliveryLogRecord[]>;
  listDeliveryLogsByProject(
    projectId: string,
    limit?: number,
  ): Promise<WebhookDeliveryLogRecord[]>;
}

export const prismaWebhookRepository: WebhookRepository = {
  async createWebhook(input: CreateWebhookInput): Promise<WebhookRecord> {
    const id = randomUUID();
    const created = await prisma.webhook.create({
      data: {
        id,
        projectId: input.projectId,
        name: input.name,
        url: input.url,
        secret: input.secret ?? null,
        format: input.format,
        events: input.events,
        enabled: true,
      },
    });

    return {
      id: created.id,
      name: created.name,
      url: created.url,
      secret: created.secret,
      format: created.format as WebhookFormat,
      events: (created.events as string[]) || [],
      enabled: created.enabled,
      projectId: created.projectId,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    };
  },

  async getWebhookById(id: string): Promise<WebhookRecord | null> {
    const found = await prisma.webhook.findUnique({
      where: { id },
    });
    if (!found) return null;

    return {
      id: found.id,
      name: found.name,
      url: found.url,
      secret: found.secret,
      format: found.format as WebhookFormat,
      events: (found.events as string[]) || [],
      enabled: found.enabled,
      projectId: found.projectId,
      createdAt: found.createdAt,
      updatedAt: found.updatedAt,
    };
  },

  async listWebhooksByProject(projectId: string): Promise<WebhookRecord[]> {
    const list = await prisma.webhook.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });

    return list.map((w) => ({
      id: w.id,
      name: w.name,
      url: w.url,
      secret: w.secret,
      format: w.format as WebhookFormat,
      events: (w.events as string[]) || [],
      enabled: w.enabled,
      projectId: w.projectId,
      createdAt: w.createdAt,
      updatedAt: w.updatedAt,
    }));
  },

  async listActiveWebhooksByProjectAndEvent(
    projectId: string,
    event: string,
  ): Promise<WebhookRecord[]> {
    const list = await prisma.webhook.findMany({
      where: {
        projectId,
        enabled: true,
      },
    });

    // Filter by subscribed events
    return list
      .filter((w) => {
        const events = (w.events as string[]) || [];
        return events.includes(event) || events.includes("*");
      })
      .map((w) => ({
        id: w.id,
        name: w.name,
        url: w.url,
        secret: w.secret,
        format: w.format as WebhookFormat,
        events: (w.events as string[]) || [],
        enabled: w.enabled,
        projectId: w.projectId,
        createdAt: w.createdAt,
        updatedAt: w.updatedAt,
      }));
  },

  async updateWebhook(
    id: string,
    data: {
      name?: string;
      url?: string;
      secret?: string | null;
      format?: WebhookFormat;
      events?: string[];
      enabled?: boolean;
    },
  ): Promise<WebhookRecord> {
    const updated = await prisma.webhook.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.url !== undefined && { url: data.url }),
        ...(data.secret !== undefined && { secret: data.secret }),
        ...(data.format !== undefined && { format: data.format }),
        ...(data.events !== undefined && { events: data.events }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      url: updated.url,
      secret: updated.secret,
      format: updated.format as WebhookFormat,
      events: (updated.events as string[]) || [],
      enabled: updated.enabled,
      projectId: updated.projectId,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  },

  async deleteWebhook(id: string): Promise<void> {
    await prisma.webhook.delete({
      where: { id },
    });
  },

  async recordDeliveryLog(log: {
    webhookId: string;
    event: string;
    statusCode: number | null;
    responseBody: string | null;
    durationMs: number;
    success: boolean;
  }): Promise<WebhookDeliveryLogRecord> {
    const id = randomUUID();
    const created = await prisma.webhookDeliveryLog.create({
      data: {
        id,
        webhookId: log.webhookId,
        event: log.event,
        statusCode: log.statusCode,
        responseBody: log.responseBody,
        durationMs: log.durationMs,
        success: log.success,
      },
    });

    return {
      id: created.id,
      webhookId: created.webhookId,
      event: created.event,
      statusCode: created.statusCode,
      responseBody: created.responseBody,
      durationMs: created.durationMs,
      success: created.success,
      createdAt: created.createdAt,
    };
  },

  async listDeliveryLogsByWebhook(
    webhookId: string,
    limit = 20,
  ): Promise<WebhookDeliveryLogRecord[]> {
    const list = await prisma.webhookDeliveryLog.findMany({
      where: { webhookId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return list.map((l) => ({
      id: l.id,
      webhookId: l.webhookId,
      event: l.event,
      statusCode: l.statusCode,
      responseBody: l.responseBody,
      durationMs: l.durationMs,
      success: l.success,
      createdAt: l.createdAt,
    }));
  },

  async listDeliveryLogsByProject(
    projectId: string,
    limit = 50,
  ): Promise<WebhookDeliveryLogRecord[]> {
    const list = await prisma.webhookDeliveryLog.findMany({
      where: {
        webhook: { projectId },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return list.map((l) => ({
      id: l.id,
      webhookId: l.webhookId,
      event: l.event,
      statusCode: l.statusCode,
      responseBody: l.responseBody,
      durationMs: l.durationMs,
      success: l.success,
      createdAt: l.createdAt,
    }));
  },
};
