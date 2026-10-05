"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { UnauthorizedError } from "@/features/authorization/errors";
import { PRIORITIES, type TaskField } from "@/features/authorization/permissions";
import { publishBoardUpdate } from "@/features/live/live-publisher";
import { liveNotificationPublisher } from "@/features/notifications/live-notification-publisher-prisma";
import { prismaTaskRepository } from "@/features/tasks/prisma-task-repository";
import { createTaskService, type TaskRecord } from "@/features/tasks/task-service";
import { ruleEngine } from "@/features/automation/rule-engine";
import { webhookDispatcher } from "@/features/webhooks/webhook-dispatcher-prisma";
import { parseDuration } from "@/features/worklogs/duration";
import { requireProjectActor } from "@/features/workspaces/session";

const taskService = createTaskService({
  repo: prismaTaskRepository,
  notifications: liveNotificationPublisher,
  ruleEvaluator: ruleEngine,
  webhooks: webhookDispatcher,
});

const titleSchema = z
  .string()
  .trim()
  .min(1, "Title is required.")
  .max(200, "Title must be at most 200 characters.");
const descriptionSchema = z.string().trim().max(5000, "Description is too long.").optional();
const statusIdSchema = z.string().trim().min(1, "Status is required.");
const prioritySchema = z.enum(PRIORITIES);
const assigneeSchema = z
  .union([z.string().trim().min(1), z.literal("")])
  .transform((v) => (v ? v : null))
  .optional();
const dueDateSchema = z
  .union([z.string().trim().min(1), z.literal("")])
  .transform((v) => (v ? new Date(v) : null))
  .optional();

const createSchema = z.object({
  title: titleSchema,
  description: descriptionSchema,
  statusId: statusIdSchema.optional(),
  assigneeId: assigneeSchema,
  priority: prioritySchema.optional(),
  dueDate: dueDateSchema,
});

function message(error: unknown): string {
  if (error instanceof UnauthorizedError) return error.message;
  return "Something went wrong. Please try again.";
}

function boardPath(workspaceId: string, projectId: string): string[] {
  return [
    `/workspaces/${workspaceId}/projects/${projectId}`,
    `/workspaces/${workspaceId}/projects/${projectId}/settings`,
  ];
}

/** Create a task in an active project — any member (FR-040). */
export async function createTaskAction(
  workspaceId: string,
  projectId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    statusId: formData.get("statusId") || undefined,
    assigneeId: formData.get("assigneeId") || undefined,
    priority: formData.get("priority") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data." };
  }

  const rawEstimate = formData.get("originalEstimate");
  let originalEstimateMinutes: number | null = null;
  if (rawEstimate && typeof rawEstimate === "string" && rawEstimate.trim()) {
    originalEstimateMinutes = parseDuration(rawEstimate.trim());
  }

  try {
    await taskService.createTask(actor, projectId, {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      statusId: parsed.data.statusId,
      assigneeId: parsed.data.assigneeId ?? null,
      priority: parsed.data.priority ?? "Medium",
      dueDate: parsed.data.dueDate ?? null,
      originalEstimateMinutes,
    });
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of boardPath(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}

/** Move a task to the end of a target column — auth per status (FR-045, FR-051). */
export async function moveTaskAction(
  workspaceId: string,
  projectId: string,
  taskId: string,
  statusId: string,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  const parsed = statusIdSchema.safeParse(statusId);
  if (!parsed.success) return { error: "Invalid status." };
  try {
    // Menu/control move (FR-054): append to end of target column.
    await taskService.moveTask(actor, taskId, parsed.data, Number.MAX_SAFE_INTEGER);
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of boardPath(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}

/** Move a task to a specific index in a column — used by drag-and-drop. */
export async function moveTaskToIndexAction(
  workspaceId: string,
  projectId: string,
  taskId: string,
  statusId: string,
  targetIndex: number,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  const parsed = statusIdSchema.safeParse(statusId);
  if (!parsed.success) return { error: "Invalid status." };
  try {
    await taskService.moveTask(actor, taskId, parsed.data, targetIndex);
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of boardPath(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}

/** Update a single editable task field — policy enforced in service (FR-042, BR-008/009). */
export async function updateTaskFieldAction(
  workspaceId: string,
  projectId: string,
  taskId: string,
  field: string,
  value: string,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  const f = field as TaskField;

  try {
    switch (f) {
      case "title": {
        const r = titleSchema.safeParse(value);
        if (!r.success) return { error: r.error.issues[0]?.message };
        await taskService.updateTask(actor, taskId, "title", r.data);
        break;
      }
      case "description": {
        await taskService.updateTask(actor, taskId, "description", value);
        break;
      }
      case "status": {
        const r = statusIdSchema.safeParse(value);
        if (!r.success) return { error: "Invalid status." };
        await taskService.updateTask(actor, taskId, "status", r.data);
        break;
      }
      case "priority": {
        const r = prioritySchema.safeParse(value);
        if (!r.success) return { error: "Invalid priority." };
        await taskService.updateTask(actor, taskId, "priority", r.data);
        break;
      }
      case "assigneeId": {
        const r = assigneeSchema.safeParse(value);
        if (!r.success) return { error: "Invalid assignee." };
        await taskService.updateTask(actor, taskId, "assigneeId", r.data ?? null);
        break;
      }
      case "dueDate": {
        const r = dueDateSchema.safeParse(value);
        if (!r.success) return { error: "Invalid due date." };
        await taskService.updateTask(actor, taskId, "dueDate", r.data ?? null);
        break;
      }
      case "sprintId": {
        await taskService.updateTask(actor, taskId, "sprintId", value);
        break;
      }
      case "position": {
        return { error: "Position changes only through move." };
      }
      default:
        return { error: "Invalid field." };
    }
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of boardPath(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}

/** Delete a task — Owner/Admin (FR-043). */
export async function deleteTaskAction(
  workspaceId: string,
  projectId: string,
  taskId: string,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await taskService.deleteTask(actor, taskId);
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of boardPath(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}

/** Create a sub-task directly linked to a parent task */
export async function createSubtaskAction(
  workspaceId: string,
  projectId: string,
  parentId: string,
  formData: FormData,
): Promise<{ error?: string; task?: TaskRecord }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    statusId: formData.get("statusId") || undefined,
    assigneeId: formData.get("assigneeId") || undefined,
    priority: formData.get("priority") || undefined,
    dueDate: formData.get("dueDate") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data." };
  }

  try {
    const created = await taskService.createTask(actor, projectId, {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      statusId: parsed.data.statusId,
      assigneeId: parsed.data.assigneeId ?? null,
      priority: parsed.data.priority ?? "Medium",
      dueDate: parsed.data.dueDate ?? null,
      parentId,
    });
    for (const path of boardPath(workspaceId, projectId)) {
      revalidatePath(path);
    }
    publishBoardUpdate(workspaceId, projectId, actor.userId);
    return { task: created };
  } catch (error) {
    return { error: message(error) };
  }
}

/** Toggle subtask completion status (Done vs default) */
export async function toggleSubtaskDoneAction(
  workspaceId: string,
  projectId: string,
  subtaskId: string,
  isDone: boolean,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await taskService.toggleSubtaskDone(actor, subtaskId, isDone);
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of boardPath(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}

/** Unlink subtask so it becomes a standalone task */
export async function unlinkSubtaskAction(
  workspaceId: string,
  projectId: string,
  subtaskId: string,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await taskService.unlinkSubtask(actor, subtaskId);
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of boardPath(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}
