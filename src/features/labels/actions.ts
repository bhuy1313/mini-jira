"use server";

import { revalidatePath } from "next/cache";

import { UnauthorizedError } from "@/features/authorization/errors";
import { prismaLabelRepository } from "@/features/labels/prisma-label-repository";
import { createLabelService } from "@/features/labels/label-service";
import { requireProjectActor } from "@/features/workspaces/session";

const labelService = createLabelService({ repo: prismaLabelRepository });

function message(error: unknown): string {
  if (error instanceof UnauthorizedError) return error.message;
  return "Something went wrong. Please try again.";
}

/** Revalidate project board + search + dashboard khi label đổi trên project. */
function projectPaths(workspaceId: string, projectId: string): string[] {
  return [`/workspaces/${workspaceId}/projects/${projectId}`];
}

/** Create a label — Owner/Admin (Mốc 10). */
export async function createLabelAction(
  workspaceId: string,
  projectId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  const name = String(formData.get("name") || "");
  const color = String(formData.get("color") || "");
  try {
    await labelService.createLabel(actor, projectId, { name, color });
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of projectPaths(workspaceId, projectId)) {
    revalidatePath(path);
  }
  return {};
}

/** Update a label — Owner/Admin (Mốc 10). */
export async function updateLabelAction(
  workspaceId: string,
  projectId: string,
  labelId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  const name = String(formData.get("name") || "");
  const color = String(formData.get("color") || "");
  try {
    await labelService.updateLabel(actor, labelId, {
      name: name.length > 0 ? name : undefined,
      color: color.length > 0 ? color : undefined,
    });
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of projectPaths(workspaceId, projectId)) {
    revalidatePath(path);
  }
  return {};
}

/** Delete a label — Owner/Admin (Mốc 10). */
export async function deleteLabelAction(
  workspaceId: string,
  projectId: string,
  labelId: string,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await labelService.deleteLabel(actor, labelId);
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of projectPaths(workspaceId, projectId)) {
    revalidatePath(path);
  }
  return {};
}

/** Attach a label to a task — any member (Mốc 10). */
export async function addLabelToTaskAction(
  workspaceId: string,
  projectId: string,
  taskId: string,
  labelId: string,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await labelService.addLabelToTask(actor, taskId, labelId);
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of projectPaths(workspaceId, projectId)) {
    revalidatePath(path);
  }
  return {};
}

/** Detach a label from a task — any member (Mốc 10). */
export async function removeLabelFromTaskAction(
  workspaceId: string,
  projectId: string,
  taskId: string,
  labelId: string,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await labelService.removeLabelFromTask(actor, taskId, labelId);
  } catch (error) {
    return { error: message(error) };
  }
  for (const path of projectPaths(workspaceId, projectId)) {
    revalidatePath(path);
  }
  return {};
}