"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import { requireProjectActor } from "@/features/workspaces/session";
import { prismaWebhookRepository } from "./prisma-webhook-repository";
import { createWebhookService } from "./webhook-service";
import { webhookDispatcher } from "./webhook-dispatcher-prisma";
import { WEBHOOK_FORMATS, type WebhookFormat } from "./webhook-types";

const webhookService = createWebhookService(prismaWebhookRepository, webhookDispatcher);

function message(error: unknown): string {
  if (error instanceof UnauthorizedError || error instanceof ValidationError) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

function settingsPath(workspaceId: string, projectId: string): string {
  return `/workspaces/${workspaceId}/projects/${projectId}/settings`;
}

const createWebhookSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  url: z.string().trim().url("Invalid Webhook URL format"),
  secret: z.string().trim().optional(),
  format: z.enum(WEBHOOK_FORMATS).default("Generic"),
  events: z.array(z.string()).min(1, "Select at least one event"),
});

export async function createWebhookAction(
  workspaceId: string,
  projectId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);

  const name = String(formData.get("name") || "").trim();
  const url = String(formData.get("url") || "").trim();
  const secret = String(formData.get("secret") || "").trim() || undefined;
  const format = (String(formData.get("format") || "Generic") as WebhookFormat) || "Generic";
  const events = formData.getAll("events").map(String).filter(Boolean);

  const parsed = createWebhookSchema.safeParse({
    name,
    url,
    secret,
    format,
    events: events.length > 0 ? events : ["task.created", "task.status_changed"],
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data." };
  }

  try {
    await webhookService.createWebhook(actor, projectId, {
      name: parsed.data.name,
      url: parsed.data.url,
      secret: parsed.data.secret ?? null,
      format: parsed.data.format,
      events: parsed.data.events,
    });
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath(settingsPath(workspaceId, projectId));
  return {};
}

export async function toggleWebhookAction(
  workspaceId: string,
  projectId: string,
  webhookId: string,
  enabled: boolean,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);

  try {
    await webhookService.updateWebhook(actor, projectId, webhookId, {
      enabled,
    });
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath(settingsPath(workspaceId, projectId));
  return {};
}

export async function deleteWebhookAction(
  workspaceId: string,
  projectId: string,
  webhookId: string,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);

  try {
    await webhookService.deleteWebhook(actor, projectId, webhookId);
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath(settingsPath(workspaceId, projectId));
  return {};
}

export async function testWebhookPingAction(
  workspaceId: string,
  projectId: string,
  webhookId: string,
): Promise<{ error?: string; success?: boolean; statusCode?: number | null; durationMs?: number }> {
  const actor = await requireProjectActor(workspaceId, projectId);

  try {
    const log = await webhookService.testPingWebhook(actor, projectId, webhookId);
    revalidatePath(settingsPath(workspaceId, projectId));
    return {
      success: log.success,
      statusCode: log.statusCode,
      durationMs: log.durationMs,
    };
  } catch (error) {
    return { error: message(error) };
  }
}
