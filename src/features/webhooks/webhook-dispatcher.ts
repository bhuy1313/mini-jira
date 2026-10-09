import { createHmac, randomUUID } from "node:crypto";
import { logger } from "@/lib/logger";
import { formatWebhookPayload } from "./formatters";
import type { WebhookRepository } from "./prisma-webhook-repository";
import type {
  WebhookDeliveryLogRecord,
  WebhookEventContext,
  WebhookRecord,
} from "./webhook-types";

export interface WebhookDispatcher {
  dispatchToWebhook(
    webhook: WebhookRecord,
    ctx: WebhookEventContext,
  ): Promise<WebhookDeliveryLogRecord>;
  broadcastProjectEvent(
    projectId: string,
    ctx: WebhookEventContext,
  ): Promise<void>;
}

export function createWebhookDispatcher(
  repo: WebhookRepository,
  fetchFn: typeof fetch = fetch,
): WebhookDispatcher {
  return {
    async dispatchToWebhook(
      webhook: WebhookRecord,
      ctx: WebhookEventContext,
    ): Promise<WebhookDeliveryLogRecord> {
      const payload = formatWebhookPayload(webhook.format, ctx);
      const body = JSON.stringify(payload);
      const deliveryId = randomUUID();
      const timestamp = ctx.timestamp || new Date().toISOString();

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "MiniJira-Webhook-Dispatcher/1.0",
        "X-MiniJira-Event": ctx.event,
        "X-MiniJira-Delivery": deliveryId,
        "X-MiniJira-Timestamp": timestamp,
      };

      if (webhook.secret) {
        const signature = createHmac("sha256", webhook.secret)
          .update(body)
          .digest("hex");
        headers["X-MiniJira-Signature-256"] = `sha256=${signature}`;
      }

      const start = Date.now();
      let statusCode: number | null = null;
      let responseBody: string | null = null;
      let success = false;

      try {
        const res = await fetchFn(webhook.url, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(5000),
        });

        statusCode = res.status;
        success = res.ok;
        const text = await res.text().catch(() => "");
        responseBody = text.slice(0, 1000) || null;
      } catch (err: unknown) {
        success = false;
        const message = err instanceof Error ? err.message : "Request failed";
        responseBody = `Error: ${message}`;
      }

      const durationMs = Date.now() - start;

      const log = await repo.recordDeliveryLog({
        webhookId: webhook.id,
        event: ctx.event,
        statusCode,
        responseBody,
        durationMs,
        success,
      });

      return log;
    },

    async broadcastProjectEvent(
      projectId: string,
      ctx: WebhookEventContext,
    ): Promise<void> {
      try {
        const webhooks = await repo.listActiveWebhooksByProjectAndEvent(
          projectId,
          ctx.event,
        );

        if (webhooks.length === 0) return;

        // Non-blocking parallel dispatch with timeout guard
        await Promise.allSettled(
          webhooks.map((wh) => this.dispatchToWebhook(wh, ctx)),
        );
      } catch (err) {
        logger.error({ err }, "Webhook broadcastProjectEvent error");
      }
    },
  };
}
