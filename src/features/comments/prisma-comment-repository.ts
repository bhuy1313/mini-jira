import { randomUUID } from "node:crypto";

import { prisma } from "@/lib/prisma";
import type { CommentRecord, CommentRepository } from "./comment-service";

const COMMENT_SELECT = {
  id: true,
  content: true,
  taskId: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
  task: {
    select: {
      project: {
        select: {
          id: true,
          workspaceId: true,
        },
      },
    },
  },
  author: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
} as const;

export const prismaCommentRepository: CommentRepository & {
  listCommentsByTaskIds(taskIds: string[]): Promise<CommentRecord[]>;
} = {
  async getComment(commentId: string): Promise<CommentRecord | null> {
    const row = await prisma.comment.findUnique({
      where: { id: commentId },
      select: COMMENT_SELECT,
    });
    if (!row) return null;
    return {
      id: row.id,
      taskId: row.taskId,
      workspaceId: row.task.project.workspaceId,
      projectId: row.task.project.id,
      authorId: row.authorId,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: row.author,
    };
  },

  async listCommentsByTask(taskId: string): Promise<CommentRecord[]> {
    const rows = await prisma.comment.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
      select: COMMENT_SELECT,
    });

    return rows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      workspaceId: row.task.project.workspaceId,
      projectId: row.task.project.id,
      authorId: row.authorId,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: row.author,
    }));
  },

  async listCommentsByTaskIds(taskIds: string[]): Promise<CommentRecord[]> {
    if (taskIds.length === 0) return [];
    const rows = await prisma.comment.findMany({
      where: { taskId: { in: taskIds } },
      orderBy: { createdAt: "asc" },
      select: COMMENT_SELECT,
    });

    return rows.map((row) => ({
      id: row.id,
      taskId: row.taskId,
      workspaceId: row.task.project.workspaceId,
      projectId: row.task.project.id,
      authorId: row.authorId,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: row.author,
    }));
  },

  async getTaskWorkspaceId(taskId: string): Promise<string | null> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        project: {
          select: {
            workspaceId: true,
          },
        },
      },
    });
    return task?.project.workspaceId ?? null;
  },

  async getTaskProjectId(taskId: string): Promise<string | null> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    return task?.projectId ?? null;
  },

  async getTaskMeta(
    taskId: string,
  ): Promise<{ title: string; projectId: string; workspaceId: string; creatorId: string; assigneeId: string | null } | null> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        title: true,
        projectId: true,
        creatorId: true,
        assigneeId: true,
        project: {
          select: { workspaceId: true },
        },
      },
    });
    return task
      ? {
          title: task.title,
          projectId: task.projectId,
          workspaceId: task.project.workspaceId,
          creatorId: task.creatorId,
          assigneeId: task.assigneeId,
        }
      : null;
  },

  async createComment(input: {
    taskId: string;
    authorId: string;
    content: string;
  }): Promise<CommentRecord> {
    const row = await prisma.comment.create({
      data: {
        id: randomUUID(),
        taskId: input.taskId,
        authorId: input.authorId,
        content: input.content,
      },
      select: COMMENT_SELECT,
    });

    return {
      id: row.id,
      taskId: row.taskId,
      workspaceId: row.task.project.workspaceId,
      projectId: row.task.project.id,
      authorId: row.authorId,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: row.author,
    };
  },

  async updateComment(input: {
    commentId: string;
    content: string;
  }): Promise<CommentRecord> {
    const row = await prisma.comment.update({
      where: { id: input.commentId },
      data: {
        content: input.content,
      },
      select: COMMENT_SELECT,
    });

    return {
      id: row.id,
      taskId: row.taskId,
      workspaceId: row.task.project.workspaceId,
      projectId: row.task.project.id,
      authorId: row.authorId,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      author: row.author,
    };
  },

  async deleteComment(commentId: string): Promise<void> {
    await prisma.comment.delete({
      where: { id: commentId },
    });
  },
};
