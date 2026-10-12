"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/inputs";
import { Modal } from "@/components/ui/modal";
import { PlusIcon } from "@/components/ui/icons";
import { createWebhookAction } from "@/features/webhooks/actions";
import { notifyCreated, notifyError } from "@/lib/notify";
import { WEBHOOK_EVENT_TYPES, type WebhookEventType, type WebhookFormat } from "@/features/webhooks/webhook-types";

const EVENT_LABELS: Record<WebhookEventType, string> = {
  "task.created": "Task Created",
  "task.status_changed": "Task Status Changed",
  "task.priority_changed": "Task Priority Changed",
  "task.assigned": "Task Assignee Changed",
  "task.deleted": "Task Deleted",
  "comment.created": "New Comment Added",
  ping: "Ping / Test Connection",
};

export function CreateWebhookModal({
  open,
  onClose,
  workspaceId,
  projectId,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  projectId: string;
}) {
  const [format, setFormat] = useState<WebhookFormat>("Generic");
  const [selectedEvents, setSelectedEvents] = useState<string[]>([
    "task.created",
    "task.status_changed",
    "task.priority_changed",
    "task.assigned",
    "task.deleted",
    "comment.created",
  ]);

  const [state, formAction, isPending] = useActionState(
    async (_prev: { error?: string }, formData: FormData) => {
      formData.set("format", format);
      for (const ev of selectedEvents) {
        formData.append("events", ev);
      }
      const res = await createWebhookAction(workspaceId, projectId, formData);
      if (!res.error) {
        notifyCreated("webhook");
        onClose();
      } else {
        notifyError(res.error);
      }
      return res;
    },
    {},
  );

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  function toggleEvent(ev: string) {
    setSelectedEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev],
    );
  }

  function selectAll() {
    setSelectedEvents(
      WEBHOOK_EVENT_TYPES.filter((e) => e !== "ping"),
    );
  }

  function clearAll() {
    setSelectedEvents([]);
  }

  return (
    <Modal open={open} onClose={onClose} labelledBy="create-webhook-title" panelClassName="max-w-lg">
      <form action={formAction} className="flex flex-col gap-4 p-6">
        <div>
          <h2 id="create-webhook-title" className="text-lg font-semibold text-ink">
            Add Project Webhook
          </h2>
          <p className="mt-1 text-xs text-ink-soft">
            Deliver real-time task and comment events to external platforms (Slack, Discord, or generic endpoints).
          </p>
        </div>

        {state.error ? (
          <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
            {state.error}
          </p>
        ) : null}

        <Field label="Webhook Name">
          <Input
            ref={inputRef}
            id="wh-name"
            name="name"
            placeholder="e.g. Slack #dev-alerts or CI Pipeline"
            required
            maxLength={100}
          />
        </Field>

        <Field label="Payload Format">
          <Select
            id="wh-format"
            value={format}
            onChange={(e) => setFormat(e.target.value as WebhookFormat)}
          >
            <option value="Generic">Generic JSON (Standard payload & Zapier)</option>
            <option value="Slack">Slack Incoming Webhook (Block Kit)</option>
            <option value="Discord">Discord Webhook (Rich Embeds)</option>
          </Select>
        </Field>

        <Field
          label="Endpoint URL"
          hint={
            format === "Slack"
              ? "Paste your Slack Incoming Webhook URL (https://hooks.slack.com/services/...)"
              : format === "Discord"
                ? "Paste your Discord Webhook URL (https://discord.com/api/webhooks/...)"
                : "HTTP or HTTPS URL endpoint"
          }
        >
          <Input
            id="wh-url"
            name="url"
            type="url"
            placeholder="https://example.com/api/webhook"
            required
          />
        </Field>

        {format === "Generic" ? (
          <Field
            label="Secret Key (Optional)"
            hint="Used to sign outgoing requests with HMAC-SHA256 (X-MiniJira-Signature-256 header)"
          >
            <Input
              id="wh-secret"
              name="secret"
              type="text"
              placeholder="e.g. whsec_abc123xyz"
            />
          </Field>
        ) : null}

        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink">Subscribed Events</span>
            <div className="flex items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={selectAll}
                className="text-primary hover:underline"
              >
                Select all
              </button>
              <span className="text-ink-faint">•</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-ink-soft hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {WEBHOOK_EVENT_TYPES.filter((e) => e !== "ping").map((ev) => {
              const checked = selectedEvents.includes(ev);
              return (
                <label
                  key={ev}
                  className="flex items-center gap-2 rounded-md border border-rule bg-paper p-2 text-xs text-ink cursor-pointer hover:bg-rule/50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleEvent(ev)}
                    className="size-3.5 rounded border-rule-strong text-primary focus:ring-primary"
                  />
                  <span>{EVENT_LABELS[ev]}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="mt-2 flex items-center justify-end gap-2 border-t border-rule pt-4">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending || selectedEvents.length === 0}>
            {isPending ? "Adding..." : "Add webhook"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateWebhookButton({
  workspaceId,
  projectId,
}: {
  workspaceId: string;
  projectId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <PlusIcon className="size-3.5" />
        Add webhook
      </Button>
      <CreateWebhookModal
        open={open}
        onClose={() => setOpen(false)}
        workspaceId={workspaceId}
        projectId={projectId}
      />
    </>
  );
}
