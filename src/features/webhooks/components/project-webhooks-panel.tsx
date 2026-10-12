"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { TrashIcon } from "@/components/ui/icons";
import { canManageWebhooks, type Role } from "@/features/authorization/permissions";
import {
  deleteWebhookAction,
  testWebhookPingAction,
  toggleWebhookAction,
} from "@/features/webhooks/actions";
import { CreateWebhookButton } from "./create-webhook-modal";
import { WebhookLogsModal } from "./webhook-logs-modal";
import { notifyDeleted, notifyError, notifyUpdated } from "@/lib/notify";
import type { WebhookDeliveryLogRecord, WebhookRecord } from "@/features/webhooks/webhook-types";

function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.length > 20) {
      return `${parsed.origin}${parsed.pathname.slice(0, 15)}...`;
    }
    return url;
  } catch {
    return url;
  }
}

export function ProjectWebhooksPanel({
  workspaceId,
  projectId,
  webhooks,
  logs,
  actorProjectRole,
}: {
  workspaceId: string;
  projectId: string;
  webhooks: WebhookRecord[];
  logs: WebhookDeliveryLogRecord[];
  actorProjectRole: Role;
}) {
  const canManage = canManageWebhooks(actorProjectRole);
  const [isPending, startTransition] = useTransition();
  const [activeWebhookForLogs, setActiveWebhookForLogs] = useState<WebhookRecord | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [testResults, setTestResults] = useState<
    Record<string, { success: boolean; statusCode?: number | null; durationMs?: number }>
  >({});

  function handleToggle(wh: WebhookRecord) {
    startTransition(async () => {
      const res = await toggleWebhookAction(workspaceId, projectId, wh.id, !wh.enabled);
      if (res?.error) {
        notifyError(res.error);
      } else {
        notifyUpdated("webhook");
      }
    });
  }

  function handleDelete(wh: WebhookRecord) {
    if (!confirm(`Delete webhook "${wh.name}"?`)) return;
    startTransition(async () => {
      const res = await deleteWebhookAction(workspaceId, projectId, wh.id);
      if (res?.error) {
        notifyError(res.error);
      } else {
        notifyDeleted("webhook");
      }
    });
  }

  function handleTestPing(wh: WebhookRecord) {
    startTransition(async () => {
      const res = await testWebhookPingAction(workspaceId, projectId, wh.id);
      if (res.error) {
        notifyError(res.error);
        return;
      }
      setTestResults((prev) => ({
        ...prev,
        [wh.id]: {
          success: Boolean(res.success),
          statusCode: res.statusCode,
          durationMs: res.durationMs,
        },
      }));
    });
  }

  function openLogs(wh?: WebhookRecord) {
    setActiveWebhookForLogs(wh || null);
    setLogsOpen(true);
  }

  return (
    <Panel>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-rule pb-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Webhooks & Integrations</h2>
          <p className="mt-1 text-sm text-ink-soft">
            Deliver outbound HTTP events to Slack, Discord, CI/CD pipelines, or external endpoints.
          </p>
        </div>
        {canManage ? (
          <div className="flex items-center gap-2">
            {logs.length > 0 ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => openLogs()}
                type="button"
              >
                All Logs ({logs.length})
              </Button>
            ) : null}
            <CreateWebhookButton workspaceId={workspaceId} projectId={projectId} />
          </div>
        ) : null}
      </div>

      {webhooks.length === 0 ? (
        <div className="py-8 text-center text-sm text-ink-soft">
          No webhooks configured for this project yet.
        </div>
      ) : (
        <div className="mt-4 divide-y divide-rule">
          {webhooks.map((wh) => {
            const testResult = testResults[wh.id];
            const formatTone =
              wh.format === "Slack"
                ? "info"
                : wh.format === "Discord"
                  ? "urgent"
                  : "neutral";

            return (
              <div
                key={wh.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-ink">{wh.name}</span>
                    <Badge tone={formatTone}>{wh.format}</Badge>
                    <Badge tone={wh.enabled ? "done" : "neutral"}>
                      {wh.enabled ? "Active" : "Disabled"}
                    </Badge>
                    {wh.secret ? (
                      <span className="rounded bg-rule px-1.5 py-0.5 text-[10px] font-mono text-ink-faint">
                        HMAC-SHA256
                      </span>
                    ) : null}
                  </div>

                  <p className="font-mono text-xs text-ink-soft truncate" title={wh.url}>
                    {maskUrl(wh.url)}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px] text-ink-faint">
                    <span>Events:</span>
                    {wh.events.map((ev) => (
                      <span
                        key={ev}
                        className="rounded border border-rule bg-paper px-1.5 py-0.5 font-mono text-[10px]"
                      >
                        {ev}
                      </span>
                    ))}
                  </div>

                  {testResult ? (
                    <div className="pt-1">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                          testResult.success ? "text-done" : "text-danger"
                        }`}
                      >
                        {testResult.success ? "✓ Test Passed" : "✗ Test Failed"}
                        {testResult.statusCode ? ` (HTTP ${testResult.statusCode})` : ""}
                        {testResult.durationMs ? ` • ${testResult.durationMs}ms` : ""}
                      </span>
                    </div>
                  ) : null}
                </div>

                {canManage ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleTestPing(wh)}
                      disabled={isPending}
                      title="Send test ping event"
                    >
                      Test
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openLogs(wh)}
                      disabled={isPending}
                    >
                      Logs
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleToggle(wh)}
                      disabled={isPending}
                    >
                      {wh.enabled ? "Disable" : "Enable"}
                    </Button>

                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(wh)}
                      disabled={isPending}
                      aria-label={`Delete webhook ${wh.name}`}
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <WebhookLogsModal
        open={logsOpen}
        onClose={() => setLogsOpen(false)}
        webhook={activeWebhookForLogs}
        logs={logs}
      />
    </Panel>
  );
}
