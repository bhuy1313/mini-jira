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

export interface WebhookRetryOptions {
  /** Total attempts including the first try. Default 3. */
  maxAttempts?: number;
  /** Base backoff in ms; actual wait is base * 2^(attempt-1). Default 500. */
  baseDelayMs?: number;
  /** Overridable for fast unit tests. */
  delayFn?: (ms: number) => Promise<void>;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 5000;

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Network errors, 429 and 5xx deserve another try; other 4xx will fail the same way. */
function isRetryable(statusCode: number | null): boolean {
  return statusCode === null || statusCode === 429 || statusCode >= 500;
}

export function createWebhookDispatcher(
  repo: WebhookRepository,
  fetchFn: typeof fetch = fetch,
  retryOptions?: WebhookRetryOptions,
): WebhookDispatcher {
  const maxAttempts = Math.max(1, retryOptions?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
  const baseDelayMs = retryOptions?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const delayFn = retryOptions?.delayFn ?? defaultDelay;

  async function attemptDelivery(
    url: string,
    headers: Record<string, string>,
    body: string,
  ): Promise<{ statusCode: number | null; responseBody: string | null; success: boolean }> {
    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let success = false;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetchFn(url, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        statusCode = res.status;
        success = res.ok;
        const text = await res.text().catch(() => "");
        responseBody = text.slice(0, 1000) || null;
      } catch (err: unknown) {
        statusCode = null;
        success = false;
        const message = err instanceof Error ? err.message : "Request failed";
        responseBody = `Error: ${message}`;
      }

      if (success || !isRetryable(statusCode) || attempt === maxAttempts) {
        if (!success && attempt > 1) {
          responseBody = `After ${attempt} attempts. Last: ${responseBody ?? "(empty)"}`;
        }
        return { statusCode, responseBody, success };
      }
      await delayFn(baseDelayMs * 2 ** (attempt - 1));
    }
    return { statusCode, responseBody, success };
  }

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
      const { statusCode, responseBody, success } = await attemptDelivery(
        webhook.url,
        headers,
        body,
      );

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
