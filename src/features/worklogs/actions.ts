"use server";

import { revalidatePath } from "next/cache";
import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import { createWorklogService } from "@/features/worklogs/worklog-service";
import { prismaWorklogRepository } from "@/features/worklogs/prisma-worklog-repository";
import { prismaTaskRepository } from "@/features/tasks/prisma-task-repository";
import { createTaskService } from "@/features/tasks/task-service";
import { parseDuration } from "@/features/worklogs/duration";
import { publishBoardUpdate } from "@/features/live/live-publisher";
import { requireActor, requireProjectActor } from "@/features/workspaces/session";
import {
  createTimesheetService,
  type TimesheetReport,
} from "./timesheet-service";
import { prismaWorkspaceRepository } from "@/features/workspaces/prisma-workspace-repository";

const worklogService = createWorklogService({
  repo: prismaWorklogRepository,
  taskRepo: prismaTaskRepository,
});

const taskService = createTaskService({
  repo: prismaTaskRepository,
});

function message(error: unknown): string {
  if (error instanceof UnauthorizedError || error instanceof ValidationError) {
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

function boardPath(workspaceId: string, projectId: string): string {
  return `/workspaces/${workspaceId}/projects/${projectId}`;
}

/**
 * Log work on a task.
 * Accepts duration string (e.g. "2h 30m", "1d", "45m") or raw minutes.
 */
export async function logWorkAction(
  workspaceId: string,
  projectId: string,
  taskId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  try {
    const actor = await requireProjectActor(workspaceId, projectId);
    const rawTime = String(formData.get("timeSpent") || "").trim();
    const parsedMinutes = parseDuration(rawTime);

    if (!parsedMinutes || parsedMinutes <= 0) {
      return { error: "Please enter a valid time spent (e.g. 2d 4h, 1h 30m, 45m)." };
    }

    const rawStartedAt = formData.get("startedAt");
    const startedAt = rawStartedAt ? new Date(String(rawStartedAt)) : new Date();
    const description = String(formData.get("description") || "").trim();

    await worklogService.logWork(actor, {
      taskId,
      timeSpentMinutes: parsedMinutes,
      startedAt: isNaN(startedAt.getTime()) ? new Date() : startedAt,
      description: description || null,
    });

    revalidatePath(boardPath(workspaceId, projectId));
    publishBoardUpdate(workspaceId, projectId, actor.userId);
    return {};
  } catch (error) {
    return { error: message(error) };
  }
}

/**
 * Update an existing worklog entry (author only).
 */
export async function updateWorklogAction(
  workspaceId: string,
  projectId: string,
  worklogId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  try {
    const actor = await requireProjectActor(workspaceId, projectId);
    const rawTime = String(formData.get("timeSpent") || "").trim();
    let timeSpentMinutes: number | undefined = undefined;

    if (rawTime) {
      const parsed = parseDuration(rawTime);
      if (!parsed || parsed <= 0) {
        return { error: "Please enter a valid time spent (e.g. 2d 4h, 1h 30m, 45m)." };
      }
      timeSpentMinutes = parsed;
    }

    const rawStartedAt = formData.get("startedAt");
    const startedAt = rawStartedAt ? new Date(String(rawStartedAt)) : undefined;
    const description = formData.has("description")
      ? String(formData.get("description") || "").trim()
      : undefined;

    await worklogService.updateWorklog(actor, worklogId, {
      timeSpentMinutes,
      startedAt: startedAt && !isNaN(startedAt.getTime()) ? startedAt : undefined,
      description,
    });

    revalidatePath(boardPath(workspaceId, projectId));
    publishBoardUpdate(workspaceId, projectId, actor.userId);
    return {};
  } catch (error) {
    return { error: message(error) };
  }
}

/**
 * Delete a worklog entry (author or Owner/Admin).
 */
export async function deleteWorklogAction(
  workspaceId: string,
  projectId: string,
  worklogId: string,
): Promise<{ error?: string }> {
  try {
    const actor = await requireProjectActor(workspaceId, projectId);
    await worklogService.deleteWorklog(actor, worklogId);

    revalidatePath(boardPath(workspaceId, projectId));
    publishBoardUpdate(workspaceId, projectId, actor.userId);
    return {};
  } catch (error) {
    return { error: message(error) };
  }
}

/**
 * Set original estimate for a task.
 * Accepts duration string (e.g. "2d 4h", "16h") or empty/null to clear.
 */
export async function setTaskEstimateAction(
  workspaceId: string,
  projectId: string,
  taskId: string,
  estimateInput: string | null,
): Promise<{ error?: string }> {
  try {
    const actor = await requireProjectActor(workspaceId, projectId);
    let estimateMinutes: number | null = null;

    if (estimateInput && estimateInput.trim().length > 0) {
      const parsed = parseDuration(estimateInput.trim());
      if (!parsed || parsed <= 0) {
        return { error: "Please enter a valid estimate format (e.g. 2d 4h, 16h, 30m)." };
      }
      estimateMinutes = parsed;
    }

    await taskService.updateTask(actor, taskId, "originalEstimateMinutes", estimateMinutes);

    revalidatePath(boardPath(workspaceId, projectId));
    publishBoardUpdate(workspaceId, projectId, actor.userId);
    return {};
  } catch (error) {
    return { error: message(error) };
  }
}

const timesheetService = createTimesheetService({
  repo: prismaWorklogRepository,
  getMembers: async (workspaceId: string) => {
    const members = await prismaWorkspaceRepository.listMembersWithUsers(workspaceId);
    return members.map((m) => ({
      id: m.userId,
      name: m.name,
      email: m.email,
    }));
  },
});

export async function getTimesheetReportAction(
  workspaceId: string,
  input: {
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    projectId?: string;
    authorId?: string;
  },
): Promise<{ report?: TimesheetReport; error?: string }> {
  try {
    const actor = await requireActor(workspaceId);
    const startDate = new Date(input.startDate);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(input.endDate);
    endDate.setHours(23, 59, 59, 999);

    const report = await timesheetService.getTimesheetReport(actor, {
      startDate,
      endDate,
      projectId: input.projectId || undefined,
      authorId: input.authorId || undefined,
    });

    return { report };
  } catch (error) {
    return { error: message(error) };
  }
}

