"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { UnauthorizedError } from "@/features/authorization/errors";
import { createCommentService } from "@/features/comments/comment-service";
import { prismaCommentRepository } from "@/features/comments/prisma-comment-repository";
import { publishBoardUpdate } from "@/features/live/live-publisher";
import { liveNotificationPublisher } from "@/features/notifications/live-notification-publisher-prisma";
import { webhookDispatcher } from "@/features/webhooks/webhook-dispatcher-prisma";
import { requireProjectActor } from "@/features/workspaces/session";

const commentService = createCommentService({
  repo: prismaCommentRepository,
  notifications: liveNotificationPublisher,
  webhooks: webhookDispatcher,
});

const contentSchema = z
  .string()
  .trim()
  .min(1, "Comment content cannot be empty.")
  .max(2000, "Comment is too long (max 2000 characters).");

function message(error: unknown): string {
  if (error instanceof UnauthorizedError) return error.message;
  return "Something went wrong. Please try again.";
}

function boardPath(workspaceId: string, projectId: string): string {
  return `/workspaces/${workspaceId}/projects/${projectId}`;
}

/** Thêm comment vào task — mọi member (FR-060). */
export async function addCommentAction(
  workspaceId: string,
  projectId: string,
  taskId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  const parsed = contentSchema.safeParse(formData.get("content"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid comment content." };
  }

  try {
    await commentService.addComment(actor, taskId, parsed.data);
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath(boardPath(workspaceId, projectId));
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}

/** Sửa comment — chỉ tác giả (FR-062). */
export async function updateCommentAction(
  workspaceId: string,
  projectId: string,
  commentId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  const parsed = contentSchema.safeParse(formData.get("content"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid comment content." };
  }

  try {
    await commentService.updateComment(actor, commentId, parsed.data);
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath(boardPath(workspaceId, projectId));
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}

/** Xoá comment — tác giả hoặc Owner/Admin (FR-063). */
export async function deleteCommentAction(
  workspaceId: string,
  projectId: string,
  commentId: string,
): Promise<{ error?: string }> {
  const actor = await requireProjectActor(workspaceId, projectId);
  try {
    await commentService.deleteComment(actor, commentId);
  } catch (error) {
    return { error: message(error) };
  }

  revalidatePath(boardPath(workspaceId, projectId));
  publishBoardUpdate(workspaceId, projectId, actor.userId);
  return {};
}
