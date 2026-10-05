import type { ProjectActor } from "@/features/authorization/actor";
import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import { canManageWebhooks, type Role } from "@/features/authorization/permissions";
import type { WebhookRepository } from "./prisma-webhook-repository";
import type { WebhookDispatcher } from "./webhook-dispatcher";
import type {
  WebhookDeliveryLogRecord,
  WebhookEventContext,
  WebhookFormat,
  WebhookRecord,
} from "./webhook-types";

function effectiveRole(actor: ProjectActor): Role {
  return actor.projectRole || actor.role;
}

function requirePermission(actor: ProjectActor, allowed: boolean, msg: string): void {
  if (!allowed) {
    throw new UnauthorizedError(msg);
  }
}

function validateUrl(rawUrl: string): string {
  const url = rawUrl.trim();
  if (!url) {
    throw new ValidationError("Webhook URL is required.");
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new ValidationError("Webhook URL must use HTTP or HTTPS protocol.");
    }
    return parsed.toString();
  } catch {
    throw new ValidationError("Invalid Webhook URL format.");
  }
}

export interface WebhookService {
  createWebhook(
    actor: ProjectActor,
    projectId: string,
    input: {
      name: string;
      url: string;
      secret?: string | null;
      format: WebhookFormat;
      events: string[];
    },
  ): Promise<WebhookRecord>;

  listWebhooks(actor: ProjectActor, projectId: string): Promise<WebhookRecord[]>;

  updateWebhook(
    actor: ProjectActor,
    projectId: string,
    webhookId: string,
    data: {
      name?: string;
      url?: string;
      secret?: string | null;
      format?: WebhookFormat;
      events?: string[];
      enabled?: boolean;
    },
  ): Promise<WebhookRecord>;

  deleteWebhook(
    actor: ProjectActor,
    projectId: string,
    webhookId: string,
  ): Promise<void>;

  testPingWebhook(
    actor: ProjectActor,
    projectId: string,
    webhookId: string,
  ): Promise<WebhookDeliveryLogRecord>;

  listDeliveryLogs(
    actor: ProjectActor,
    projectId: string,
    webhookId?: string,
  ): Promise<WebhookDeliveryLogRecord[]>;
}

export function createWebhookService(
  repo: WebhookRepository,
  dispatcher?: WebhookDispatcher,
): WebhookService {
  return {
    async createWebhook(actor, projectId, input) {
      requirePermission(
        actor,
        canManageWebhooks(effectiveRole(actor)),
        "Only Owners and Admins can create webhooks.",
      );

      const name = input.name.trim();
      if (!name) {
        throw new ValidationError("Webhook name is required.");
      }
      if (name.length > 100) {
        throw new ValidationError("Webhook name cannot exceed 100 characters.");
      }

      const validUrl = validateUrl(input.url);
      const events = input.events && input.events.length > 0 ? input.events : ["task.created", "task.status_changed"];

      return repo.createWebhook({
        projectId,
        name,
        url: validUrl,
        secret: input.secret?.trim() || null,
        format: input.format,
        events,
      });
    },

    async listWebhooks(actor, projectId) {
      requirePermission(
        actor,
        true, // All project members can view configured webhooks
        "You do not have permission to view webhooks.",
      );
      return repo.listWebhooksByProject(projectId);
    },

    async updateWebhook(actor, projectId, webhookId, data) {
      requirePermission(
        actor,
        canManageWebhooks(effectiveRole(actor)),
        "Only Owners and Admins can update webhooks.",
      );

      const existing = await repo.getWebhookById(webhookId);
      if (!existing || existing.projectId !== projectId) {
        throw new ValidationError("Webhook not found.");
      }

      const updateData = { ...data };
      if (data.name !== undefined) {
        const trimmed = data.name.trim();
        if (!trimmed) throw new ValidationError("Webhook name cannot be empty.");
        updateData.name = trimmed;
      }
      if (data.url !== undefined) {
        updateData.url = validateUrl(data.url);
      }

      return repo.updateWebhook(webhookId, updateData);
    },

    async deleteWebhook(actor, projectId, webhookId) {
      requirePermission(
        actor,
        canManageWebhooks(effectiveRole(actor)),
        "Only Owners and Admins can delete webhooks.",
      );

      const existing = await repo.getWebhookById(webhookId);
      if (!existing || existing.projectId !== projectId) {
        throw new ValidationError("Webhook not found.");
      }

      await repo.deleteWebhook(webhookId);
    },

    async testPingWebhook(actor, projectId, webhookId) {
      requirePermission(
        actor,
        canManageWebhooks(effectiveRole(actor)),
        "Only Owners and Admins can test webhooks.",
      );

      const webhook = await repo.getWebhookById(webhookId);
      if (!webhook || webhook.projectId !== projectId) {
        throw new ValidationError("Webhook not found.");
      }

      const pingContext: WebhookEventContext = {
        event: "ping",
        timestamp: new Date().toISOString(),
        actor: {
          id: actor.userId,
        },
        project: {
          id: projectId,
          name: "Current Project",
          workspaceId: actor.workspaceId,
        },
        changes: {
          field: "test",
          oldValue: "disconnected",
          newValue: "connected",
        },
      };

      if (!dispatcher) {
        throw new ValidationError("Webhook dispatcher is not configured.");
      }

      return dispatcher.dispatchToWebhook(webhook, pingContext);
    },

    async listDeliveryLogs(actor, projectId, webhookId) {
      requirePermission(
        actor,
        canManageWebhooks(effectiveRole(actor)),
        "Only Owners and Admins can view webhook logs.",
      );

      if (webhookId) {
        return repo.listDeliveryLogsByWebhook(webhookId, 50);
      }
      return repo.listDeliveryLogsByProject(projectId, 50);
    },
  };
}
