"use server";

import { revalidatePath } from "next/cache";

import { UnauthorizedError } from "@/features/authorization/errors";
import { ValidationError } from "@/features/authorization/errors";
import { createAttachmentService } from "@/features/attachments/attachment-service";
import { attachmentStorage } from "@/features/attachments/attachment-storage";
import { prismaAttachmentRepository } from "@/features/attachments/prisma-attachment-repository";
import { requireProjectActor } from "@/features/workspaces/session";

const attachmentService = createAttachmentService({
  repo: prismaAttachmentRepository,
  storage: attachmentStorage,
});

function message(error: unknown): string {
  if (error instanceof UnauthorizedError || error instanceof ValidationError) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

function boardPath(workspaceId: string, projectId: string): string {
  return `/workspaces/${workspaceId}/projects/${projectId}`;
}

/** Upload attachment vào task — mọi member (FR-090). */
export async function addAttachmentAction(
  workspaceId: string,
  projectId: string,
  taskId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "Please select a file to upload." };
  }
  if (file.size === 0) {
    return { error: "File is empty." };
  }

  try {
    const data = new Uint8Array(await file.arrayBuffer());
    await attachmentService.addAttachment(actor, taskId, {
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      data,
    });
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath(boardPath(workspaceId, projectId));
  return {};
}

/** Xoá attachment — uploader hoặc Owner/Admin (FR-092). */
export async function deleteAttachmentAction(
  workspaceId: string,
  projectId: string,
  attachmentId: string,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await attachmentService.deleteAttachment(actor, attachmentId);
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath(boardPath(workspaceId, projectId));
  return {};
}