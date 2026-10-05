"use server";

import { revalidatePath } from "next/cache";

import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import { publishBoardUpdate } from "@/features/live/live-publisher";
import { prismaSprintRepository } from "@/features/sprints/prisma-sprint-repository";
import { prismaSprintReportRepository } from "@/features/sprints/prisma-sprint-report-repository";
import { createSprintService } from "@/features/sprints/sprint-service";
import {
  createSprintReportService,
  type SprintReportData,
} from "@/features/sprints/sprint-report-service";
import { requireProjectActor } from "@/features/workspaces/session";

const sprintService = createSprintService(prismaSprintRepository);
const sprintReportService = createSprintReportService(prismaSprintReportRepository);

function message(error: unknown): string {
  if (error instanceof UnauthorizedError || error instanceof ValidationError) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

function projectPaths(workspaceId: string, projectId: string): string[] {
  return [
    `/workspaces/${workspaceId}/projects/${projectId}`,
    `/workspaces/${workspaceId}/projects/${projectId}/settings`,
  ];
}

function parseDate(value: string | null): Date | null | undefined {
  if (value === null || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
}

/** Create a sprint — Owner/Admin (Mốc 15). */
export async function createSprintAction(
  workspaceId: string,
  projectId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  const name = String(formData.get("name") || "");
  const goal = String(formData.get("goal") || "") || null;
  const startDate = parseDate(String(formData.get("startDate") || "") || null);
  const endDate = parseDate(String(formData.get("endDate") || "") || null);
  try {
    await sprintService.createSprint(actor, {
      name,
      goal: goal || null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
    });
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of projectPaths(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}

/** Update a sprint (name, goal, dates) — Owner/Admin (Mốc 15). */
export async function updateSprintAction(
  workspaceId: string,
  projectId: string,
  sprintId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  const name = String(formData.get("name") || "");
  const goal = String(formData.get("goal") || "") || null;
  const startDate = parseDate(String(formData.get("startDate") || "") || null);
  const endDate = parseDate(String(formData.get("endDate") || "") || null);
  try {
    await sprintService.updateSprint(actor, sprintId, {
      name: name.length > 0 ? name : undefined,
      goal: goal || null,
      startDate: startDate ?? null,
      endDate: endDate ?? null,
    });
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of projectPaths(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}

/** Delete a sprint — Owner/Admin; tasks fall back to backlog (Mốc 15). */
export async function deleteSprintAction(
  workspaceId: string,
  projectId: string,
  sprintId: string,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await sprintService.deleteSprint(actor, sprintId);
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of projectPaths(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}

/** Reorder sprints — Owner/Admin (Mốc 15). */
export async function reorderSprintsAction(
  workspaceId: string,
  projectId: string,
  sprintIds: string[],
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await sprintService.reorderSprints(actor, sprintIds);
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of projectPaths(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}

/** Get sprint burndown and report data (P6). */
export async function getSprintReportAction(
  workspaceId: string,
  projectId: string,
  sprintId: string,
  metric: "hours" | "issues" = "hours",
): Promise<{ data?: SprintReportData; error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    const data = await sprintReportService.getSprintReport(actor, {
      sprintId,
      metric,
    });
    return { data };
  } catch (error) {
    return { error: message(error) };
  }
}