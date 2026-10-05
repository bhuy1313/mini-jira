export const WEBHOOK_FORMATS = ["Generic", "Slack", "Discord"] as const;
export type WebhookFormat = (typeof WEBHOOK_FORMATS)[number];

export const WEBHOOK_EVENT_TYPES = [
  "task.created",
  "task.status_changed",
  "task.priority_changed",
  "task.assigned",
  "task.deleted",
  "comment.created",
  "ping",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export interface WebhookRecord {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  format: WebhookFormat;
  events: string[];
  enabled: boolean;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WebhookDeliveryLogRecord {
  id: string;
  webhookId: string;
  event: string;
  statusCode: number | null;
  responseBody: string | null;
  durationMs: number;
  success: boolean;
  createdAt: Date;
}

export interface WebhookTaskPayloadData {
  id: string;
  title: string;
  description?: string | null;
  statusId: string;
  statusName?: string;
  priority: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  creatorId?: string;
  creatorName?: string;
  dueDate?: string | null;
  projectId: string;
  projectName?: string;
  workspaceId?: string;
}

export interface WebhookEventContext {
  event: WebhookEventType;
  timestamp: string;
  actor?: {
    id: string;
    name?: string;
    email?: string;
  };
  project: {
    id: string;
    name: string;
    workspaceId: string;
  };
  task?: WebhookTaskPayloadData;
  comment?: {
    id: string;
    content: string;
    authorName?: string;
  };
  changes?: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  };
}
