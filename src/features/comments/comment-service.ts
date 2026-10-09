import type { Actor } from "@/features/authorization/actor";
import { effectiveRole, requirePermission } from "@/features/authorization/actor";
import { UnauthorizedError } from "@/features/authorization/errors";
import {
  canAddComment,
  canDeleteComment,
  canEditComment,
  canViewComments,
} from "@/features/authorization/permissions";
import type { NotificationPublisher } from "@/features/notifications/notification-service";
import type { WebhookDispatcher } from "@/features/webhooks/webhook-dispatcher";
import { logger } from "@/lib/logger";

export interface CommentAuthorInfo {
  id: string;
  name: string;
  email: string;
}

export interface CommentRecord {
  id: string;
  taskId: string;
  workspaceId: string;
  projectId: string;
  authorId: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  author?: CommentAuthorInfo;
}

export interface CommentRepository {
  getComment(commentId: string): Promise<CommentRecord | null>;
  listCommentsByTask(taskId: string): Promise<CommentRecord[]>;
  getTaskWorkspaceId(taskId: string): Promise<string | null>;
  getTaskProjectId(taskId: string): Promise<string | null>;
  getTaskMeta(taskId: string): Promise<{ title: string; projectId: string; workspaceId: string; creatorId: string; assigneeId: string | null } | null>;
  createComment(input: {
    taskId: string;
    authorId: string;
    content: string;
  }): Promise<CommentRecord>;
  updateComment(input: {
    commentId: string;
    content: string;
  }): Promise<CommentRecord>;
  deleteComment(commentId: string): Promise<void>;
}

interface Deps {
  repo: CommentRepository;
  notifications?: NotificationPublisher;
  webhooks?: WebhookDispatcher;
}

/** Xác minh comment thuộc workspace của actor; trả về comment hoặc ném lỗi. */
async function fetchOwnedComment(
  repo: CommentRepository,
  actor: Actor,
  commentId: string,
): Promise<CommentRecord> {
  const comment = await repo.getComment(commentId);
  if (!comment || comment.workspaceId !== actor.workspaceId) {
    throw new UnauthorizedError("Comment not found or does not belong to your workspace.");
  }
  if ("projectId" in actor && comment.projectId !== (actor as { projectId: string }).projectId) {
    throw new UnauthorizedError("Comment does not belong to this project.");
  }
  return comment;
}

async function fetchOwnedTaskScope(
  repo: CommentRepository,
  actor: Actor,
  taskId: string,
): Promise<string> {
  const [workspaceId, projectId] = await Promise.all([
    repo.getTaskWorkspaceId(taskId),
    repo.getTaskProjectId(taskId),
  ]);
  if (!workspaceId || workspaceId !== actor.workspaceId || !projectId) {
    throw new UnauthorizedError("Task not found or does not belong to your workspace.");
  }
  if ("projectId" in actor && projectId !== (actor as { projectId: string }).projectId) {
    throw new UnauthorizedError("Task does not belong to this project.");
  }
  return projectId;
}

export function createCommentService({ repo, notifications, webhooks }: Deps) {
  /** Xem danh sách comment của task — mọi member (FR-061). */
  async function listComments(actor: Actor, taskId: string): Promise<CommentRecord[]> {
    requirePermission(actor, canViewComments(effectiveRole(actor)), "You do not have permission to view comments.");
    await fetchOwnedTaskScope(repo, actor, taskId);
    return repo.listCommentsByTask(taskId);
  }

  /** Thêm comment — mọi member (FR-060). Không ghi activity (FR-071). */
  async function addComment(actor: Actor, taskId: string, content: string): Promise<CommentRecord> {
    requirePermission(actor, canAddComment(effectiveRole(actor)), "You do not have permission to add comments.");
    await fetchOwnedTaskScope(repo, actor, taskId);

    const trimmed = content.trim();
    if (trimmed.length === 0) {
      throw new UnauthorizedError("Comment content cannot be empty.");
    }

    const created = await repo.createComment({
      taskId,
      authorId: actor.userId,
      content: trimmed,
    });

    // Notification: creator/assignee của task khi có comment mới (Mốc 13).
    // Loại chính tác giả; đã notify qua NewComment thì không lặp (FR-071).
    const notified = await repo.getTaskMeta(taskId);
    if (notifications && notified) {
      const targets = [...new Set([notified.creatorId, notified.assigneeId ?? ""].filter(
        (id) => Boolean(id) && id !== actor.userId,
      ))];
      for (const userId of targets) {
        await notifications.notify({
          userId,
          type: "NewComment",
          payload: {
            taskId,
            taskTitle: notified.title,
            projectId: notified.projectId,
            workspaceId: notified.workspaceId,
          },
        });
      }
    }

    if (webhooks && notified) {
      webhooks
        .broadcastProjectEvent(notified.projectId, {
          event: "comment.created",
          timestamp: new Date().toISOString(),
          actor: { id: actor.userId },
          project: { id: notified.projectId, name: "Project", workspaceId: notified.workspaceId },
          task: {
            id: taskId,
            title: notified.title,
            statusId: "",
            priority: "Medium",
            projectId: notified.projectId,
          },
          comment: {
            id: created.id,
            content: created.content,
          },
        })
        .catch((err) => logger.error({ err }, "Webhook dispatch error on NewComment"));
    }

    return created;
  }

  /**
   * Sửa comment: Chỉ tác giả được sửa comment của mình; Owner/Admin không được sửa comment của người khác (FR-062).
   */
  async function updateComment(
    actor: Actor,
    commentId: string,
    content: string,
  ): Promise<CommentRecord> {
    const comment = await fetchOwnedComment(repo, actor, commentId);
    const isAuthor = comment.authorId === actor.userId;

    requirePermission(
      actor,
      canEditComment(effectiveRole(actor), isAuthor),
      "Only the author can edit this comment.",
    );

    const trimmed = content.trim();
    if (trimmed.length === 0) {
      throw new UnauthorizedError("Comment content cannot be empty.");
    }

    return repo.updateComment({
      commentId,
      content: trimmed,
    });
  }

  /**
   * Xoá comment: Tác giả xoá được comment của mình; Owner/Admin xoá được comment bất kỳ (FR-063, BR-016).
   */
  async function deleteComment(actor: Actor, commentId: string): Promise<void> {
    const comment = await fetchOwnedComment(repo, actor, commentId);
    const isAuthor = comment.authorId === actor.userId;

    requirePermission(
      actor,
      canDeleteComment(effectiveRole(actor), isAuthor),
      "You do not have permission to delete this comment.",
    );

    await repo.deleteComment(commentId);
  }

  return { listComments, addComment, updateComment, deleteComment };
}

export type CommentService = ReturnType<typeof createCommentService>;
