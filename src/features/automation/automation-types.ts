import type { Priority } from "@/features/authorization/permissions";

export const RULE_TRIGGER_TYPES = [
  "TaskCreated",
  "StatusChanged",
  "PriorityChanged",
] as const;
export type RuleTriggerType = (typeof RULE_TRIGGER_TYPES)[number];

export const RULE_ACTION_TYPES = [
  "ChangeAssignee",
  "ChangePriority",
  "ChangeStatus",
  "AddComment",
] as const;
export type RuleActionType = (typeof RULE_ACTION_TYPES)[number];

export const EXECUTION_STATUSES = ["Success", "Failed", "Skipped"] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

export interface TaskCreatedTriggerConfig {
  statusId?: string;
  priority?: Priority;
  assigneeId?: string;
}

export interface StatusChangedTriggerConfig {
  fromStatusId?: string;
  toStatusId?: string;
}

export interface PriorityChangedTriggerConfig {
  fromPriority?: Priority;
  toPriority?: Priority;
}

export type TriggerConfig =
  | TaskCreatedTriggerConfig
  | StatusChangedTriggerConfig
  | PriorityChangedTriggerConfig
  | Record<string, unknown>
  | null;

export interface ChangeAssigneeActionConfig {
  assigneeId: string | null;
}

export interface ChangePriorityActionConfig {
  priority: Priority;
}

export interface ChangeStatusActionConfig {
  statusId: string;
}

export interface AddCommentActionConfig {
  comment: string;
  authorId?: string;
}

export type ActionConfig =
  | ChangeAssigneeActionConfig
  | ChangePriorityActionConfig
  | ChangeStatusActionConfig
  | AddCommentActionConfig
  | Record<string, unknown>;

export interface AutomationRuleRecord {
  id: string;
  projectId: string;
  name: string;
  enabled: boolean;
  triggerType: RuleTriggerType;
  triggerConfig: TriggerConfig;
  actionType: RuleActionType;
  actionConfig: ActionConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationExecutionLogRecord {
  id: string;
  ruleId: string;
  ruleName?: string;
  taskId: string;
  status: ExecutionStatus;
  message: string | null;
  createdAt: Date;
}

export interface TaskCreatedEvent {
  type: "TaskCreated";
  projectId: string;
  taskId: string;
  task: {
    id: string;
    statusId: string;
    priority: Priority;
    assigneeId: string | null;
  };
}

export interface StatusChangedEvent {
  type: "StatusChanged";
  projectId: string;
  taskId: string;
  fromStatusId: string;
  toStatusId: string;
}

export interface PriorityChangedEvent {
  type: "PriorityChanged";
  projectId: string;
  taskId: string;
  fromPriority: Priority;
  toPriority: Priority;
}

export type RuleTriggerEvent =
  | TaskCreatedEvent
  | StatusChangedEvent
  | PriorityChangedEvent;
