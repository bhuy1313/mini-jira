"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { UnauthorizedError } from "@/features/authorization/errors";
import { PRIORITIES, type Priority } from "@/features/authorization/permissions";
import { requireProjectActor } from "@/features/workspaces/session";
import {
  RULE_ACTION_TYPES,
  RULE_TRIGGER_TYPES,
  type ActionConfig,
  type RuleActionType,
  type RuleTriggerType,
  type TriggerConfig,
} from "./automation-types";
import { createAutomationService } from "./automation-service";
import { prismaAutomationRepository } from "./prisma-automation-repository";

const automationService = createAutomationService({ repo: prismaAutomationRepository });

function message(error: unknown): string {
  if (error instanceof UnauthorizedError) return error.message;
  return "Something went wrong. Please try again.";
}

function settingsPath(workspaceId: string, projectId: string): string[] {
  return [
    `/workspaces/${workspaceId}/projects/${projectId}/settings`,
    `/workspaces/${workspaceId}/projects/${projectId}`,
  ];
}

const ruleNameSchema = z
  .string()
  .trim()
  .min(1, "Rule name is required.")
  .max(100, "Rule name must be at most 100 characters.");

const triggerTypeSchema = z.enum(RULE_TRIGGER_TYPES);
const actionTypeSchema = z.enum(RULE_ACTION_TYPES);

export async function createRuleAction(
  workspaceId: string,
  projectId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);

  const rawName = formData.get("name");
  const rawTriggerType = formData.get("triggerType");
  const rawActionType = formData.get("actionType");

  const parsedName = ruleNameSchema.safeParse(rawName);
  if (!parsedName.success) return { error: parsedName.error.issues[0]?.message };

  const parsedTriggerType = triggerTypeSchema.safeParse(rawTriggerType);
  if (!parsedTriggerType.success) return { error: "Invalid trigger type." };

  const parsedActionType = actionTypeSchema.safeParse(rawActionType);
  if (!parsedActionType.success) return { error: "Invalid action type." };

  const triggerType = parsedTriggerType.data as RuleTriggerType;
  const actionType = parsedActionType.data as RuleActionType;

  // Build triggerConfig
  let triggerConfig: TriggerConfig = null;
  if (triggerType === "TaskCreated") {
    const statusId = formData.get("trigger_statusId")?.toString().trim();
    const priority = formData.get("trigger_priority")?.toString().trim() as Priority;
    const assigneeId = formData.get("trigger_assigneeId")?.toString().trim();
    triggerConfig = {
      ...(statusId ? { statusId } : {}),
      ...(priority ? { priority } : {}),
      ...(assigneeId ? { assigneeId } : {}),
    };
  } else if (triggerType === "StatusChanged") {
    const fromStatusId = formData.get("trigger_fromStatusId")?.toString().trim();
    const toStatusId = formData.get("trigger_toStatusId")?.toString().trim();
    triggerConfig = {
      ...(fromStatusId ? { fromStatusId } : {}),
      ...(toStatusId ? { toStatusId } : {}),
    };
  } else if (triggerType === "PriorityChanged") {
    const fromPriority = formData.get("trigger_fromPriority")?.toString().trim() as Priority;
    const toPriority = formData.get("trigger_toPriority")?.toString().trim() as Priority;
    triggerConfig = {
      ...(fromPriority ? { fromPriority } : {}),
      ...(toPriority ? { toPriority } : {}),
    };
  }

  // Build actionConfig
  let actionConfig: ActionConfig;
  if (actionType === "ChangeAssignee") {
    const assigneeId = formData.get("action_assigneeId")?.toString().trim();
    actionConfig = { assigneeId: assigneeId ? assigneeId : null };
  } else if (actionType === "ChangePriority") {
    const priority = formData.get("action_priority")?.toString().trim() as Priority;
    if (!priority || !PRIORITIES.includes(priority)) {
      return { error: "Valid priority is required for action." };
    }
    actionConfig = { priority };
  } else if (actionType === "ChangeStatus") {
    const statusId = formData.get("action_statusId")?.toString().trim();
    if (!statusId) {
      return { error: "Status is required for action." };
    }
    actionConfig = { statusId };
  } else if (actionType === "AddComment") {
    const comment = formData.get("action_comment")?.toString().trim();
    if (!comment) {
      return { error: "Comment text is required for action." };
    }
    actionConfig = { comment };
  } else {
    return { error: "Invalid action type." };
  }

  try {
    await automationService.createRule(actor, projectId, {
      name: parsedName.data,
      triggerType,
      triggerConfig,
      actionType,
      actionConfig,
      enabled: true,
    });
  } catch (error) {
    return { error: message(error) };
  }

  for (const path of settingsPath(workspaceId, projectId)) {
    revalidatePath(path);
  }
  return {};
}

export async function updateRuleAction(
  workspaceId: string,
  projectId: string,
  ruleId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);

  const rawName = formData.get("name");
  const parsedName = ruleNameSchema.safeParse(rawName);
  if (!parsedName.success) return { error: parsedName.error.issues[0]?.message };

  try {
    await automationService.updateRule(actor, {
      ruleId,
      name: parsedName.data,
    });
  } catch (error) {
    return { error: message(error) };
  }

  for (const path of settingsPath(workspaceId, projectId)) {
    revalidatePath(path);
  }
  return {};
}

export async function toggleRuleAction(
  workspaceId: string,
  projectId: string,
  ruleId: string,
  enabled: boolean,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await automationService.toggleRule(actor, ruleId, enabled);
  } catch (error) {
    return { error: message(error) };
  }

  for (const path of settingsPath(workspaceId, projectId)) {
    revalidatePath(path);
  }
  return {};
}

export async function deleteRuleAction(
  workspaceId: string,
  projectId: string,
  ruleId: string,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await automationService.deleteRule(actor, ruleId);
  } catch (error) {
    return { error: message(error) };
  }

  for (const path of settingsPath(workspaceId, projectId)) {
    revalidatePath(path);
  }
  return {};
}
