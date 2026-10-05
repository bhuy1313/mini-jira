"use server";

import { revalidatePath } from "next/cache";

import { UnauthorizedError, ValidationError } from "@/features/authorization/errors";
import { publishBoardUpdate } from "@/features/live/live-publisher";
import { prismaStatusRepository } from "@/features/statuses/prisma-status-repository";
import { createStatusService } from "@/features/statuses/status-service";
import { requireProjectActor } from "@/features/workspaces/session";

const statusService = createStatusService(prismaStatusRepository);

function message(error: unknown): string {
  if (
    error instanceof UnauthorizedError ||
    error instanceof ValidationError
  ) {
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

/** Create a custom status — Owner/Admin (Mốc 12). */
export async function createStatusAction(
  workspaceId: string,
  projectId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  const name = String(formData.get("name") || "");
  try {
    await statusService.createStatus(actor, { name });
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of projectPaths(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}

/** Update a status (name, isDefault) — Owner/Admin (Mốc 12). */
export async function updateStatusAction(
  workspaceId: string,
  projectId: string,
  statusId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  const name = String(formData.get("name") || "");
  const isDefaultVal = formData.get("isDefault");
  const isDoneVal = formData.get("isDone");
  const isDefault = isDefaultVal !== null ? isDefaultVal === "true" || isDefaultVal === "on" : undefined;
  const isDone = isDoneVal !== null ? isDoneVal === "true" || isDoneVal === "on" : undefined;

  try {
    await statusService.updateStatus(actor, statusId, {
      name: name.length > 0 ? name : undefined,
      isDefault,
      isDone,
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

/** Delete a status — Owner/Admin (Mốc 12). */
export async function deleteStatusAction(
  workspaceId: string,
  projectId: string,
  statusId: string,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await statusService.deleteStatus(actor, statusId);
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of projectPaths(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}

/** Reorder statuses — Owner/Admin (Mốc 12). */
export async function reorderStatusesAction(
  workspaceId: string,
  projectId: string,
  statusIds: string[],
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await statusService.reorderStatuses(actor, statusIds);
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of projectPaths(workspaceId, projectId)) {
    revalidatePath(path);
  }
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}
