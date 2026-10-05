import type { WebhookEventContext, WebhookFormat } from "./webhook-types";

/**
 * Format generic standard JSON payload
 */
export function formatGenericPayload(ctx: WebhookEventContext): Record<string, unknown> {
  return {
    event: ctx.event,
    timestamp: ctx.timestamp,
    project: ctx.project,
    actor: ctx.actor,
    task: ctx.task,
    comment: ctx.comment,
    changes: ctx.changes,
  };
}

/**
 * Format payload for Slack Incoming Webhook (Block Kit)
 */
export function formatSlackPayload(ctx: WebhookEventContext): Record<string, unknown> {
  const eventTitles: Record<string, string> = {
    "task.created": "✨ New Task Created",
    "task.status_changed": "🔄 Task Status Changed",
    "task.priority_changed": "⚡ Task Priority Changed",
    "task.assigned": "👤 Task Assignee Updated",
    "task.deleted": "🗑️ Task Deleted",
    "comment.created": "💬 New Comment Added",
    ping: "🔔 Webhook Ping / Test Connection",
  };

  const headerText = eventTitles[ctx.event] ?? `📢 Event: ${ctx.event}`;
  const actorName = ctx.actor?.name || ctx.actor?.email || "System";
  const projectName = ctx.project.name || "Project";

  let detailText = `*Project:* ${projectName} | *By:* ${actorName}`;
  if (ctx.task) {
    detailText += `\n*Task:* *${ctx.task.title}*`;
    if (ctx.task.statusName) {
      detailText += ` [${ctx.task.statusName}]`;
    }
    if (ctx.task.priority) {
      detailText += ` (${ctx.task.priority} Priority)`;
    }
  }

  if (ctx.changes) {
    detailText += `\n*Change:* ${ctx.changes.field}: \`${String(ctx.changes.oldValue ?? "none")}\` ➔ \`${String(ctx.changes.newValue ?? "none")}\``;
  }

  if (ctx.comment) {
    detailText += `\n> ${ctx.comment.content.slice(0, 300)}`;
  }

  return {
    text: `${headerText} in ${projectName}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: headerText,
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: detailText,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Mini Jira • ${new Date(ctx.timestamp).toLocaleString()}`,
          },
        ],
      },
    ],
  };
}

/**
 * Format payload for Discord Webhook (Rich Embed)
 */
export function formatDiscordPayload(ctx: WebhookEventContext): Record<string, unknown> {
  const eventColors: Record<string, number> = {
    "task.created": 0x22c55e, // Green
    "task.status_changed": 0x3b82f6, // Blue
    "task.priority_changed": 0xf59e0b, // Amber
    "task.assigned": 0x8b5cf6, // Purple
    "task.deleted": 0xef4444, // Red
    "comment.created": 0x06b6d4, // Cyan
    ping: 0x6366f1, // Indigo
  };

  const eventTitles: Record<string, string> = {
    "task.created": "New Task Created",
    "task.status_changed": "Task Status Changed",
    "task.priority_changed": "Task Priority Changed",
    "task.assigned": "Task Assigned",
    "task.deleted": "Task Deleted",
    "comment.created": "New Comment",
    ping: "Webhook Ping Test",
  };

  const title = eventTitles[ctx.event] ?? ctx.event;
  const color = eventColors[ctx.event] ?? 0x2563eb;
  const actorName = ctx.actor?.name || ctx.actor?.email || "System";

  const fields: Array<{ name: string; value: string; inline?: boolean }> = [
    { name: "Project", value: ctx.project.name, inline: true },
    { name: "Triggered By", value: actorName, inline: true },
  ];

  if (ctx.task) {
    fields.push({ name: "Task", value: ctx.task.title, inline: false });
    if (ctx.task.statusName) {
      fields.push({ name: "Status", value: ctx.task.statusName, inline: true });
    }
    if (ctx.task.priority) {
      fields.push({ name: "Priority", value: ctx.task.priority, inline: true });
    }
  }

  if (ctx.changes) {
    fields.push({
      name: `Change (${ctx.changes.field})`,
      value: `${String(ctx.changes.oldValue ?? "none")} ➔ ${String(ctx.changes.newValue ?? "none")}`,
      inline: false,
    });
  }

  if (ctx.comment) {
    fields.push({
      name: "Comment Content",
      value: ctx.comment.content.slice(0, 500),
      inline: false,
    });
  }

  return {
    embeds: [
      {
        title,
        color,
        fields,
        timestamp: ctx.timestamp,
        footer: {
          text: "Mini Jira Notifications",
        },
      },
    ],
  };
}

/**
 * Main dispatcher payload formatter
 */
export function formatWebhookPayload(
  format: WebhookFormat,
  ctx: WebhookEventContext,
): Record<string, unknown> {
  switch (format) {
    case "Slack":
      return formatSlackPayload(ctx);
    case "Discord":
      return formatDiscordPayload(ctx);
    case "Generic":
    default:
      return formatGenericPayload(ctx);
  }
}
