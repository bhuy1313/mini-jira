"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatTime } from "@/lib/dates";
import type { WebhookDeliveryLogRecord, WebhookRecord } from "@/features/webhooks/webhook-types";

export function WebhookLogsModal({
  open,
  onClose,
  webhook,
  logs,
}: {
  open: boolean;
  onClose: () => void;
  webhook: WebhookRecord | null;
  logs: WebhookDeliveryLogRecord[];
}) {
  const filteredLogs = webhook
    ? logs.filter((l) => l.webhookId === webhook.id)
    : logs;

  return (
    <Modal open={open} onClose={onClose} labelledBy="webhook-logs-title" panelClassName="max-w-2xl">
      <div className="flex flex-col p-6 max-h-[80vh]">
        <div className="border-b border-rule pb-3">
          <h2 id="webhook-logs-title" className="text-lg font-semibold text-ink">
            {webhook ? `Delivery Logs — ${webhook.name}` : "Webhook Delivery Logs"}
          </h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            Audit history of past outgoing webhook delivery attempts and responses.
          </p>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
          {filteredLogs.length === 0 ? (
            <div className="py-10 text-center text-xs text-ink-soft">
              No delivery logs recorded yet. Trigger an event or click &quot;Test&quot; to generate a delivery attempt.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-md border border-rule bg-paper p-3 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge tone={log.success ? "done" : "danger"}>
                      {log.success ? "Success" : "Failed"}
                    </Badge>
                    <span className="font-mono font-medium text-ink">
                      {log.event}
                    </span>
                    {log.statusCode ? (
                      <span className="font-mono text-ink-faint">
                        HTTP {log.statusCode}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-ink-faint">
                    <span>{log.durationMs}ms</span>
                    <span>•</span>
                    <span>{formatTime(log.createdAt)}</span>
                  </div>
                </div>

                {log.responseBody ? (
                  <div className="mt-2 rounded bg-panel p-2 font-mono text-[11px] text-ink-soft overflow-x-auto max-h-24">
                    {log.responseBody}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        <div className="mt-4 flex justify-end border-t border-rule pt-3">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
