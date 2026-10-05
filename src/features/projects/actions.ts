"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { UnauthorizedError } from "@/features/authorization/errors";
import { liveNotificationPublisher } from "@/features/notifications/live-notification-publisher-prisma";
import { createProjectService } from "@/features/projects/project-service";
import { prismaProjectRepository } from "@/features/projects/prisma-project-repository";
import { requireActor, requireProjectActor } from "@/features/workspaces/session";

const projectService = createProjectService({
  repo: prismaProjectRepository,
  notifications: liveNotificationPublisher,
});

const nameSchema = z
  .string()
  .trim()
  .min(1, "Project name is required.")
  .max(80, "Project name must be at most 80 characters.");

const createSchema = z.object({
  name: nameSchema,
  description: z.string().trim().max(500, "Description must be at most 500 characters.").optional(),
});

function message(error: unknown): string {
  if (error instanceof UnauthorizedError) return error.message;
  return "Something went wrong. Please try again.";
}

/** Create a project — Owner/Admin (FR-030). Redirects to the new project. */
export async function createProjectAction(
  workspaceId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  // No projectId yet — use workspace-level actor
  const actor = await requireActor(workspaceId);
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data." };
  }

  const project = await projectService.createProjectWithMember(actor, {
    name: parsed.data.name,
    description: parsed.data.description ?? null,
  });
  redirect(`/workspaces/${workspaceId}/projects/${project.id}`);
}

/** Update a project — Owner/Admin (FR-033). */
export async function updateProjectAction(
  workspaceId: string,
  projectId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  // H1: verify project belongs to workspace
  const actor = await requireProjectActor(workspaceId, projectId);
  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid data." };
  }

  try {
    await projectService.updateProject(actor, projectId, {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    });
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/workspaces/${workspaceId}/projects/${projectId}`);
  return {};
}

/** Archive a project — Owner/Admin (FR-034). */
export async function archiveProjectAction(
  workspaceId: string,
  projectId: string,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await projectService.archiveProject(actor, projectId);
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/workspaces/${workspaceId}/projects`);
  redirect(`/workspaces/${workspaceId}/projects`);
}

/** Restore a project — Owner/Admin (FR-035). */
export async function restoreProjectAction(
  workspaceId: string,
  projectId: string,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await projectService.restoreProject(actor, projectId);
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/workspaces/${workspaceId}/projects`);
  return {};
}

/** Permanent delete a project — Owner only (FR-036). */
export async function deleteProjectPermanentlyAction(
  workspaceId: string,
  projectId: string,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await projectService.deleteProjectPermanently(actor, projectId);
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath(`/workspaces/${workspaceId}/projects`);
  redirect(`/workspaces/${workspaceId}/projects`);
}
